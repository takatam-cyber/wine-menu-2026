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
  
  // ピーロート・ジャパン社員（@pieroth.jp）または管理者
  const isPieroth = user.email.endsWith("@pieroth.jp");
  const isSpecialAdmin = user.email === "takatam40725@gmail.com";
  
  return isPieroth || isSpecialAdmin;
}

function getAIClient() {
  if (!genAI) {
    // ユーザーのリクエストに従い、NEXT_PUBLIC_GEMINI_API_KEYのみを唯一のソースとする
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier") {
      console.error(`[AI Sommelier] API Key ERROR: NEXT_PUBLIC_GEMINI_API_KEY is missing or invalid. Value: ${apiKey}`);
      throw new Error(`AIソムリエの認証情報(APIキー)が正しく設定されていません。
アプリの[Settings]から 'NEXT_PUBLIC_GEMINI_API_KEY' という名前で有効なGemini APIキーを設定してください。`);
    }

    // TYPO CHECK: Detect if the key starts with "Al" (small L) instead of "AI" (capital i)
    if (apiKey.startsWith("Al")) {
      console.warn(`[AI Sommelier] WARNING: API Key starts with "Al" (small L). Did you mean "AI" (capital I)?`);
    }
    
    // Mask key for safety but log details for debugging
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`%c[AI Sommelier] Initializing Gemini AI
    Source: NEXT_PUBLIC_GEMINI_API_KEY
    Key Hint: ${maskedKey}
    Length: ${apiKey.length}
    Starts with 'AI': ${apiKey.startsWith('AI')}`, "color: #4CAF50; font-weight: bold;");

    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

async function validateAndCall(fn: () => Promise<any>) {
  if (!isUserAuthorized()) {
    throw new Error("この操作を行う権限がありません。ピーロート・ジャパンのアカウントでログインしてください。");
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
あなたは世界最高峰のワインインポーター「ピーロート・ジャパン」の専属AIソムリエです。
上記の「在庫リスト」の中から、お客様の要望に最適なワインを提案してください。

【回答の厳格なルール】
1. 必ず上記の「在庫リスト」にあるワインのみを提案してください。
2. ワインの「ID」と「商品名」を必ず含めてください。
3. 提案は1〜3つに絞ってください。
4. 言葉遣いは上品で、ソムリエらしい丁寧な日本語で回答してください。

【回答構成】
- プロのソムリエとしての挨拶
- 推奨ワインの紹介と詳細な説明
- 温かいメッセージ`;

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
      return "ソムリエの認証に失敗しました。管理画面の[Settings]から正しいNEXT_PUBLIC_GEMINI_API_KEYが設定されているかご確認ください。";
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
Include 5 relevant hashtags including #Pieroth.
Language: Japanese.`;

    try {
      const ai = getAIClient();
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: prompt
      });
      return result.text || "優雅なひとときを。 #Pieroth #Wine";
    } catch (error) {
      console.error("Social post generation error:", error);
      return "優雅なひとときを。 #Pieroth #Wine";
    }
  });
}
