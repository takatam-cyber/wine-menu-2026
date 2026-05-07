import { GoogleGenAI, Type } from "@google/genai";
import { WineMaster } from "../types";
import { auth } from "./firebase";

let genAI: any = null;

function getAIClient() {
  if (!genAI) {
    // Vite replaces this string at build time via the define config
    const apiKey = import.meta.env.VITE_MY_SOMMELIER_KEY || (typeof process !== 'undefined' ? process.env.MY_SOMMELIER_KEY : undefined);

    if (!apiKey || apiKey === "AI Studio Free Tier") {
      console.error(`[AI Sommelier] APIキーが見つかりません。`);
      throw new Error("APIキー(MY_SOMMELIER_KEY)が設定されていません。AI Studioの[Settings]から、'AI'で始まる有効なGemini APIキーを設定してください。");
    }

    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface AISommelierResponse {
  message: string;
  buttons?: string[];
  wineIds?: string[];
}

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

  const systemInstruction = `あなたはピーロート・ジャパンの高級AIソムリエです。
3ターン以内に最高のワインを提案してください。

【出力の鉄則】
1. 挨拶は短くし、即座に次のアクションを促してください。
2. 必ず update_ui ツールを呼び出して、メッセージとボタン、またはワイン提案を返してください。
3. 文章の途中で終わらず、必ずボタンかワインIDを添えてください。

【提供可能リスト】
${wineContext}`;

  try {
    const client = getAIClient();
    const model = client.getGenerativeModel({ 
      model: "models/gemini-3-flash-preview",
      systemInstruction: systemInstruction,
      tools: [{
        functionDeclarations: [{
          name: "update_ui",
          description: "UIの表示内容（メッセージ、ボタン、ワイン提案）を更新します。",
          parameters: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING, description: "ユーザーへの返答テキスト。" },
              buttons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "次に押すべきボタンのラベル。" },
              wineIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "提案するワインのIDリスト。" }
            },
            required: ["message"]
          }
        }]
      }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["update_ui"] } }
    });

    const history = context.history?.map(h => ({
      role: h.role === 'ai' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })) || [];

    const result = await model.generateContent({
      contents: [...history, { role: "user", parts: [{ text: userQuery }] }]
    });

    // functionCalls() メソッドで呼び出しを取得
    const calls = result.response.functionCalls();
    if (calls && calls.length > 0) {
      return calls[0].args as AISommelierResponse;
    }
    
    try {
      const text = result.response.text();
      return { 
        message: text || "在庫を確認しました。最適な一本をご案内します。",
        buttons: ["最初から探す"]
      };
    } catch (e) {
      return {
        message: "在庫を確認しました。最適な一本をご案内します。",
        buttons: ["最初から探す"]
      };
    }
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    const errorMessage = error.message || "不明なエラーが発生しました。";
    return {
      message: `ソムリエが席を外しております。しばらくしてからお声がけください。（エラー詳細: ${errorMessage}）`,
      buttons: ["最初から探す"]
    };
  }
}

// スタッフ用トーク・SNS用も gemini-3-flash-preview に統一
export async function generateStaffTalkScript(wine: WineMaster) {
  const ai = getAIClient();
  const model = ai.getGenerativeModel({ model: "models/gemini-3-flash-preview" });
  const result = await model.generateContent(`ワイン「${wine.name_jp}」の30秒セールストークを150文字以内で作成してください。`);
  return result.response.text();
}

export async function generateSocialPost(wine: WineMaster) {
  const ai = getAIClient();
  const model = ai.getGenerativeModel({ model: "models/gemini-3-flash-preview" });
  const result = await model.generateContent(`ワイン「${wine.name_jp}」のInstagram用キャプションをハッシュタグ5つ付きで作成してください。`);
  return result.response.text();
}
