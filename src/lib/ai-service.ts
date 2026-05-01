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

  const prompt = `あなたはミシュラン星付きレストランの「専属シニアソムリエ」です。
スマホ最適化のため、またお客様に最高のエクスペリエンスを提供するため、以下の【接客アルゴリズム】を厳守してください。

【接客アルゴリズム：段階的選定】
あなたはすぐにワインを提案してはいけません。以下の手順を必ず踏んでください。

1. 【Step 1：カテゴリー診断】
   料理のカテゴリーが不明な場合（特にお客様の最初の発言など）、まず確認してください。
   提示する選択肢： [BUTTON:お肉料理] [BUTTON:お魚料理] [BUTTON:前菜・サラダ] [BUTTON:本日の気分で選ぶ]

2. 【Step 2：詳細ヒアリング】
   ユーザーの選択を受け、「承知いたしました。〇〇ですね。」と短く返した上で、さらに詳細を聞いてください。
   - お肉の場合：種類（牛・豚・羊等）や焼き方（グリル・煮込み等）。
   - お魚の場合：白身、赤身、調理法、ソースの種類。
   - 前菜を選んだ場合：[BUTTON:冷たい前菜（サラダ・マリネ等）] [BUTTON:温かい前菜（キッシュ・スープ等）] [BUTTON:チーズ・生ハム・ナッツ]
   必ず [BUTTON:ラベル] を提示してください。

3. 【Step 3：味の方向性】
   最後に味の好みを一言確認します。（例：[BUTTON:さっぱり・酸味] [BUTTON:濃厚・クリーミー] [BUTTON:塩気・スモーキー]）

4. 【Step 4：最終提案】
   上記を経て初めて、[SELECT:商品ID] を用いて3種類程度のワインを提案してください。
   銘柄名 [SELECT:ID] （スペースなし）の形式で出力。
   提案後には必ず [BUTTON:他の候補] [BUTTON:最初から探す] を含めてください。

【制約事項】
- 二度目以降の返答では「いらっしゃいませ」や自己紹介は一切禁止です。
- 会話は極めて簡潔（150〜200文字程度）にし、途中で途切れないようにしてください。
- 全ての回答の末尾には、次に選ぶべき行動を [BUTTON:ラベル] 形式で必ず2〜4個提示すること。

【店舗情報】
- 今夜のメイン：${context.cuisine || "シェフお任せ"}

【提供可能なワインリスト】
${wineContext}

【これまでの会話履歴】
${context.history?.map(m => `${m.role === 'user' ? '客' : 'ソムリエ'}: ${m.content}`).join('\n') || "なし"}

お客様：${userQuery}`;

  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 1000,
        temperature: 0.7,
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
    
    return `申し訳ございません。現在ソムリエが席を外しております。 (Error: ${detail.substring(0, 30)}...)`;
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
