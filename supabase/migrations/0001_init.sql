-- ============================================================================
-- 0001_init.sql — StockTrack şeması
-- ============================================================================
-- Hammadde, ürün, reçete, üretim ve stok hareketleri için tablolar.
-- Tüm tablolar uuid PK kullanır; numeric(14,3) miktarlar için yeterli hassasiyet.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Tedarikçiler
-- ----------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Hammaddeler
-- ----------------------------------------------------------------------------
create table if not exists public.materials (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  category text not null check (category in ('chemical', 'accessory', 'packaging')),
  unit text not null,
  current_stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  last_price numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materials_category on public.materials(category);

-- Hammadde fiyat geçmişi
create table if not exists public.material_price_history (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid not null references public.materials(id) on delete cascade,
  price numeric(14,2) not null,
  currency text not null default 'TRY',
  date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text
);

create index if not exists idx_price_history_material on public.material_price_history(material_id, date desc);

-- ----------------------------------------------------------------------------
-- Ürün yapısı: tür + boyut + renk → varyant
-- ----------------------------------------------------------------------------
create table if not exists public.product_types (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,         -- KAP, MRD vb. (SKU prefix)
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_sizes (
  id uuid primary key default uuid_generate_v4(),
  product_type_id uuid not null references public.product_types(id) on delete cascade,
  label text not null,               -- "Small"
  code text not null,                -- "S"
  value numeric(14,3),               -- opsiyonel sayısal değer (1, 5 vs)
  unit text,                         -- L, cm vs
  created_at timestamptz not null default now(),
  unique(product_type_id, code)
);

create table if not exists public.product_colors (
  id uuid primary key default uuid_generate_v4(),
  product_type_id uuid not null references public.product_types(id) on delete cascade,
  label text not null,               -- "Kırmızı"
  code text not null,                -- "KRM"
  hex text,                          -- "#ff0000"
  created_at timestamptz not null default now(),
  unique(product_type_id, code)
);

-- Varyant: type + size + color üçlüsü → SKU otomatik üretilir
create table if not exists public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_type_id uuid not null references public.product_types(id) on delete cascade,
  size_id uuid not null references public.product_sizes(id) on delete restrict,
  color_id uuid not null references public.product_colors(id) on delete restrict,
  sku text not null unique,
  barcode text not null unique,      -- Code128 için sku ile aynı
  current_stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_type_id, size_id, color_id)
);

create index if not exists idx_variants_type on public.product_variants(product_type_id);
create index if not exists idx_variants_barcode on public.product_variants(barcode);

-- ----------------------------------------------------------------------------
-- Reçeteler
-- ----------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  yield_qty numeric(14,3) not null default 1,  -- 1 reçete kaç adet üretir
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  qty numeric(14,3) not null,
  wastage_pct numeric(5,2) not null default 0,
  primary key (recipe_id, material_id)
);

create index if not exists idx_recipe_items_material on public.recipe_items(material_id);

-- ----------------------------------------------------------------------------
-- Üretim girişleri
-- ----------------------------------------------------------------------------
create table if not exists public.production_entries (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  recipe_version integer not null,
  operator_note text,
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_production_date on public.production_entries(date desc);
create index if not exists idx_production_variant on public.production_entries(variant_id);

-- Üretim sırasında tüketilen hammadde snapshot'ı (rapor bütünlüğü için kilitli)
create table if not exists public.production_consumed (
  entry_id uuid not null references public.production_entries(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  qty numeric(14,3) not null,
  primary key (entry_id, material_id)
);

-- ----------------------------------------------------------------------------
-- Stok hareketleri
-- ----------------------------------------------------------------------------
create table if not exists public.material_stock_moves (
  id uuid primary key default uuid_generate_v4(),
  date timestamptz not null default now(),
  material_id uuid not null references public.materials(id) on delete restrict,
  type text not null check (type in ('in', 'out', 'adjust')),
  qty numeric(14,3) not null check (qty > 0),
  ref_type text not null check (ref_type in ('purchase', 'production', 'production_void', 'manual', 'adjust')),
  ref_id uuid,
  unit_price numeric(14,2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_material_moves_material on public.material_stock_moves(material_id, date desc);
create index if not exists idx_material_moves_date on public.material_stock_moves(date desc);

create table if not exists public.product_stock_moves (
  id uuid primary key default uuid_generate_v4(),
  date timestamptz not null default now(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  type text not null check (type in ('in', 'out')),
  qty numeric(14,3) not null check (qty > 0),
  source text not null check (source in ('production', 'production_void', 'return', 'manual', 'sale', 'transfer')),
  ref_type text,
  ref_id uuid,
  customer text,
  order_no text,
  unit_price numeric(14,2),
  note text,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_product_moves_variant on public.product_stock_moves(variant_id, date desc);
create index if not exists idx_product_moves_date on public.product_stock_moves(date desc);
create index if not exists idx_product_moves_source on public.product_stock_moves(source);

-- ----------------------------------------------------------------------------
-- Uygulama ayarları (key-value)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_materials_updated on public.materials;
create trigger trg_materials_updated
  before update on public.materials
  for each row execute function public.touch_updated_at();
