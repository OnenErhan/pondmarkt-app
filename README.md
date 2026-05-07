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

`supabase/migrations/` altındaki dosyaları sırayla Supabase Dashboard → SQL Editor'da çalıştır:
1. `0001_init.sql` 2. `0002_rls.sql` 3. `0003_rpc.sql` 4. `0004_seed.sql` (ops.)

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

- Dashboard · Üretim Girişi (sihirbaz) · Üretim Geçmişi · Hammaddeler · Hammadde Alımı · Ürünler · Reçete · Depo · Depo Hareketleri · Raporlar · Ayarlar
