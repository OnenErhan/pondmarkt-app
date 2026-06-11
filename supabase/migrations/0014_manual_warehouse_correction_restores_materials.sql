create or replace function public.record_warehouse_move(
  p_variant_id uuid,
  p_type text,
  p_qty numeric,
  p_source text,
  p_customer text default null,
  p_order_no text default null,
  p_unit_price numeric default null,
  p_note text default null,
  p_date timestamptz default null,
  p_restore_materials boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_current numeric;
  v_recipe_id uuid;
  v_yield numeric;
  v_factor numeric;
  r record;
  v_consume numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan büyük olmalı';
  end if;
  if p_type not in ('in','out') then
    raise exception 'Geçersiz hareket tipi: %', p_type;
  end if;
  if p_source not in ('return','manual','sale','transfer') then
    raise exception 'Geçersiz kaynak: %', p_source;
  end if;

  if p_type = 'out' then
    select current_stock into v_current
      from public.product_variants where id = p_variant_id;
    if v_current < p_qty then
      raise exception 'Yetersiz ürün stoğu (mevcut: %, istenen: %)', v_current, p_qty;
    end if;
    update public.product_variants
       set current_stock = current_stock - p_qty
     where id = p_variant_id;
  else
    update public.product_variants
       set current_stock = current_stock + p_qty
     where id = p_variant_id;
  end if;

  if p_restore_materials and p_type = 'out' and p_source = 'manual' then
    select id, yield_qty
      into v_recipe_id, v_yield
    from public.recipes
    where variant_id = p_variant_id;

    if v_recipe_id is null then
      raise exception 'Bu varyant için reçete tanımlı değil; hammadde geri yüklenemedi';
    end if;

    if v_yield is null or v_yield <= 0 then
      v_yield := 1;
    end if;

    v_factor := p_qty / v_yield;

    for r in
      select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct
      from public.recipe_items ri
      where ri.recipe_id = v_recipe_id
    loop
      v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

      update public.materials
         set current_stock = current_stock + v_consume
       where id = r.material_id;

      insert into public.material_stock_moves(date, material_id, type, qty, ref_type, note, created_by)
      values (
        coalesce(p_date, now()),
        r.material_id,
        'in',
        v_consume,
        'manual',
        coalesce(p_note, 'Manuel urun stok duzeltmesinden hammadde geri yukleme'),
        v_user
      );
    end loop;
  end if;

  insert into public.product_stock_moves(date, variant_id, type, qty, source, customer, order_no, unit_price, note, created_by)
  values (coalesce(p_date, now()), p_variant_id, p_type, p_qty, p_source, p_customer, p_order_no, p_unit_price, p_note, v_user)
  returning id into v_id;

  return v_id;
end;
$$;