export interface WineMaster {
  id: string;
  name_jp: string;
  name_en: string;
  country: string;
  country_en: string;
  region: string;
  region_en: string;
  grape: string;
  grape_en: string;
  color: string;
  color_en: string;
  type: string;
  type_en: string;
  vintage: string;
  alcohol: string;
  price_bottle: number;
  price_glass: number;
  cost: number;
  stock: number;
  ideal_stock: number;
  supplier: string;
  storage: string;
  storage_en: string;
  ai_explanation: string;
  ai_explanation_en: string;
  menu_short: string;
  menu_short_en: string;
  pairing: string;
  pairing_en: string;
  sweetness: number;
  body: number;
  acidity: number;
  tannins: number;
  aroma_intensity: number;
  complexity: number;
  finish: number;
  oak: number;
  aroma_features: string;
  aroma_features_en: string;
  tags: string;
  tags_en: string;
  best_drinking: string;
  best_drinking_en: string;
  image_url: string;
  visible: boolean;
  isActive?: boolean;
  glasses_per_bottle?: number;
  isFeatured?: boolean;
  promoLabel?: string;
}

export interface Store {
  id: string;
  name: string;
  repId: string;
  ownerId?: string;
  owner_email?: string;
  sales_rep_email?: string;
  cuisine_type: string;
  address?: string;
  isActive: boolean;
  hasAiSommelier: boolean;
  owner_api_key?: string;
  hidePairingFilter?: boolean;
  hideWinePairing?: boolean;
  budgetTiers?: number[];
}

export type Role = 'admin' | 'rep' | 'owner' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  storeId?: string; // For owners
}
