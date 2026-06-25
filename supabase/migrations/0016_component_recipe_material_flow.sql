-- ============================================================================
-- 0016_component_recipe_material_flow.sql
-- Parca bazli recete satirlari ve yeni hammadde dusum mantigi
-- ============================================================================

create table if not exists public.recipe_component_items (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  component_id uuid not null references public.product_type_semi_components(id) on delete restrict,
  material_id uuid not null references public.materials(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  wastage_pct numeric(7,3) not null default 0 check (wastage_pct >= 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (recipe_id, component_id, material_id)
);

create index if not exists idx_recipe_component_items_recipe
  on public.recipe_component_items(recipe_id, component_id, sort_order, material_id);

alter table public.recipe_component_items enable row level security;

drop policy if exists auth_all_recipe_component_items on public.recipe_component_items;
create policy auth_all_recipe_component_items
  on public.recipe_component_items
  for all
  to authenticated
  using (true)
  with check (true);

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
      'semi_component_production'
    )
  );

create or replace function public.collect_recipe_material_requirements(
  p_variant_id uuid,
  p_qty numeric,
  p_component_id uuid default null,
  p_include_common boolean default true,
  p_expand_components boolean default false
) returns table(
  material_id uuid,
  qty numeric,
  material_name text,
  current_stock numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_yield numeric;
  v_type_id uuid;
  v_factor numeric;
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

  select id, yield_qty into v_recipe_id, v_yield
  from public.recipes
  where variant_id = p_variant_id;

  if v_recipe_id is null then
    raise exception 'Bu varyant icin recete tanimli degil';
  end if;

  if v_yield is null or v_yield <= 0 then
    v_yield := 1;
  end if;

  v_factor := p_qty / v_yield;

  return query
  with component_scope as (
    select c.id as component_id,
           case when p_component_id is not null then 1::numeric else c.required_qty end as multiplier
    from public.product_type_semi_components c
    where (
      p_component_id is not null
      and c.id = p_component_id
      and c.product_type_id = v_type_id
    )
    or (
      p_component_id is null
      and p_expand_components
      and c.product_type_id = v_type_id
    )
  ),
  raw_rows as (
    select ri.material_id,
           ri.qty * v_factor * (1 + coalesce(ri.wastage_pct, 0) / 100.0) as consume_qty
    from public.recipe_items ri
    where p_include_common
      and ri.recipe_id = v_recipe_id

    union all

    select rci.material_id,
           rci.qty * v_factor * cs.multiplier * (1 + coalesce(rci.wastage_pct, 0) / 100.0) as consume_qty
    from public.recipe_component_items rci
    join component_scope cs on cs.component_id = rci.component_id
    where rci.recipe_id = v_recipe_id
  ),
  aggregated as (
    select rr.material_id, sum(rr.consume_qty) as qty
    from raw_rows rr
    group by rr.material_id
  )
  select a.material_id, a.qty, m.name, m.current_stock
  from aggregated a
  join public.materials m on m.id = a.material_id
  where a.qty > 0;
end;
$$;

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
  v_recipe_version integer;
  v_entry_id uuid;
  v_user uuid := auth.uid();
  r record;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan buyuk olmali';
  end if;

  select version into v_recipe_version
  from public.recipes
  where variant_id = p_variant_id;

  if v_recipe_version is null then
    raise exception 'Bu varyant icin recete tanimli degil';
  end if;

  for r in
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, true)
  loop
    if r.current_stock < r.qty then
      raise exception 'Yetersiz stok: % (mevcut: %, gerekli: %)',
        r.material_name, r.current_stock, r.qty;
    end if;
  end loop;

  insert into public.production_entries(date, variant_id, qty, recipe_version, operator_note, created_by)
  values (p_date, p_variant_id, p_qty, v_recipe_version, p_note, v_user)
  returning id into v_entry_id;

  for r in
    select *
    from public.collect_recipe_material_requirements(p_variant_id, p_qty, null, true, true)
  loop
    update public.materials
       set current_stock = current_stock - r.qty
     where id = r.material_id;

    insert into public.production_consumed(entry_id, material_id, qty)
    values (v_entry_id, r.material_id, r.qty);

    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', r.qty, 'production', v_entry_id, null, v_user);
  end loop;

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'production_entry', v_entry_id, v_user);

  return v_entry_id;
end;
$$;

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

  insert into public.product_stock_moves(date, variant_id, type, qty, source, customer, order_no, unit_price, note, created_by)
  values (coalesce(p_date, now()), p_variant_id, p_type, p_qty, p_source, p_customer, p_order_no, p_unit_price, p_note, v_user)
  returning id into v_id;

  return v_id;
end;
$$;