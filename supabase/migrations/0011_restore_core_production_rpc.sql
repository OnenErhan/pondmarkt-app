-- ============================================================================
-- 0011_restore_core_production_rpc.sql
-- 0008 ile degismis olabilecek temel tam mamul RPC'lerini stabil surume geri alir.
-- ============================================================================

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

  insert into public.production_entries(date, variant_id, qty, recipe_version, operator_note, created_by)
  values (p_date, p_variant_id, p_qty, v_recipe_version, p_note, v_user)
  returning id into v_entry_id;

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

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'production_entry', v_entry_id, v_user);

  return v_entry_id;
end;
$$;

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
    raise exception 'Urun stogu iptal icin yetersiz (mevcut: %, gerekli: %). Once satis kaydini iptal edin.',
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
