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
  context: { cuisine?: string } = {}
) {
  // --- Token saving pre-filtering ---
  const query = userQuery.toLowerCase();
  let filteredWines = availableWines;
  
  if (query.includes("赤") || query.includes("red") || query.includes("肉")) {
    filteredWines = availableWines.filter(w => w.type === "Red");
  } else if (query.includes("白") || query.includes("white") || query.includes("魚")) {
    filteredWines = availableWines.filter(w => w.type === "White");
  } else if (query.includes("泡") || query.includes("sparkling") || query.includes("祝い")) {
    filteredWines = availableWines.filter(w => w.type === "Sparkling");
  }

  const wineContext = filteredWines
    .slice(0, 15)
    .map(
      (w) =>
        `[ID:${w.id}] ${w.name_jp} | ${w.type} | 特徴:${w.ai_explanation.substring(0, 50)} | 合う料理:${w.pairing}`
    )
    .join("\n");

  const finalPrompt = `あなたはレストランの「専属シニアソムリエ」です。
スマホ最適化のため、以下の【3ステップ対話】を厳守してください：

1. 【食材診断】: 食材の詳細（肉・魚・野菜等）を深掘りする質問をし、必ず [BUTTON:ラベル] を提示。
2. 【調理法診断】: 次に調理法、ソース、味の濃さを聞き、必ず [BUTTON:ラベル] を提示。
3. 【最終提案】: 2回以上の質問を経てから、初めて [SELECT:商品ID] を付与して3本程度提案。

制約事項:
- 冒頭の挨拶は「15文字以内」に。
- 提案するワイン名のすぐ横に、スペースなしで [SELECT:商品ID] を付与すること。
- 回答の最後には、次に選ぶべき行動を [BUTTON:ラベル] 形式で必ず2〜3個提示すること。
- 回答は極めて簡潔（150文字程度）にし、途中で途切れないようにしてください。

リスト：
${wineContext}

お客様：${userQuery}`;

  try {
    const ai = getAIClient();
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      config: {
        maxOutputTokens: 600,
        temperature: 0.7,
      }
    });

    if (!result || !result.text) {
      throw new Error("AIからの応答が空でした。");
    }
    
    return result.text;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    const detail = error.message || String(error);
    
    if (detail.includes("API_KEY_INVALID") || detail.includes("API key not valid")) {
      return "【認証エラー】APIキーが無効です。管理者メニューの[Settings]から正しい MY_SOMMELIER_KEY を設定してください。";
    }
    if (detail.includes("404") || detail.includes("model not found")) {
      return "【モデルエラー】選択されたAIモデルが見つかりません。設定を確認してください。";
    }

    return `申し訳ございません。現在ソムリエが席を外しております。
(詳細エラー: ${detail.substring(0, 50)}...)`;
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
簡潔かつ魅力的に。`;

    try {
      const ai = getAIClient();
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return result.text || "このワインは特にお勧めです。";
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
ハッシュタグを5つ含めてください。`;

    try {
      const ai = getAIClient();
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return result.text || "素敵なワインの時間。";
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成エラー】${error.message}`;
    }
  });
}
