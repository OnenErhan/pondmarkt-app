-- ---------------------------------------------------------------
-- 0005_product_category.sql
-- product_types tablosuna ana grup (kategori) alanı ekle
-- ---------------------------------------------------------------

alter table public.product_types
  add column if not exists category text;

create index if not exists idx_product_types_category
  on public.product_types(category, name);
