-- ============================================================================
-- 0019_semi_void_and_cost_snapshots.sql
-- Yari mamul uretim/birlestirme icin void RPC'leri ve maliyet snapshot tablolari
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
      'semi_component_assembly',
      'semi_component_production',
      'semi_component_assembly_void',
      'semi_component_production_void'
    )
  );

alter table public.semi_component_production_entries
  add column if not exists voided boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz;

create table if not exists public.semi_component_production_consumed (
  entry_id uuid not null references public.semi_component_production_entries(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  qty numeric(14,3) not null,
  primary key (entry_id, material_id)
);

create table if not exists public.semi_component_assembly_material_consumed (
  entry_id uuid not null references public.semi_component_assembly_entries(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  qty numeric(14,3) not null,
  primary key (entry_id, material_id)
);

alter table public.semi_component_production_consumed enable row level security;
alter table public.semi_component_assembly_material_consumed enable row level security;

drop policy if exists auth_all_semi_component_production_consumed on public.semi_component_production_consumed;
create policy auth_all_semi_component_production_consumed
  on public.semi_component_production_consumed
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_assembly_material_consumed on public.semi_component_assembly_material_consumed;
create policy auth_all_semi_component_assembly_material_consumed
  on public.semi_component_assembly_material_consumed
  for all
  to authenticated
  using (true)
  with check (true);

alter table public.semi_component_stock_moves
  drop constraint if exists semi_component_stock_moves_ref_type_check;

alter table public.semi_component_stock_moves
  add constraint semi_component_stock_moves_ref_type_check
  check (ref_type in ('semi_production', 'semi_production_void', 'assembly', 'assembly_void', 'manual'));

create or replace function public.record_semi_component_production(
  p_variant_id uuid,
  p_component_id uuid,
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
  v_variant_type uuid;
  v_component_type uuid;
  r record;
begin
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

  for r in
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, p_component_id, false, false)
  loop
    if r.current_stock < r.qty then
      raise exception 'Yetersiz hammadde stogu: % (mevcut: %, gerekli: %)',
        r.material_name, r.current_stock, r.qty;
    end if;
  end loop;

  insert into public.semi_component_production_entries(
    date, variant_id, component_id, qty, operator_note, created_by
  )
  values (p_date, p_variant_id, p_component_id, p_qty, p_note, v_user)
  returning id into v_entry_id;

  for r in
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, p_component_id, false, false)
  loop
    update public.materials
       set current_stock = current_stock - r.qty
     where id = r.material_id;

    insert into public.semi_component_production_consumed(entry_id, material_id, qty)
    values (v_entry_id, r.material_id, r.qty);

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', r.qty, 'semi_component_production', v_entry_id, p_note, v_user);
  end loop;

  insert into public.semi_component_stocks(variant_id, component_id, current_stock, updated_at)
  values (p_variant_id, p_component_id, p_qty, now())
  on conflict (variant_id, component_id)
  do update set
    current_stock = public.semi_component_stocks.current_stock + excluded.current_stock,
    updated_at = now();

  insert into public.semi_component_stock_moves(variant_id, component_id, type, qty, ref_type, ref_id, note, created_by)
  values (p_variant_id, p_component_id, 'in', p_qty, 'semi_production', v_entry_id, p_note, v_user);

  return v_entry_id;
end;
$$;

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

  perform 1
  from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, false)
  limit 1;

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
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, false)
  loop
    if r.current_stock < r.qty then
      raise exception 'Yetersiz hammadde stogu: % (mevcut: %, gerekli: %)',
        r.material_name, r.current_stock, r.qty;
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
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, false)
  loop
    update public.materials
       set current_stock = current_stock - r.qty
     where id = r.material_id;

    insert into public.semi_component_assembly_material_consumed(entry_id, material_id, qty)
    values (v_entry_id, r.material_id, r.qty);

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', r.qty, 'semi_component_assembly', v_entry_id, p_note, v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'semi_component_assembly', v_entry_id, p_note, v_user);

  return v_entry_id;
end;
$$;

create or replace function public.void_semi_component_production(
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
  v_component_stock numeric;
  r record;
begin
  select * into v_entry
  from public.semi_component_production_entries
  where id = p_entry_id;

  if v_entry is null then
    raise exception 'Yari mamul uretim kaydi bulunamadi';
  end if;
  if v_entry.voided then
    raise exception 'Bu yari mamul uretimi zaten iptal edilmis';
  end if;

  select current_stock into v_component_stock
  from public.semi_component_stocks
  where variant_id = v_entry.variant_id
    and component_id = v_entry.component_id;

  if coalesce(v_component_stock, 0) < v_entry.qty then
    raise exception 'Yari mamul parca stogu iptal icin yetersiz (mevcut: %, gerekli: %)',
      coalesce(v_component_stock, 0), v_entry.qty;
  end if;

  for r in
    select material_id, qty
    from public.semi_component_production_consumed
    where entry_id = p_entry_id
  loop
    update public.materials
       set current_stock = current_stock + r.qty
     where id = r.material_id;

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'in', r.qty, 'semi_component_production_void', p_entry_id, p_reason, v_user);
  end loop;

  update public.semi_component_stocks
     set current_stock = current_stock - v_entry.qty,
         updated_at = now()
   where variant_id = v_entry.variant_id
     and component_id = v_entry.component_id;

  insert into public.semi_component_stock_moves(variant_id, component_id, type, qty, ref_type, ref_id, note, created_by)
  values (v_entry.variant_id, v_entry.component_id, 'out', v_entry.qty, 'semi_production_void', p_entry_id, p_reason, v_user);

  update public.semi_component_production_entries
     set voided = true,
         void_reason = p_reason,
         voided_at = now()
   where id = p_entry_id;
end;
$$;

create or replace function public.void_semi_component_assembly(
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
  v_variant_stock numeric;
  r record;
begin
  select * into v_entry
  from public.semi_component_assembly_entries
  where id = p_entry_id;

  if v_entry is null then
    raise exception 'Birlestirme kaydi bulunamadi';
  end if;
  if v_entry.voided then
    raise exception 'Bu birlestirme zaten iptal edilmis';
  end if;

  select current_stock into v_variant_stock
  from public.product_variants
  where id = v_entry.variant_id;

  if coalesce(v_variant_stock, 0) < v_entry.qty then
    raise exception 'Urun stogu iptal icin yetersiz (mevcut: %, gerekli: %)',
      coalesce(v_variant_stock, 0), v_entry.qty;
  end if;

  for r in
    select component_id, qty
    from public.semi_component_assembly_consumed
    where entry_id = p_entry_id
  loop
    insert into public.semi_component_stocks(variant_id, component_id, current_stock, updated_at)
    values (v_entry.variant_id, r.component_id, r.qty, now())
    on conflict (variant_id, component_id)
    do update set
      current_stock = public.semi_component_stocks.current_stock + excluded.current_stock,
      updated_at = now();

    insert into public.semi_component_stock_moves(variant_id, component_id, type, qty, ref_type, ref_id, note, created_by)
    values (v_entry.variant_id, r.component_id, 'in', r.qty, 'assembly_void', p_entry_id, p_reason, v_user);
  end loop;

  for r in
    select material_id, qty
    from public.semi_component_assembly_material_consumed
    where entry_id = p_entry_id
  loop
    update public.materials
       set current_stock = current_stock + r.qty
     where id = r.material_id;

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'in', r.qty, 'semi_component_assembly_void', p_entry_id, p_reason, v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock - v_entry.qty
   where id = v_entry.variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (v_entry.variant_id, 'out', v_entry.qty, 'production_void', 'semi_component_assembly', p_entry_id, p_reason, v_user);

  update public.semi_component_assembly_entries
     set voided = true,
         void_reason = p_reason,
         voided_at = now()
   where id = p_entry_id;
end;
$$;