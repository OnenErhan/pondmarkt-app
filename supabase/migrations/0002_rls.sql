-- ============================================================================
-- 0002_rls.sql — Row Level Security politikaları
-- ============================================================================
-- Tek admin kullanıcısı ile başlıyoruz: giriş yapan herkes okur+yazar.
-- İleride operatör rolü için policy'ler genişletilebilir.
-- ============================================================================

alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.material_price_history enable row level security;
alter table public.product_types enable row level security;
alter table public.product_sizes enable row level security;
alter table public.product_colors enable row level security;
alter table public.product_variants enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_entries enable row level security;
alter table public.production_consumed enable row level security;
alter table public.material_stock_moves enable row level security;
alter table public.product_stock_moves enable row level security;
alter table public.app_settings enable row level security;

-- "Authenticated kullanıcı her şeyi yapabilir" politikası tüm tablolar için
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'suppliers','materials','material_price_history',
    'product_types','product_sizes','product_colors','product_variants',
    'recipes','recipe_items',
    'production_entries','production_consumed',
    'material_stock_moves','product_stock_moves',
    'app_settings'
  ]) loop
    execute format('drop policy if exists %I on public.%I', 'auth_all_'||t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'auth_all_'||t, t
    );
  end loop;
end $$;
