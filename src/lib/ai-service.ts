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
    // 新しい独自変数 MY_SOMMELIER_KEY のみを使用し、競合を避ける
    const apiKey = (process.env as any).MY_SOMMELIER_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier") {
      console.error(`[AI Sommelier] API Key ERROR: MY_SOMMELIER_KEY is missing or invalid. Value: ${apiKey}`);
      throw new Error(`AIソムリエの認証情報(APIキー)が正しく設定されていません。
アプリの[Settings]から 'MY_SOMMELIER_KEY' という名前で有効なGemini APIキーを設定してください。`);
    }

    if (apiKey.startsWith("Al")) {
      console.warn(`[AI Sommelier] WARNING: API Key starts with "Al" (small L). Did you mean "AI" (capital I)?`);
    }
    
    // Mask key for safety but log details for debugging
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`%c[AI Sommelier] Initializing Gemini AI
    Source: MY_SOMMELIER_KEY
    Key Hint: ${maskedKey}
    Length: ${apiKey.length}
    Starts with 'AI': ${apiKey.startsWith('AI')}`, "color: #4CAF50; font-weight: bold;");

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
  // お客様（未ログイン）も利用できるように validateAndCall を使用せず
  const user = auth.currentUser;
  const userEmail = user?.email || "Anonymous Customer";

  if (availableWines.length === 0) {
    return "申し訳ございません。現在在庫にあるワインがございません。";
  }

  const wineContext = availableWines
    .map(
      (w) =>
        `- [ID: ${w.id}] ${w.name_jp} (${w.country}, ${w.vintage}, ${w.grape}): ${w.ai_explanation} (Pairing: ${w.pairing})`
    )
    .join("\n");

  const prompt = `以下のワインリストから選んで答えてください：
${wineContext}

【お客様からの質問】
"${userQuery}"

---
あなたは、このレストランの店主から全幅の信任を得ている「専属ソムリエ」です。

【回答の厳格な構成ルール】
1. 冒頭の挨拶は「15文字以内」で極小化してください（例：「お魚料理ですね。こちらが最適です。」）。
2. ワインの提案は「最大2本」に絞り、全体の分量は150文字程度。
3. 各ワインの紹介は必ず以下の3要素のみ：
   - 【商品名 (ヴィンテージ)】
   - 【ひとこと理由】（太字。料理との「化学反応」をプロの言葉で短く）
   - 【味わい】（1行。官能的な表現を1つ入れる）
4. 各ワインの紹介の末尾に、必ず [SELECT:商品ID] という形式のタグを付与してください（例：[SELECT:9308180]）。
5. 最後は「お持ちしましょうか？」等の簡潔な結びで。
6. インポーター名は一切出さず、「当店のリスト」として紹介してください。
7. スマホの1画面に確実に収まる分量を維持してください。`;

  try {
    const ai = getAIClient();
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: prompt
    });
    
    const answer = result.text;
    if (!answer) throw new Error("No response text generated");
    
    return answer;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    const errorMsg = error?.message || "";
    if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("403") || errorMsg.includes("401")) {
      return "ソムリエの認証に失敗しました。管理画面の[Settings]から正しい MY_SOMMELIER_KEY が設定されているかご確認ください。";
    }
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
        contents: prompt
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
        contents: prompt
      });
      return result.text || "優雅なひとときを。 #Wine #SommelierSelection";
    } catch (error) {
      console.error("Social post generation error:", error);
      return "優雅なひとときを。 #Wine #SommelierSelection";
    }
  });
}
