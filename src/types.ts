// ============================================================================
// Pieroth Smart Menu Engine - コア型定義ファイル
// ============================================================================

/**
 * ワインマスターデータ構造
 * ピーロート・ジャパン自社商品および他社インポート商品の全属性を包含
 */
export interface WineMaster {
  id: string;                  // 複合ID (例: "PIEROTH_12345" または "OTHER_67890")
  pureId?: string;             // プレフィックスを除去した純粋な識別コード (例: "12345")
  name_jp: string;             // 商品名（日本語）
  name_en: string;             // 商品名（英語）
  country: string;             // 生産国（日本語）
  country_en: string;          // 生産国（英語）
  region: string;              // 地域・産地（日本語）
  region_en: string;           // 地域・産地（英語）
  grape: string;               // 主要ブドウ品種（日本語）
  grape_en: string;            // 主要ブドウ品種（英語）
  color: string;               // ワインの色（赤、白、泡、ロゼ）
  color_en: string;            // ワインの色（英語）
  type: string;                // タイプ・味わい（フルボディ、辛口など）
  type_en: string;             // タイプ・味わい（英語）
  vintage: string;             // ヴィンテージ（収穫年、または "NV"）
  alcohol: string;             // アルコール度数
  price_bottle: number;        // ボトル販売価格（店舗設定またはマスター参考価格）
  price_glass: number;         // グラス販売価格（店舗設定）
  cost: number;                // 仕入れ原価（税別）
  stock: number;               // 在庫数
  ideal_stock: number;         // 適正在庫数
  supplier: string;            // サプライヤー・インポーター（"PIEROTH" または "OTHER"）
  storage: string;             // 保存場所（セラー位置等）
  storage_en: string;          // 保存場所（英語）
  ai_explanation: string;      // AIソムリエによる詳細解説（日本語）
  ai_explanation_en: string;   // AIソムリエによる詳細解説（英語）
  menu_short: string;          // メニュー表示用略称（日本語）
  menu_short_en: string;       // メニュー表示用略称（英語）
  pairing: string;             // マリアージュ・おすすめ料理（日本語）
  pairing_en: string;          // マリアージュ・おすすめ料理（英語）
  sweetness: number;           // 甘味度（1〜5の5段階評価）
  body: number;                // コク・ボディ（1〜5の5段階評価）
  acidity: number;             // 酸味度（1〜5の5段階評価）
  tannins: number;             // 渋み・タンニン（1〜5の5段階評価）
  aroma_intensity: number;     // 香りの強さ（1〜5の5段階評価）
  complexity: number;          // 複雑さ・余韻（1〜5の5段階評価）
  finish: number;              // 余韻の長さ（1〜5の5段階評価）
  oak: number;                 // 樽感（1〜5の5段階評価）
  aroma_features: string;      // 香りの特徴（日本語記述）
  aroma_features_en: string;   // 香りの特徴（英語記述）
  tags: string;                // 検索用カスタムタグ（カンマ区切り）
  tags_en: string;             // 検索用カスタムタグ（英語）
  best_drinking: string;       // 飲み頃の時期
  best_drinking_en: string;    // 飲み頃の時期（英語）
  image_url: string;           // Google Drive等に格納されたオリジナル画像URL
  visible: boolean;            // 一般顧客メニューへの表示/非表示フラグ
  isActive?: boolean;          // 店舗での取り扱い有効/無効フラグ
  glasses_per_bottle?: number; // ボトル1本あたりの取れ高グラス杯数（通常6杯換算）
  isFeatured?: boolean;        // ソムリエおすすめフラグ（特集エリアに昇格）
  promoLabel?: string;         // メニュー上に表示する販促用ショートラベル
}

/**
 * レストラン店舗（ストア）メタデータ構造
 * 公開配信用キャッシュ snapshot `publicMenu` を内包
 */
export interface Store {
  id: string;                  // 店舗固有ID (Firestore Document ID)
  name: string;                // 店舗名
  repId: string;               // 担当営業（Sales Rep）のユーザーUID
  ownerId?: string;            // 店舗オーナーのユーザーUID
  owner_email?: string;        // 店舗オーナーのログインメールアドレス
  sales_rep_email?: string;    // 担当営業のメールアドレス
  cuisine_type: string;        // 料理ジャンル（フレンチ、イタリアン等）
  address?: string;            // 店舗所在地住所
  isActive: boolean;           // スマートメニューシステムの稼働状態
  hasAiSommelier: boolean;     // AIソムリエコンシェルジュ機能の有効化フラグ
  owner_api_key?: string;      // B2B外部連携用APIキー（オプショナル）
  hidePairingFilter?: boolean; // お料理ペアリングフィルターの非表示カスタマイズ
  hideWinePairing?: boolean;   // モーダル内マリアージュ詳細の非表示カスタマイズ
  budgetTiers?: number[];      // カスタマイズされた予算絞り込み閾値配列
  publicMenu?: WineMaster[];   // 1ドキュメントリード最適化のための非正規化メニュー配列
  allowedSuppliers?: string[]; // 閲覧・登録が許可されたサプライヤー制限リスト
}

/**
 * ユーザーロール権限
 */
export type Role = 'admin' | 'rep' | 'owner' | 'customer';

/**
 * 認証ユーザープロファイル構造
 */
export interface UserProfile {
  uid: string;                 // Firebase Authentication UID
  email: string;               // メールアドレス
  name: string;                // ユーザー名
  role: Role;                  // 割り当てられたシステム権限ロール
  storeId?: string;            // 店舗オーナー（owner）の場合に紐づく店舗ID
}

/**
 * 複合IDからインポータープレフィックスを安全に剥ぎ取り、純粋な商品コードを抽出するヘルパー
 * @param id 複合ID (例: "PIEROTH_10023")
 * @param supplier 明示的なサプライヤー名
 */
export function extractPureId(id: string, supplier?: string): string {
  if (!id) return '';
  const supp = (supplier || '').toUpperCase();
  if (supp && id.toUpperCase().startsWith(`${supp}_`)) {
    return id.substring(supp.length + 1);
  }
  // 大文字英数字プレフィックス + アンパサンドパターンの汎用フォールバックパース
  const match = id.match(/^[A-Z0-9]+_(.+)$/);
  if (match) {
    return match[1];
  }
  return id;
}
