-- ============================================================================
-- 0003_rpc.sql — Atomik iş kuralları (PL/pgSQL functions)
-- ============================================================================
-- Tüm fonksiyonlar transaction'lı, validation'lı ve SECURITY INVOKER
-- (kullanıcı yetkisiyle çalışır → RLS uygulanır).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- record_production: üretim girişi + reçete bazlı otomatik hammadde tüketimi
-- ----------------------------------------------------------------------------
-- Argümanlar:
--   p_variant_id uuid - üretilen varyant
--   p_qty numeric    - üretilen adet
--   p_date date      - üretim tarihi (default bugün)
--   p_note text      - opsiyonel not
-- Dönüş: yeni üretim entry id
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
  v_current numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Miktar 0''dan büyük olmalı';
  end if;

  -- Reçete kontrolü
  select id, version, yield_qty
    into v_recipe_id, v_recipe_version, v_yield
  from public.recipes
  where variant_id = p_variant_id;

  if v_recipe_id is null then
    raise exception 'Bu varyant için reçete tanımlı değil';
  end if;

  if v_yield is null or v_yield <= 0 then
    v_yield := 1;
  end if;

  -- Çarpan: kaç reçete partisi üretildi
  v_factor := p_qty / v_yield;

  -- Stok yeterli mi kontrolü (önce hepsini test et, sonra düş)
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

  -- Üretim entry'sini oluştur
  insert into public.production_entries(date, variant_id, qty, recipe_version, operator_note, created_by)
  values (p_date, p_variant_id, p_qty, v_recipe_version, p_note, v_user)
  returning id into v_entry_id;

  -- Her hammaddeyi düş + snapshot yaz + move kaydet
  for r in
    select ri.material_id, ri.qty, coalesce(ri.wastage_pct, 0) as wastage_pct
    from public.recipe_items ri
    where ri.recipe_id = v_recipe_id
  loop
    v_consume := r.qty * v_factor * (1 + r.wastage_pct / 100.0);

    -- Stok düş
    update public.materials
       set current_stock = current_stock - v_consume
     where id = r.material_id;

    -- Snapshot
    insert into public.production_consumed(entry_id, material_id, qty)
    values (v_entry_id, r.material_id, v_consume);

    -- Hareket
    insert into public.material_stock_moves(material_id, type, qty, ref_type, ref_id, note, created_by)
    values (r.material_id, 'out', v_consume, 'production', v_entry_id, null, v_user);
  end loop;

  -- Ürün stoğunu artır + giriş hareketi
  update public.product_variants
     set current_stock = current_stock + p_qty
   where id = p_variant_id;

  insert into public.product_stock_moves(variant_id, type, qty, source, ref_type, ref_id, created_by)
  values (p_variant_id, 'in', p_qty, 'production', 'production_entry', v_entry_id, v_user);

  return v_entry_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- void_production: üretim girişini iptal eder, snapshot'tan geri alır
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
    raise exception 'Üretim kaydı bulunamadı';
  end if;
  if v_entry.voided then
    raise exception 'Bu üretim zaten iptal edilmiş';
  end if;

  -- Ürün stoğu yeterli mi (üretim sonrası satış olduysa eksiye düşmesin)
  select current_stock into v_variant_stock
    from public.product_variants where id = v_entry.variant_id;

  if v_variant_stock < v_entry.qty then
    raise exception 'Ürün stoğu iptal için yetersiz (mevcut: %, gerekli: %). Önce satış kaydını iptal edin.',
      v_variant_stock, v_entry.qty;
  end if;

  -- Hammaddeleri snapshot'tan geri yükle
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

  -- Ürün stoğunu düşür
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

-- ----------------------------------------------------------------------------
-- record_material_intake: toplu hammadde alış girişi
-- ----------------------------------------------------------------------------
-- p_items örneği:
-- [
--   {"material_id":"...","qty":100,"unit_price":12.50,"supplier_id":"...","date":"2026-05-07","note":"..."},
--   ...
-- ]
-- ----------------------------------------------------------------------------
create or replace function public.record_material_intake(
  p_items jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
  it jsonb;
  v_material_id uuid;
  v_qty numeric;
  v_price numeric;
  v_supplier uuid;
  v_date timestamptz;
  v_note text;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'En az bir kalem gerekli';
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_material_id := (it->>'material_id')::uuid;
    v_qty := (it->>'qty')::numeric;
    v_price := nullif(it->>'unit_price','')::numeric;
    v_supplier := nullif(it->>'supplier_id','')::uuid;
    v_date := coalesce(nullif(it->>'date','')::timestamptz, now());
    v_note := nullif(it->>'note','');

    if v_material_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'Geçersiz alım kalemi: %', it;
    end if;

    update public.materials
       set current_stock = current_stock + v_qty,
           last_price = coalesce(v_price, last_price),
           supplier_id = coalesce(v_supplier, supplier_id)
     where id = v_material_id;

    insert into public.material_stock_moves(date, material_id, type, qty, ref_type, unit_price, supplier_id, note, created_by)
    values (v_date, v_material_id, 'in', v_qty, 'purchase', v_price, v_supplier, v_note, v_user);

    if v_price is not null then
      insert into public.material_price_history(material_id, price, currency, date, supplier_id, note)
      values (v_material_id, v_price, 'TRY', v_date::date, v_supplier, v_note);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- record_warehouse_move: ürün depo giriş/çıkış (satış, iade, manuel, transfer)
-- ----------------------------------------------------------------------------
create or replace function public.record_warehouse_move(
  p_variant_id uuid,
  p_type text,             -- 'in' veya 'out'
  p_qty numeric,
  p_source text,           -- 'return','manual','sale','transfer'
  p_customer text default null,
  p_order_no text default null,
  p_unit_price numeric default null,
  p_note text default null,
  p_date timestamptz default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_current numeric;
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

  insert into public.product_stock_moves(date, variant_id, type, qty, source, customer, order_no, unit_price, note, created_by)
  values (coalesce(p_date, now()), p_variant_id, p_type, p_qty, p_source, p_customer, p_order_no, p_unit_price, p_note, v_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- adjust_material_stock: manuel hammadde stok düzeltme (+ / -)
-- ----------------------------------------------------------------------------
create or replace function public.adjust_material_stock(
  p_material_id uuid,
  p_delta numeric,         -- pozitif = artır, negatif = azalt
  p_note text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current numeric;
  v_qty numeric;
  v_type text;
begin
  if p_delta = 0 then return; end if;

  select current_stock into v_current
    from public.materials where id = p_material_id;

  if v_current is null then
    raise exception 'Hammadde bulunamadı';
  end if;

  v_qty := abs(p_delta);
  v_type := case when p_delta > 0 then 'in' else 'out' end;

  if p_delta < 0 and v_current < v_qty then
    raise exception 'Stok yetersiz (mevcut: %, çıkış istenen: %)', v_current, v_qty;
  end if;

  update public.materials
     set current_stock = current_stock + p_delta
   where id = p_material_id;

  insert into public.material_stock_moves(material_id, type, qty, ref_type, note, created_by)
  values (p_material_id, v_type, v_qty, 'adjust', p_note, v_user);
end;
$$;
