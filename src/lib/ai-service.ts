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
    // AI Studio標準キーまたは以前設定されていたカスタムキーの両方を確認
    const apiKey = process.env.GEMINI_API_KEY || (process.env as any).MY_SOMMELIER_KEY;

    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "" || apiKey === "AI Studio Free Tier") {
      console.error("[AI Sommelier] API Key ERROR: Valid key not found.");
      throw new Error("APIキー(GEMINI_API_KEY)が設定されていません。AI Studioの[Settings]から有効なキーを確認してください。");
    }

    genAI = new GoogleGenAI(apiKey);
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
    .slice(0, 20) // More context for rich proposal
    .map(
      (w) =>
        `[ID:${w.id}] ${w.name_jp} | ${w.type} | 特徴:${w.ai_explanation.substring(0, 100)} | 合う料理:${w.pairing} | 価格:¥${Number(w.price_bottle).toLocaleString()}`
    )
    .join("\n");

  const prompt = `あなたは一流レストランの「専属シニアソムリエ」です。
スマホ最適化のため、以下の【接客アルゴリズム】を厳守してください。

【接客アルゴリズム：4ステップ対話】
あなたはすぐにワインを提案してはいけません。以下の手順を必ず踏んでください。

Step 1（カテゴリー確認）:
料理のカテゴリーが不明な場合、まず確認してください。
提示する選択肢： [BUTTON:お肉料理] [BUTTON:お魚料理] [BUTTON:前菜・サラダ] [BUTTON:本日の気分で選ぶ]

Step 2（詳細ヒアリング）:
ユーザーの選択を受け、「承知いたしました。〇〇ですね。」と短く返した上で、さらに詳細を聞いてください。
- お肉：種類（牛・豚・鴨等）や調理法。
- お魚：魚種やソース。
- 前菜：[BUTTON:冷たい前菜] [BUTTON:温かい前菜] [BUTTON:チーズ・生ハム]
必ず [BUTTON:ラベル] を提示してください。

Step 3（味の方向性）:
最後に味の好みを一言確認します。（例：[BUTTON:さっぱり・酸味] [BUTTON:濃厚・クリーミー] [BUTTON:塩気・スモーキー]）

Step 4（最終提案）:
上記3ステップを経て初めて、[SELECT:商品ID] を用いてワインを提案してください。
銘柄名 [SELECT:ID] （スペースなし）の形式で出力。
提案後には必ず [BUTTON:他の候補] [BUTTON:最初から探す] を含めてください。

【制約・禁止事項】
- 最初の挨拶（いらっしゃいませ）は履歴がない場合のみ。二度目以降は自己紹介や挨拶は一切禁止です。
- 会話は極めて簡潔（150文字程度）にし、途中で途切れないようにしてください。
- 全ての回答の末尾には、次に選ぶべき行動を [BUTTON:ラベル] 形式で提示すること。

【リスト】
${wineContext}

【これまでの履歴】
${context.history?.map(m => `${m.role === 'user' ? '客' : 'ソムリエ'}: ${m.content}`).join('\n') || "なし"}

客：${userQuery}
ソムリエ：`;

  try {
    const genAI = getAIClient();
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    });

    const text = result.response.text();
    if (!text) throw new Error("応答が空でした。");
    
    return text;
  } catch (error: any) {
    console.error("AI Sommelier Error:", error);
    const detail = error.message || String(error);
    
    if (detail.includes("API_KEY_INVALID") || detail.includes("not valid")) {
      return "【認証エラー】APIキーの設定を確認してください。";
    }
    
    return `（ソムリエが失礼いたしました。通信に乱れがあるようです。再度ボタンから話しかけてみてください。：${detail.substring(0, 40)}）`;
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
      const genAI = getAIClient();
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return result.response.text();
    } catch (error: any) {
      console.error("Staff talk generation error:", error);
      return `【生成失敗】${error.message}`;
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
      const genAI = getAIClient();
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      return result.response.text();
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成失敗】${error.message}`;
    }
  });
}
