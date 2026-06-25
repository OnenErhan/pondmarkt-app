-- ============================================================================
-- 0018_manual_restore_uses_production_snapshot.sql
-- Manuel urun stok cikisinda hammadde iadesini once son uretim snapshot'ina baglar
-- ============================================================================

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
  v_last_entry_id uuid;
  v_last_entry_qty numeric;
  v_used_snapshot boolean := false;
  r record;
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
    select pe.id, pe.qty
      into v_last_entry_id, v_last_entry_qty
    from public.production_entries pe
    where pe.variant_id = p_variant_id
      and coalesce(pe.voided, false) = false
    order by pe.date desc, pe.created_at desc
    limit 1;

    if v_last_entry_id is not null and coalesce(v_last_entry_qty, 0) > 0 then
      for r in
        select pc.material_id,
               sum(pc.qty) as qty
        from public.production_consumed pc
        where pc.entry_id = v_last_entry_id
        group by pc.material_id
      loop
        update public.materials
           set current_stock = current_stock + ((r.qty / v_last_entry_qty) * p_qty)
         where id = r.material_id;

        insert into public.material_stock_moves(date, material_id, type, qty, ref_type, note, created_by)
        values (
          coalesce(p_date, now()),
          r.material_id,
          'in',
          ((r.qty / v_last_entry_qty) * p_qty),
          'manual',
          coalesce(p_note, 'Manuel urun stok duzeltmesinden (son uretim snapshot) hammadde geri yukleme'),
          v_user
        );
      end loop;
      v_used_snapshot := true;
    end if;

    if not v_used_snapshot then
      for r in
        select *
        from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, true)
      loop
        update public.materials
           set current_stock = current_stock + r.qty
         where id = r.material_id;

        insert into public.material_stock_moves(date, material_id, type, qty, ref_type, note, created_by)
        values (
          coalesce(p_date, now()),
          r.material_id,
          'in',
          r.qty,
          'manual',
          coalesce(p_note, 'Manuel urun stok duzeltmesinden hammadde geri yukleme'),
          v_user
        );
      end loop;
    end if;
  end if;

  insert into public.product_stock_moves(date, variant_id, type, qty, source, customer, order_no, unit_price, note, created_by)
  values (coalesce(p_date, now()), p_variant_id, p_type, p_qty, p_source, p_customer, p_order_no, p_unit_price, p_note, v_user)
  returning id into v_id;

  return v_id;
end;
$$;