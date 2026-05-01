import { GoogleGenAI, Type } from "@google/genai";
import { WineMaster } from "../types";
import { auth } from "./firebase";

let genAI: any = null;

function getAIClient() {
  if (!genAI) {
    const apiKey = import.meta.env.VITE_MY_SOMMELIER_KEY || process.env.MY_SOMMELIER_KEY;

    if (!apiKey) {
      console.error(`[AI Sommelier] APIキーが見つかりません。`);
      throw new Error("APIキーが設定されていません。GitHubのSecretsを確認してください。");
    }

    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/**
 * AIを利用可能か（認証済みかつ適切なメールドメインか）判定する
 */
export function isUserAuthorized() {
  const user = auth.currentUser;
  if (!user || !user.email) return false;
  
  // 管理者
  const isSpecialAdmin = user.email === "takatam40725@gmail.com";
  
  return isSpecialAdmin;
}

async function validateAndCall(fn: () => Promise<any>) {
  if (!isUserAuthorized()) {
    throw new Error("この操作を行う権限がありません。管理者アカウントでログインしてください。");
  }
  return fn();
}

export interface AISommelierResponse {
  message: string;
  buttons?: string[];
  wineIds?: string[];
}

/**
 * ソムリエとしてワインを提案する (Frontend v3 - Function Calling)
 */
export async function getSommelierAdvice(
  userQuery: string,
  availableWines: WineMaster[],
  context: { cuisine?: string; history?: { role: 'user' | 'ai'; content: string }[] } = {}
): Promise<AISommelierResponse> {
  // RAG: 在庫情報の圧縮
  const wineContext = availableWines
    .slice(0, 15)
    .map(w => `[ID:${w.id}] ${w.name_jp} | 合う:${w.pairing} | ¥${Number(w.price_bottle).toLocaleString()}`)
    .join("\n");

  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: context.history?.map(h => ({
        role: h.role === 'ai' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })) || [],
      config: {
        systemInstruction: `あなたはピーロート・ジャパンの高級AIソムリエです。
3ターン以内に最高のワインを提案してください。

【出力の鉄則】
1. 挨拶や前置きは極力短くし、ユーザーが次に選ぶべきアクションを明確にします。
2. 構造化データとして回答を返すための専用ツール（update_ui）を必ず使用してください。
3. 提案時は最大3本までに絞ってください。

【提供可能リスト】
${wineContext}`,
        tools: [
          {
            functionDeclarations: [
              {
                name: "update_ui",
                description: "AIの回答内容、選択肢ボタン、提案ワインリストをUIに反映します。",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    message: {
                      type: Type.STRING,
                      description: "ユーザーへ表示するテキストメッセージ（Markdown可）。"
                    },
                    buttons: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "ユーザーが次に選ぶべき選択肢のラベル。例: ['赤ワイン希望', '白ワイン希望']"
                    },
                    wineIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "提案するワインの商品IDリスト。例: ['9309980', '9308883']"
                    }
                  },
                  required: ["message"]
                }
              }
            ]
          }
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["update_ui"]
          }
        },
        temperature: 0.3
      }
    });

    const call = response.functionCalls?.[0];
    if (call && call.name === "update_ui") {
      return call.args as AISommelierResponse;
    }
    
    return { 
      message: response.text || "ソムリエが在庫を確認中です。少々お待ちください。",
      buttons: ["最初から探す"]
    };
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    return {
      message: "申し訳ございません。ソムリエを呼び出せませんでした。APIキーを確認してください。",
      buttons: ["最初から探す"]
    };
  }
}

/**
 * スタッフ向けのセールストーク案を作成する
 */
export async function generateStaffTalkScript(wine: WineMaster) {
  return validateAndCall(async () => {
    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `スタッフ向けの30秒セールストークを作成してください。\nワイン: ${wine.name_jp}\n特徴: ${wine.ai_explanation}\nペアリング: ${wine.pairing}\n150文字以内で簡潔に。` }] }]
      });
      return response.text || "このワインは非常にお勧めです。";
    } catch (error: any) {
      console.error("Staff talk generation error:", error);
      return `【生成エラー】${error.message}`;
    }
  });
}

/**
 * SNS投稿用のキャプション案を作成する
 */
export async function generateSocialPost(wine: WineMaster) {
  return validateAndCall(async () => {
    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Instagram投稿用のキャプションを作成してください。\nワイン: ${wine.name_jp}\nハッシュタグを5つ含めて。150文字以内。` }] }]
      });
      return response.text || "特別なワインの時間。 #Wine";
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成エラー】${error.message}`;
    }
  });
}
