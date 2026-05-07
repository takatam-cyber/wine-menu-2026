import { WineMaster } from "../types";

export interface AISommelierResponse {
  message: string;
  buttons?: string[];
  wineIds?: string[];
}

/**
 * AIソムリエの助言を取得する (Proxy経由)
 */
export async function getSommelierAdvice(
  userQuery: string,
  _availableWines: WineMaster[], // Unused on client now
  context: { cuisine?: string; history?: { role: 'user' | 'ai'; content: string }[] } = {}
): Promise<AISommelierResponse> {
  try {
    const response = await fetch("/api/sommelier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userQuery,
        history: context.history
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "通信エラーが発生しました。");
    }

    return await response.json();

  } catch (error: any) {
    console.error("AI Sommelier Fetch Error:", error);
    const errorMessage = error.message || "不明なエラーが発生しました。";
    return {
      message: `ソムリエが席を外しております。しばらくしてからお声がけください。（エラー詳細: ${errorMessage}）`,
      buttons: ["最初から探す"]
    };
  }
}

/**
 * スタッフ向けセールストーク生成 (Proxy経由)
 */
export async function generateStaffTalkScript(wine: WineMaster) {
  try {
    const response = await fetch("/api/staff-talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wine })
    });
    if (!response.ok) throw new Error("生成に失敗しました");
    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Staff talk error:", error);
    return `【生成エラー】${error.message}`;
  }
}

/**
 * SNS投稿案生成 (Proxy経由)
 */
export async function generateSocialPost(wine: WineMaster) {
  try {
    const response = await fetch("/api/social-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wine })
    });
    if (!response.ok) throw new Error("生成に失敗しました");
    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Social post error:", error);
    return `【生成エラー】${error.message}`;
  }
}
