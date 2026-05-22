-- ============================================================================
-- 0013_semi_assembly_consumes_materials.sql
-- Yari mamul birlestirme sirasinda recetedeki hammaddeleri de kontrol eder ve duser
-- ============================================================================

alter table public.material_stock_moves
  drop constraint if exists material_stock_moves_ref_type_check;

alter table public.material_stock_moves
  add constraint material_stock_moves_ref_type_check
  check (
    ref_type in (
      'purchase',
      'production',
      'production_void',
      'manual',
      'adjust',
      'semi_component_assembly'
    )
  );

create or replace function public.record_semi_component_assembly(
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
  v_type_id uuid;
  v_recipe_id uuid;
  v_yield numeric;
  v_factor numeric;
  r record;
  v_consume numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan buyuk olmali';
  end if;

  select product_type_id into v_type_id
    from public.product_variants
    where id = p_variant_id;

  if v_type_id is null then
    raise exception 'Varyant bulunamadi';
  end if;

  if not exists (
    select 1 from public.product_type_semi_components c where c.product_type_id = v_type_id
  ) then
    raise exception 'Bu urun turu icin parca tanimi yok';
  end if;

  select id, yield_qty
    into v_recipe_id, v_yield
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
    select c.id, c.name, c.required_qty, coalesce(s.current_stock, 0) as current_stock
    from public.product_type_semi_components c
    left join public.semi_component_stocks s
      on s.component_id = c.id and s.variant_id = p_variant_id
    where c.product_type_id = v_type_id
  loop
    v_consume := r.required_qty * p_qty;
    if r.current_stock < v_consume then
      raise exception 'Yetersiz parca stogu: % (mevcut: %, gerekli: %)',
        r.name, r.current_stock, v_consume;
    end if;
  end loop;

  for r in
    select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct,
           m.current_stock, m.name
    from public.recipe_items ri
    join public.materials m on m.id = ri.material_id
    where ri.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);
    if r.current_stock < v_consume then
      raise exception 'Yetersiz hammadde stogu: % (mevcut: %, gerekli: %)',
        r.name, r.current_stock, v_consume;
    end if;
  end loop;

  insert into public.semi_component_assembly_entries(date, variant_id, qty, operator_note, created_by)
  values (p_date, p_variant_id, p_qty, p_note, v_user)
  returning id into v_entry_id;

  for r in
    select c.id, c.name, c.required_qty
    from public.product_type_semi_components c
    where c.product_type_id = v_type_id
  loop
    v_consume := r.required_qty * p_qty;

    update public.semi_component_stocks
       set current_stock = current_stock - v_consume,
           updated_at = now()
     where variant_id = p_variant_id
       and component_id = r.id;

    insert into public.semi_component_assembly_consumed(entry_id, variant_id, component_id, qty)
    values (v_entry_id, p_variant_id, r.id, v_consume);

    insert into public.semi_component_stock_moves(variant_id, component_id, type, qty, ref_type, ref_id, note, created_by)
    values (p_variant_id, r.id, 'out', v_consume, 'assembly', v_entry_id, 'Tam mamule birlestirildi', v_user);
  end loop;

  for r in
    select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct
    from public.recipe_items ri
    where ri.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

    update public.materials
       set current_stock = current_stock - v_consume
     where id = r.material_id;

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', v_consume, 'semi_component_assembly', v_entry_id, p_note, v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'semi_component_assembly', v_entry_id, p_note, v_user);

  return v_entry_id;
end;
$$;
