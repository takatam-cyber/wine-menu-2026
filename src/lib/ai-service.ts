import { WineMaster } from "../types";
import { auth } from "./firebase";

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

async function validateAndCall(fn: () => Promise<any>) {
  if (!isUserAuthorized()) {
    throw new Error("この操作を行う権限がありません。管理者アカウントでログインしてください。");
  }
  return fn();
}

export interface AISommelierResponse {
  message: string;
  buttons?: string[];
  wineIds?: string[];
}

/**
 * ソムリエとしてワインを提案する (Backend Proxy v2)
 */
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

  try {
    const response = await fetch("/api/sommelier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userQuery,
        wineContext,
        history: context.history
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "サーバーエラーが発生しました。");
    }

    return await response.json();
  } catch (error: any) {
    console.error("AI Sommelier Fetch Error:", error);
    return {
      message: "申し訳ございません。ソムリエを呼び出せませんでした。画面を更新するか、少し時間をお試しください。",
      buttons: ["最初から探す"]
    };
  }
}

/**
 * スタッフ向けのセールストーク案を作成する
 */
export async function generateStaffTalkScript(wine: WineMaster) {
  return validateAndCall(async () => {
    try {
      const response = await fetch("/api/staff-talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine })
      });
      if (!response.ok) throw new Error("トーク編集エラー");
      const data = await response.json();
      return data.text || "このワインは非常にお勧めです。";
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
    try {
      const response = await fetch("/api/social-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wine })
      });
      if (!response.ok) throw new Error("SNS生成エラー");
      const data = await response.json();
      return data.text || "特別なワインの時間。 #Wine";
    } catch (error: any) {
      console.error("Social post generation error:", error);
      return `【生成エラー】${error.message}`;
    }
  });
}
