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

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier") {
      console.error(`[AI Sommelier] API Key ERROR: MY_SOMMELIER_KEY is missing or invalid. Value: ${apiKey}`);
      throw new Error(`AIソムリエの認証情報(APIキー)が正しく設定されていません。
アプリの[Settings]から 'MY_SOMMELIER_KEY' という名前で有効なGemini APIキーを設定してください。`);
    }

    // Mask key for safety but log details for debugging
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`[AI Sommelier] Initializing Gemini AI (Model: gemini-1.5-flash-latest)
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
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7,
      }
    });
    
    const answer = result.text;
    if (!answer) throw new Error("No response text generated");
    
    return answer;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    return "申し訳ございません。現在ソムリエが席を外しております。少々お時間をおいてから再度お声がけください。";
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
        model: "gemini-1.5-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.8,
        }
      });
      return result.text || "このワインは非常にバランスが良く、お食事にぴったりです。";
    } catch (error) {
      console.error("Staff talk generation error:", error);
      return "このワインは非常にバランスが良く、お食事にぴったりです。";
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
        model: "gemini-1.5-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.8,
        }
      });
      return result.text || "優雅なひとときを。 #Wine #SommelierSelection";
    } catch (error) {
      console.error("Social post generation error:", error);
      return "優雅なひとときを。 #Wine #SommelierSelection";
    }
  });
}
