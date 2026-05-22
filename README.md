# PondMarkt APP

Hammadde, üretim ve stok takip web uygulaması.

## Stack

- React 19 + Vite (JSX) · Tailwind v3
- Supabase (Postgres + Auth + RPC)
- @tanstack/react-query · zustand · react-hook-form
- xlsx · jspdf + bwip-js · vite-plugin-pwa

## Geliştirme

```powershell
npm install
npm run dev
```

`.env.local`:

```
VITE_SUPABASE_URL=https://<proje>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Migration

`supabase/migrations/` altındaki dosyaları sırayla Supabase Dashboard -> SQL Editor'da calistir:
1. `0001_init.sql`
2. `0002_rls.sql`
3. `0003_rpc.sql`
4. `0004_seed.sql` (ops.)
5. `0005_product_category.sql`
6. `0006_seed_pond_products.sql` (ops.)
7. `0007_semi_finished_flow.sql`
8. `0008_semi_type_items.sql`
9. `0010_component_based_semi_flow.sql`
10. `0011_restore_core_production_rpc.sql` (0008 calistirdiysan mutlaka)
11. `0012_semi_component_manual_moves.sql`
12. `0013_semi_assembly_consumes_materials.sql`

## Build & Deploy

```powershell
npm run build
```

Vercel:
1. GitHub'a push, Vercel → Import.
2. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. `vercel.json` SPA fallback sağlar.

## Yedek

Ayarlar → **Yedek İndir** ile tüm tablolar JSON olarak bilgisayara iner.

## Modüller

- Dashboard · Tam Mamul Uretim Girisi · Yari Mamul Uretim Girisi · Yari Mamul Birlestirme · Uretim Gecmisi · Hammaddeler · Hammadde Alimi · Urunler · Recete · Depo · Depo Hareketleri · Raporlar · Ayarlar
