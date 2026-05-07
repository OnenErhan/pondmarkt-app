-- ---------------------------------------------------------------
-- 0006_seed_pond_products.sql
-- POND ürün tiplerini ekle (Kapaklar / Merdivenler / Ayak Yıkama / Çatı Penceresi)
-- ---------------------------------------------------------------

-- ÖNEMLİ: Eğer eski test verileri (KAP, MRD) varsa ve hareket girilmediyse temizle.
-- Eğer üretim/satış girdiyseniz bu blogu çalıştırmayın.
-- delete from public.product_types where code in ('KAP', 'MRD');

insert into public.product_types (code, name, category, description) values
  ('KAP-BU', 'Beton Üzeri Kapak',  'POND KAPAKLAR',         'Beton zemin üzerine oturan tip'),
  ('KAP-BG', 'Betona Geçme Kapak', 'POND KAPAKLAR',         'Betona gömülen tip'),
  ('KAP-FN', 'Fonksiyonel Kapak',  'POND KAPAKLAR',         'Özel fonksiyonlu kapak'),
  ('MRD-DK', 'Dik Merdiven',       'POND MERDİVENLER',      'Dik tip merdiven'),
  ('MRD-YT', 'Yatık Merdiven',     'POND MERDİVENLER',      'Yatık tip merdiven'),
  ('AYK',    'Ayak Yıkama Küveti', 'POND AYAK YIKAMA',      null),
  ('CTP',    'Çatı Penceresi',     'POND ÇATI PENCERESİ',   null)
on conflict (code) do update
  set name = excluded.name,
      category = excluded.category,
      description = excluded.description;
