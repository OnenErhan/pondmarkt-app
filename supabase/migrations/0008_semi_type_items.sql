-- ============================================================================
-- 0008_semi_type_items.sql
-- Yari mamul bilesenlerini varyant degil urun turu bazinda tanimlama
-- ============================================================================

create table if not exists public.recipe_type_items (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  input_product_type_id uuid not null references public.product_types(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  wastage_pct numeric(5,2) not null default 0,
  primary key (recipe_id, input_product_type_id)
);

create index if not exists idx_recipe_type_items_input_type
  on public.recipe_type_items(input_product_type_id);

alter table public.recipe_type_items enable row level security;

drop policy if exists auth_all_recipe_type_items on public.recipe_type_items;
create policy auth_all_recipe_type_items
  on public.recipe_type_items
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- record_production: hammadde + yari mamul (tur bazli) tuketimi
-- Not: Geri uyumluluk icin recipe_variant_items da tuketilir.
-- ----------------------------------------------------------------------------
create or replace function public.record_production(
  p_variant_id uuid,
  p_qty numeric,
  p_date date default current_date,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_recipe_version integer;
  v_yield numeric;
  v_entry_id uuid;
  v_user uuid := auth.uid();
  r record;
  v_consume numeric;
  v_factor numeric;
  v_out_size_id uuid;
  v_out_color_id uuid;
  v_input_variant_id uuid;
  v_input_sku text;
  v_input_stock numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan buyuk olmali';
  end if;

  select id, version, yield_qty
    into v_recipe_id, v_recipe_version, v_yield
  from public.recipes
  where variant_id = p_variant_id;

  if v_recipe_id is null then
    raise exception 'Bu varyant icin recete tanimli degil';
  end if;

  if v_yield is null or v_yield <= 0 then
    v_yield := 1;
  end if;

  select size_id, color_id
    into v_out_size_id, v_out_color_id
  from public.product_variants
  where id = p_variant_id;

  if v_out_size_id is null or v_out_color_id is null then
    raise exception 'Cikis varyanti bulunamadi';
  end if;

  v_factor := p_qty / v_yield;

  -- Hammadde stok yeterlilik kontrolu
  for r in
    select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct,
           m.current_stock, m.name
    from public.recipe_items ri
    join public.materials m on m.id = ri.material_id
    where ri.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);
    if r.current_stock < v_consume then
      raise exception 'Yetersiz stok: % (mevcut: %, gerekli: %)',
        r.name, r.current_stock, v_consume;
    end if;
  end loop;

  -- Yari mamul stok yeterlilik kontrolu (tur bazli)
  for r in
    select rti.input_product_type_id, rti.qty, coalesce(rti.wastage_pct, 0) as wastage_pct,
           pt.name as type_name
    from public.recipe_type_items rti
    join public.product_types pt on pt.id = rti.input_product_type_id
    where rti.recipe_id = v_recipe_id
  loop
    select pv.id, pv.sku, pv.current_stock
      into v_input_variant_id, v_input_sku, v_input_stock
    from public.product_variants pv
    where pv.product_type_id = r.input_product_type_id
      and pv.size_id = v_out_size_id
      and pv.color_id = v_out_color_id
    limit 1;

    if v_input_variant_id is null then
      raise exception 'Yari mamul turu icin uyumlu varyant bulunamadi: % (ayni beden/renk gerekli)',
        r.type_name;
    end if;

    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);
    if v_input_stock < v_consume then
      raise exception 'Yetersiz yari mamul stogu: % (mevcut: %, gerekli: %)',
        v_input_sku, v_input_stock, v_consume;
    end if;
  end loop;

  -- Geri uyumluluk: eski varyant bazli satirlarin kontrolu
  for r in
    select rvi.input_variant_id, rvi.qty, coalesce(rvi.wastage_pct, 0) as wastage_pct,
           pv.current_stock, pv.sku
    from public.recipe_variant_items rvi
    join public.product_variants pv on pv.id = rvi.input_variant_id
    where rvi.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);
    if r.current_stock < v_consume then
      raise exception 'Yetersiz yari mamul stogu: % (mevcut: %, gerekli: %)',
        r.sku, r.current_stock, v_consume;
    end if;
  end loop;

  insert into public.production_entries(date, variant_id, qty, recipe_version, operator_note, created_by, entry_kind)
  values (p_date, p_variant_id, p_qty, v_recipe_version, p_note, v_user, 'full')
  returning id into v_entry_id;

  -- Hammadde tuketimi
  for r in
    select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct
    from public.recipe_items ri
    where ri.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

    update public.materials
       set current_stock = current_stock - v_consume
     where id = r.material_id;

    insert into public.production_consumed(entry_id, material_id, qty)
    values (v_entry_id, r.material_id, v_consume);

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', v_consume, 'production', v_entry_id, null, v_user);
  end loop;

  -- Yari mamul tuketimi (tur bazli)
  for r in
    select rti.input_product_type_id, rti.qty, coalesce(rti.wastage_pct, 0) as wastage_pct
    from public.recipe_type_items rti
    where rti.recipe_id = v_recipe_id
  loop
    select pv.id, pv.sku
      into v_input_variant_id, v_input_sku
    from public.product_variants pv
    where pv.product_type_id = r.input_product_type_id
      and pv.size_id = v_out_size_id
      and pv.color_id = v_out_color_id
    limit 1;

    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

    update public.product_variants
       set current_stock = current_stock - v_consume
     where id = v_input_variant_id;

    insert into public.production_consumed_variants(entry_id, variant_id, qty)
    values (v_entry_id, v_input_variant_id, v_consume)
    on conflict (entry_id, variant_id)
    do update set qty = public.production_consumed_variants.qty + excluded.qty;

    insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
    values (v_input_variant_id, 'out', v_consume, 'production', 'production_entry', v_entry_id, 'Tam mamul uretiminde tuketildi', v_user);
  end loop;

  -- Geri uyumluluk: eski varyant bazli satirlarin tuketimi
  for r in
    select rvi.input_variant_id, rvi.qty, coalesce(rvi.wastage_pct, 0) as wastage_pct
    from public.recipe_variant_items rvi
    where rvi.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

    update public.product_variants
       set current_stock = current_stock - v_consume
     where id = r.input_variant_id;

    insert into public.production_consumed_variants(entry_id, variant_id, qty)
    values (v_entry_id, r.input_variant_id, v_consume)
    on conflict (entry_id, variant_id)
    do update set qty = public.production_consumed_variants.qty + excluded.qty;

    insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
    values (r.input_variant_id, 'out', v_consume, 'production', 'production_entry', v_entry_id, 'Tam mamul uretiminde tuketildi', v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'production_entry', v_entry_id, v_user);

  return v_entry_id;
end;
$$;
