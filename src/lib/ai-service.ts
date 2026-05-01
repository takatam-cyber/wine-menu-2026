import { GoogleGenAI } from "@google/genai";
import { WineMaster } from "../types";
import { auth } from "./firebase";

let genAI: any = null;

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

function getAIClient() {
  if (!genAI) {
    const apiKey = (process.env as any).MY_SOMMELIER_KEY || process.env.MY_SOMMELIER_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier" || !apiKey.startsWith("AI") || apiKey.length < 39) {
      console.error(`[AI Sommelier] API Key ERROR: MY_SOMMELIER_KEY is missing or invalid.`);
      throw new Error("APIキーの設定(MY_SOMMELIER_KEY)が不完全です。管理者メニューの[Settings]から、'AI'で始まる39文字以上の有効なGemini APIキーを設定してください。");
    }

    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

async function validateAndCall(fn: () => Promise<any>) {
  if (!isUserAuthorized()) {
    throw new Error("この操作を行う権限がありません。管理者アカウントでログインしてください。");
  }
  return fn();
}

/**
 * ソムリエとしてワインを提案する
 */
export async function getSommelierAdvice(
  userQuery: string,
  availableWines: WineMaster[],
  context: { cuisine?: string; history?: { role: 'user' | 'ai'; content: string }[] } = {}
) {
  // RAG: 在庫情報の圧縮
  const wineContext = availableWines
    .slice(0, 15)
    .map(w => `[ID:${w.id}] ${w.name_jp} | 合う:${w.pairing} | ¥${Number(w.price_bottle).toLocaleString()}`)
    .join("\n");

  const prompt = `あなたはピーロート・ジャパンのAIソムリエです。
3ターン以内に最高のワイン3本を提案し、[SELECT:ID] で出力してください。

【出力の鉄則】
1. **挨拶・前置きの完全排除**: 「承知いたしました」「ピーロート・ジャパンへようこそ」等の定型句は一切禁止です。即座に質問または回答を開始してください。
2. **簡潔な文体**: 回答は短文で構成し、結論だけを述べてください。
3. **タグの完結**: 全ての回答の末尾は、必ず [BUTTON:ラベル] または提案時の [SELECT:ID] で終わらせること。文章の途中で終わることは絶対に許されません。
4. **即提案**: 具体的な食材や好みが入力された場合、ヒアリングをスキップして即座に提案（Turn 3）へ移行してください。

【進行フロー】
・Turn 1: カテゴリー確認。[BUTTON:お肉料理] [BUTTON:お魚料理] [BUTTON:前菜] [BUTTON:気分で選ぶ]
・Turn 2: 詳細（食材・調理法・味）を1文で確認。
・Turn 3: 厳選提案。銘柄名 [SELECT:ID] 形式で3本。

【在庫リスト】
${wineContext}

お客様：${userQuery}`;

  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 1000,
        temperature: 0.3,
      }
    });

    if (!response || !response.text) {
      throw new Error("AIからの応答が空でした。");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    const detail = error.message || String(error);
    
    if (detail.includes("API_KEY_INVALID") || detail.includes("API key not valid")) {
      return "【認証エラー】APIキーが無効です。管理者メニューの[Settings]から正しい MY_SOMMELIER_KEY を設定してください。";
    }
    
    return "ソムリエを呼び出せませんでした。[BUTTON:最初から探す]";
  }
}

/**
 * スタッフ向けのセールストーク案を作成する
 */
export async function generateStaffTalkScript(wine: WineMaster) {
  return validateAndCall(async () => {
    const prompt = `スタッフ向けの30秒セールストークを作成してください。
ワイン: ${wine.name_jp}
特徴: ${wine.ai_explanation}
ペアリング: ${wine.pairing}
150文字以内で簡潔に。`;

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
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
    const prompt = `Instagram投稿用のキャプションを作成してください。
ワイン: ${wine.name_jp}
ハッシュタグを5つ含めて。150文字以内。`;

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return response.text || "特別なワインの時間。 #Wine";
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成エラー】${error.message}`;
    }
  });
}
