-- ============================================================================
-- 0007_semi_finished_flow.sql
-- Yari mamul girisi + tam mamulde yari mamul bilesen tuketimi
-- ============================================================================

alter table public.production_entries
  add column if not exists entry_kind text not null default 'full'
  check (entry_kind in ('full', 'semi'));

-- Tam mamul recetesine yari mamul varyant bilesenleri ekleme
create table if not exists public.recipe_variant_items (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  input_variant_id uuid not null references public.product_variants(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  wastage_pct numeric(5,2) not null default 0,
  primary key (recipe_id, input_variant_id)
);

create index if not exists idx_recipe_variant_items_input
  on public.recipe_variant_items(input_variant_id);

-- Uretim esnasinda tuketilen yari mamul snapshot'i
create table if not exists public.production_consumed_variants (
  entry_id uuid not null references public.production_entries(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  qty numeric(14,3) not null,
  primary key (entry_id, variant_id)
);

alter table public.recipe_variant_items enable row level security;
alter table public.production_consumed_variants enable row level security;

drop policy if exists auth_all_recipe_variant_items on public.recipe_variant_items;
create policy auth_all_recipe_variant_items
  on public.recipe_variant_items
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_production_consumed_variants on public.production_consumed_variants;
create policy auth_all_production_consumed_variants
  on public.production_consumed_variants
  for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- record_production: tam mamul uretimi + recete bazli hammadde + yari mamul tuketimi
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

  -- Yari mamul stok yeterlilik kontrolu
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

  -- Yari mamul tuketimi
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
    values (v_entry_id, r.input_variant_id, v_consume);

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

-- ----------------------------------------------------------------------------
-- record_semi_production: yari mamul uretimi (hammadde tuketmeden stok artirir)
-- ----------------------------------------------------------------------------
create or replace function public.record_semi_production(
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
  v_entry_id uuid;
  v_user uuid := auth.uid();
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan buyuk olmali';
  end if;

  insert into public.production_entries(date, variant_id, qty, recipe_version, operator_note, created_by, entry_kind)
  values (p_date, p_variant_id, p_qty, 0, p_note, v_user, 'semi')
  returning id into v_entry_id;

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'production_entry', v_entry_id, 'Yari mamul uretimi', v_user);

  return v_entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- void_production: iptalde hammadde + yari mamul + urun stoklarini geri alir
-- ----------------------------------------------------------------------------
create or replace function public.void_production(
  p_entry_id uuid,
  p_reason text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry record;
  v_user uuid := auth.uid();
  r record;
  v_variant_stock numeric;
begin
  select * into v_entry from public.production_entries where id = p_entry_id;
  if v_entry is null then
    raise exception 'Uretim kaydi bulunamadi';
  end if;
  if v_entry.voided then
    raise exception 'Bu uretim zaten iptal edilmis';
  end if;

  select current_stock into v_variant_stock
    from public.product_variants where id = v_entry.variant_id;

  if v_variant_stock < v_entry.qty then
    raise exception 'Urun stogu iptal icin yetersiz (mevcut: %, gerekli: %). Once cikislari geri alin.',
      v_variant_stock, v_entry.qty;
  end if;

  for r in
    select material_id, qty from public.production_consumed
    where entry_id = p_entry_id
  loop
    update public.materials
       set current_stock = current_stock + r.qty
     where id = r.material_id;

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'in', r.qty, 'production_void', p_entry_id, p_reason, v_user);
  end loop;

  for r in
    select variant_id, qty from public.production_consumed_variants
    where entry_id = p_entry_id
  loop
    update public.product_variants
       set current_stock = current_stock + r.qty
     where id = r.variant_id;

    insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
    values (r.variant_id, 'in', r.qty, 'production_void', 'production_entry', p_entry_id, p_reason, v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock - v_entry.qty
   where id = v_entry.variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (v_entry.variant_id, 'out', v_entry.qty, 'production_void', 'production_entry', p_entry_id, p_reason, v_user);

  update public.production_entries
     set voided = true, void_reason = p_reason, voided_at = now()
   where id = p_entry_id;
end;
$$;
