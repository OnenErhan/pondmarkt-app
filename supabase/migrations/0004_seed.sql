-- ============================================================================
-- 0004_seed.sql — OPSİYONEL örnek veri (geliştirme için)
-- ============================================================================
-- Bu dosyayı sadece TEST ortamında çalıştırın.
-- Boş bir DB üzerinde çalıştırılmalı.
-- ============================================================================

-- Tedarikçiler
insert into public.suppliers (name, phone) values
  ('Akkim Kimya', '0212 555 1010'),
  ('Mavi Aksesuar', '0216 555 2020'),
  ('Plastik Ambalaj A.Ş.', '0224 555 3030')
on conflict do nothing;

-- Hammaddeler (3 kategori)
insert into public.materials (code, name, category, unit, current_stock, min_stock) values
  ('PLY-01', 'Polyester Reçine', 'chemical', 'kg', 0, 50),
  ('MEK-01', 'MEK Peroksit', 'chemical', 'lt', 0, 5),
  ('BOY-KRM', 'Pigment Boya - Kırmızı', 'chemical', 'kg', 0, 5),
  ('BOY-GRI', 'Pigment Boya - Gri', 'chemical', 'kg', 0, 5),
  ('BOY-BEJ', 'Pigment Boya - Bej', 'chemical', 'kg', 0, 5),
  ('MNT-B', 'Büyük Menteşe', 'accessory', 'adet', 0, 20),
  ('KLT-K', 'Küçük Kilit', 'accessory', 'adet', 0, 30),
  ('AMB-S', 'Ambalaj Karton - Küçük', 'packaging', 'adet', 0, 50),
  ('AMB-M', 'Ambalaj Karton - Orta', 'packaging', 'adet', 0, 50),
  ('AMB-L', 'Ambalaj Karton - Büyük', 'packaging', 'adet', 0, 30)
on conflict (code) do nothing;

-- Ürün türleri
insert into public.product_types (code, name) values
  ('KAP', 'Kapak'),
  ('MRD', 'Merdiven')
on conflict (code) do nothing;

-- Boyutlar (Kapak)
with t as (select id from public.product_types where code='KAP')
insert into public.product_sizes (product_type_id, label, code, value, unit)
select t.id, x.label, x.code, x.value, x.unit
from t, (values
  ('Small','S',1,'adet'),
  ('Medium','M',1,'adet'),
  ('Large','L',1,'adet')
) as x(label, code, value, unit)
on conflict do nothing;

-- Boyutlar (Merdiven)
with t as (select id from public.product_types where code='MRD')
insert into public.product_sizes (product_type_id, label, code, value, unit)
select t.id, x.label, x.code, x.value, x.unit
from t, (values
  ('3 Basamak','3B',3,'basamak'),
  ('5 Basamak','5B',5,'basamak')
) as x(label, code, value, unit)
on conflict do nothing;

-- Renkler (her iki tür için aynı renkler)
with t as (select id, code from public.product_types where code in ('KAP','MRD'))
insert into public.product_colors (product_type_id, label, code, hex)
select t.id, x.label, x.code, x.hex
from t, (values
  ('Kırmızı','KRM','#dc2626'),
  ('Gri','GRI','#6b7280'),
  ('Bej','BEJ','#e5d3b3')
) as x(label, code, hex)
on conflict do nothing;
