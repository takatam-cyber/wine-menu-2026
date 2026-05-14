export interface WineMaster {
  id: string;
  name_jp: string;
  name_en: string;
  country: string;
  region: string;
  grape: string;
  color: string;
  type: string;
  vintage: string;
  alcohol: string;
  price_bottle: number;
  price_glass: number;
  cost: number;
  stock: number;
  ideal_stock: number;
  supplier: string;
  storage: string;
  ai_explanation: string;
  ai_explanation_en?: string;
  menu_short: string;
  pairing: string;
  sweetness: number;
  body: number;
  acidity: number;
  tannins: number;
  aroma_intensity: number;
  complexity: number;
  finish: number;
  oak: number;
  aroma_features: string;
  tags: string;
  best_drinking: string;
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
