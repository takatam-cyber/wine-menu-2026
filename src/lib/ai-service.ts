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
    // 優先的に MY_SOMMELIER_KEY を参照し、(process.env as any) で型エラーを回避
    const apiKey = (process.env as any).MY_SOMMELIER_KEY || process.env.MY_SOMMELIER_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier" || !apiKey.startsWith("AI") || apiKey.length < 39) {
      console.error(`[AI Sommelier] API Key ERROR: MY_SOMMELIER_KEY is missing or invalid.`);
      throw new Error("APIキーの設定(MY_SOMMELIER_KEY)が不完全です。管理者メニューの[Settings]から、'AI'で始まる39文字以上の有効なGemini APIキーを設定してください。");
    }

    // Mask key for safety but log details for debugging
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`[AI Sommelier] Initializing Gemini AI (Model: gemini-3-flash-preview)
    Source: MY_SOMMELIER_KEY (Hint: ${maskedKey})`);

    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

async function validateAndCall(fn: () => Promise<any>) {
  if (!isUserAuthorized()) {
    throw new Error("この操作を行う権限がありません。管理者アカウントでログインしてください。");
  }
  return await fn();
}

export async function getSommelierAdvice(
  userQuery: string,
  availableWines: WineMaster[],
  context: { cuisine?: string; mood?: string } = {}
) {
  if (availableWines.length === 0) {
    return "申し訳ございません。現在在庫にあるワインがございません。";
  }

  // --- 低燃費モード: 事前フィルタリング (トークン節約) ---
  const query = userQuery.toLowerCase();
  let filteredWines = availableWines;
  
  if (query.includes("赤") || query.includes("red")) {
    filteredWines = availableWines.filter(w => w.type === "Red");
  } else if (query.includes("白") || query.includes("white")) {
    filteredWines = availableWines.filter(w => w.type === "White");
  } else if (query.includes("泡") || query.includes("sparkling") || query.includes("シャンパン")) {
    filteredWines = availableWines.filter(w => w.type === "Sparkling");
  } else if (query.includes("甘") || query.includes("sweet") || query.includes("デザート")) {
    filteredWines = availableWines.filter(w => w.type === "Dessert" || w.type === "Sweet");
  }

  // トークン節約のため、最大15本に制限し、情報を極限まで削る
  const wineContext = filteredWines
    .slice(0, 15)
    .map(
      (w) =>
        `[ID:${w.id}] ${w.name_jp} | ${w.type} | ${w.ai_explanation.substring(0, 40)}...`
    )
    .join("\n");

  const prompt = `あなたは「当店の専属ソムリエ」です。リストから最適なワインを提案してください。

【厳選リスト】
${wineContext}

【お客様の要望】
"${userQuery}"

---
【厳格な回答ルール (スマホ最適化)】
1. 冒頭の挨拶は15文字以内（例：「お魚料理ですね。こちらが最適です。」）。
2. インポーター名は出さず「当店のリスト」として紹介。
3. 提案は「最大2本」に絞り、全体で150文字程度。
4. 各紹介は以下の3要素のみ：
   - 【商品名 (ヴィンテージ)】
   - 【ひとこと理由】(太字。料理との「化学反応」をプロの言葉で短く)
   - 【味わい】(1行。官能的な表現を1点)
5. 各紹介の末尾に [SELECT:商品ID] を必ず付与。
6. 最後は「お持ちしましょうか？」等の簡潔な結びで。`;

  try {
    const ai = getAIClient();
    
    // トークン節約のため、シンプルな文字列でプロンプトを送信
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        maxOutputTokens: 300,
        temperature: 0.7,
      }
    });
    
    if (!result || !result.text) {
      throw new Error("AIからの応答が空でした。");
    }
    
    return result.text;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    
    // エラーの詳細をユーザーに表示して原因特定を助ける
    const detail = error.message || String(error);
    
    // 特徴的なキーワードでエラーを分類
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
