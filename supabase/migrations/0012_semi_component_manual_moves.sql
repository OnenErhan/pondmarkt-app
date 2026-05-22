-- ============================================================================
-- 0012_semi_component_manual_moves.sql
-- Yari mamul parca stoklari icin manuel giris/cikis hareketi
-- ============================================================================

create or replace function public.record_semi_component_manual_move(
  p_variant_id uuid,
  p_component_id uuid,
  p_type text,
  p_qty numeric,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_move_id uuid;
  v_user uuid := auth.uid();
  v_variant_type uuid;
  v_component_type uuid;
  v_current_stock numeric(14,3);
begin
  if p_type not in ('in', 'out', 'adjust') then
    raise exception 'Gecersiz hareket tipi';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan buyuk olmali';
  end if;

  select product_type_id into v_variant_type
    from public.product_variants
    where id = p_variant_id;

  if v_variant_type is null then
    raise exception 'Varyant bulunamadi';
  end if;

  select product_type_id into v_component_type
    from public.product_type_semi_components
    where id = p_component_id;

  if v_component_type is null then
    raise exception 'Parca tanimi bulunamadi';
  end if;

  if v_variant_type <> v_component_type then
    raise exception 'Secilen parca bu urun turune ait degil';
  end if;

  select current_stock into v_current_stock
    from public.semi_component_stocks
    where variant_id = p_variant_id
      and component_id = p_component_id
    for update;

  v_current_stock := coalesce(v_current_stock, 0);

  if p_type = 'out' and v_current_stock < p_qty then
    raise exception 'Yetersiz parca stogu';
  end if;

  insert into public.semi_component_stocks(variant_id, component_id, current_stock, updated_at)
  values (
    p_variant_id,
    p_component_id,
    case when p_type = 'in' then p_qty else 0 end,
    now()
  )
  on conflict (variant_id, component_id)
  do update set
    current_stock = case
      when p_type = 'in' then public.semi_component_stocks.current_stock + p_qty
      when p_type = 'out' then public.semi_component_stocks.current_stock - p_qty
      else p_qty
    end,
    updated_at = now();

  insert into public.semi_component_stock_moves(
    variant_id,
    component_id,
    type,
    qty,
    ref_type,
    note,
    created_by
  )
  values (
    p_variant_id,
    p_component_id,
    p_type,
    p_qty,
    'manual',
    p_note,
    v_user
  )
  returning id into v_move_id;

  return v_move_id;
end;
$$;
