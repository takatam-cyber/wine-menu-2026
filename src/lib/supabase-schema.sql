-- Pieroth Smart Menu Engine - Supabase Schema Definition

-- 1. Master Wine CSV Data
CREATE TABLE master_wines (
    id TEXT PRIMARY KEY,
    name_jp TEXT NOT NULL,
    name_en TEXT,
    country TEXT,
    region TEXT,
    grape TEXT,
    color TEXT,
    type TEXT,
    vintage TEXT,
    alcohol TEXT,
    cost DECIMAL(10, 2) DEFAULT 0,
    ai_explanation TEXT,
    menu_short TEXT,
    pairing TEXT,
    sweetness INTEGER,
    body INTEGER,
    acidity INTEGER,
    tannins INTEGER,
    aroma_intensity INTEGER,
    complexity INTEGER,
    finish INTEGER,
    oak INTEGER,
    aroma_features TEXT,
    tags TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stores Table
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_email TEXT NOT NULL UNIQUE,
    sales_rep_email TEXT NOT NULL, -- @pieroth.jp
    cuisine_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Store Inventory Table
CREATE TABLE store_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    wine_id TEXT REFERENCES master_wines(id),
    bottle_price INTEGER NOT NULL,
    glass_price INTEGER,
    is_visible BOOLEAN DEFAULT TRUE,
    stock_status TEXT DEFAULT 'in_stock', -- in_stock, low, out_of_stock
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, wine_id)
);

-- 4. Enable RLS (Security)
ALTER TABLE master_wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for Sales Reps (@pieroth.jp)
CREATE POLICY "Sales reps can manage everything" ON stores
    USING (auth.jwt() ->> 'email' LIKE '%@pieroth.jp');

-- Policies for Owners
CREATE POLICY "Owners can see their own store" ON stores
    FOR SELECT USING (auth.jwt() ->> 'email' = owner_email);

CREATE POLICY "Owners can manage their inventory" ON store_inventory
    USING (store_id IN (SELECT id FROM stores WHERE owner_email = auth.jwt() ->> 'email'));

-- Policies for Customers (Transparent / QR)
CREATE POLICY "Public can view inventory" ON store_inventory FOR SELECT USING (is_visible = TRUE);
CREATE POLICY "Public can view master wines" ON master_wines FOR SELECT USING (TRUE);
