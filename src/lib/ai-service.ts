import { GoogleGenAI } from "@google/genai";
import { WineMaster } from "../types";
import { auth } from "./firebase";

let genAI: GoogleGenAI | null = null;

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
    // 優先的に MY_SOMMELIER_KEY を参照
    const apiKey = (process.env as any).MY_SOMMELIER_KEY || process.env.MY_SOMMELIER_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier" || !apiKey.startsWith("AI") || apiKey.length < 39) {
      console.error(`[AI Sommelier] API Key ERROR: MY_SOMMELIER_KEY is missing or invalid.`);
      throw new Error("APIキーの設定(MY_SOMMELIER_KEY)が不完全です。管理者メニューの[Settings]から、'AI'で始まる39文字以上の有効なGemini APIキーを設定してください。");
    }

    // Mask key for safety
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`[AI Sommelier] Initializing Gemini AI (Model: gemini-3-flash-preview) Hint: ${maskedKey}`);

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
    .slice(0, 12)
    .map(
      (w) =>
        `[ID:${w.id}] ${w.name_jp} | ${w.type} | 特徴:${w.ai_explanation.substring(0, 50)} | 合う料理:${w.pairing}`
    )
    .join("\n");

  const prompt = `あなたは「ミシュラン星付きレストランの専属シニアソムリエ」です。気品と情緒溢れる言葉で、お客様を最高の1本へ導き、会話を楽しく進めてください。

【性格と文体】
- 言葉遣いは極めて優雅。簡潔さ（150文字以内）を重視。
- ピーロート・ジャパン等のインポーター名は絶対に出さず「当店のセラー」として紹介して。
- 知識の披露ではなく、お客様の心に響く「情景」を語ってください。

【技術仕様（最重要）】
1. ワインを提案する際は、商品名のすぐ横（末尾）にスペースを空けず [SELECT:商品ID] を必ず付与してください。
   例：「【銘柄名】[SELECT:101] は深みがあり...」
2. 回答の最後に、ユーザーが次に選ぶべき行動を短いラベルで、必ず [BUTTON:ラベル] 形式で2〜4個提示してください。
   ラベルは2〜6文字の直感的なもの（例：[BUTTON:軽めの白] [BUTTON:お肉料理] [BUTTON:プロに相談] 等）に限定してください。

【回答例】
「今夜は真鯛のポワレですね。海の香りに寄り添う、宝石のような白ワインがございます。
【シャブリ プルミエクリュ】[SELECT:102]
貝殻を思わせるミネラルが、お料理の隠れた甘みを引き出します。

他にも、スッキリした泡や、お肉料理に合わせた赤もお探しでしょうか？ 
[BUTTON:爽やかな泡] [BUTTON:お肉に合う赤] [BUTTON:ソムリエお任せ]」

【店舗情報】
- 今夜の料理：${context.cuisine || "シェフお任せ"}

【提供可能なワイン（この中から選んでください）】
${wineContext}

質問：${userQuery}`;

  try {
    const ai = getAIClient();
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        maxOutputTokens: 400,
        temperature: 0.8,
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
    if (detail.includes("429") || detail.includes("quota")) {
      return "【制限エラー】AIの利用制限に達しました。しばらく時間をおいてから再度お試しください。";
    }

    return `申し訳ございません。現在ソムリエが席を外しております。
(詳細エラー: ${detail})
少々お時間をおいてから再度お声がけください。`;
  }
}

/**
 * スタッフ向けのセールストーク案を作成する
 */
export async function generateStaffTalkScript(wine: WineMaster) {
  return validateAndCall(async () => {
    const prompt = `Create a 30-second sales talk script for restaurant staff to suggest this wine to a customer.
Wine: ${wine.name_jp} (${wine.name_en})
Features: ${wine.ai_explanation}
Pairing: ${wine.pairing}

The script should be:
1. Polished and professional.
2. Focus on one 'wow' factor.
3. Suggest a specific food pairing from the data.
4. Language: Japanese.`;

    try {
      const ai = getAIClient();
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 500,
          temperature: 0.8,
        }
      });
      return result.text || "このワインは非常にバランスが良く、お食事にぴったりです。";
    } catch (error: any) {
      console.error("Staff talk generation error:", error);
      return `【生成エラー】${error.message || "お食事にぴったりのワインです。"}`;
    }
  });
}

/**
 * SNS投稿用のキャプション案を作成する
 */
export async function generateSocialPost(wine: WineMaster) {
  return validateAndCall(async () => {
    const prompt = `Create an Instagram post caption for this wine.
Wine: ${wine.name_jp}
Tone: Luxury, sophisticated.
Include 5 relevant hashtags for a fine dining restaurant (no brand names).
Language: Japanese.`;

    try {
      const ai = getAIClient();
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 500,
          temperature: 0.8,
        }
      });
      return result.text || "優雅なひとときを。 #Wine #SommelierSelection";
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成エラー】${error.message || "優雅なひとときを。 #Wine"}`;
    }
  });
}
