-- ============================================================================
-- 0010_component_based_semi_flow.sql
-- Ek ozellik: urun turu parca bazli yari mamul uretim + birlestirme
-- Mevcut tam mamul record_production / void_production fonksiyonlarini EZMEZ.
-- ============================================================================

create table if not exists public.product_type_semi_components (
  id uuid primary key default uuid_generate_v4(),
  product_type_id uuid not null references public.product_types(id) on delete cascade,
  name text not null,
  required_qty numeric(14,3) not null default 1 check (required_qty > 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (product_type_id, name)
);

create index if not exists idx_product_type_semi_components_type
  on public.product_type_semi_components(product_type_id, sort_order, name);

create table if not exists public.semi_component_stocks (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  component_id uuid not null references public.product_type_semi_components(id) on delete cascade,
  current_stock numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (variant_id, component_id)
);

create table if not exists public.semi_component_stock_moves (
  id uuid primary key default uuid_generate_v4(),
  date timestamptz not null default now(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  component_id uuid not null references public.product_type_semi_components(id) on delete restrict,
  type text not null check (type in ('in', 'out', 'adjust')),
  qty numeric(14,3) not null check (qty > 0),
  ref_type text not null check (ref_type in ('semi_production', 'assembly', 'assembly_void', 'manual')),
  ref_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_semi_component_stock_moves_variant
  on public.semi_component_stock_moves(variant_id, component_id, date desc);

create table if not exists public.semi_component_production_entries (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  component_id uuid not null references public.product_type_semi_components(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  operator_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.semi_component_assembly_entries (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  qty numeric(14,3) not null check (qty > 0),
  operator_note text,
  voided boolean not null default false,
  void_reason text,
  voided_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.semi_component_assembly_consumed (
  entry_id uuid not null references public.semi_component_assembly_entries(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  component_id uuid not null references public.product_type_semi_components(id) on delete restrict,
  qty numeric(14,3) not null,
  primary key (entry_id, variant_id, component_id)
);

alter table public.product_type_semi_components enable row level security;
alter table public.semi_component_stocks enable row level security;
alter table public.semi_component_stock_moves enable row level security;
alter table public.semi_component_production_entries enable row level security;
alter table public.semi_component_assembly_entries enable row level security;
alter table public.semi_component_assembly_consumed enable row level security;

drop policy if exists auth_all_product_type_semi_components on public.product_type_semi_components;
create policy auth_all_product_type_semi_components
  on public.product_type_semi_components
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_stocks on public.semi_component_stocks;
create policy auth_all_semi_component_stocks
  on public.semi_component_stocks
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_stock_moves on public.semi_component_stock_moves;
create policy auth_all_semi_component_stock_moves
  on public.semi_component_stock_moves
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_production_entries on public.semi_component_production_entries;
create policy auth_all_semi_component_production_entries
  on public.semi_component_production_entries
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_assembly_entries on public.semi_component_assembly_entries;
create policy auth_all_semi_component_assembly_entries
  on public.semi_component_assembly_entries
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists auth_all_semi_component_assembly_consumed on public.semi_component_assembly_consumed;
create policy auth_all_semi_component_assembly_consumed
  on public.semi_component_assembly_consumed
  for all
  to authenticated
  using (true)
  with check (true);

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

  insert into public.semi_component_production_entries(
    date, variant_id, component_id, qty, operator_note, created_by
  )
  values (p_date, p_variant_id, p_component_id, p_qty, p_note, v_user)
  returning id into v_entry_id;

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

  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, note, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'semi_component_assembly', v_entry_id, p_note, v_user);

  return v_entry_id;
end;
$$;
