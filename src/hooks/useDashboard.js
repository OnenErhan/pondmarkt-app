import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function buildDateMap(days) {
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    map.set(d.toISOString().slice(0, 10), 0);
  }
  return map;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats', todayIso()],
    queryFn: async () => {
      const today = todayIso();
      const monthStart = monthStartIso();

      const [matAgg, varAgg, lowMat, todayProd, monthProd, todaySale, monthSale] =
        await Promise.all([
          supabase.from('materials').select('id, current_stock, min_stock, last_price'),
          supabase.from('product_variants').select('id, current_stock'),
          supabase
            .from('materials')
            .select('id, code, name, current_stock, min_stock, unit, category')
            .order('name'),
          supabase
            .from('production_entries')
            .select('qty')
            .eq('voided', false)
            .gte('date', today)
            .lte('date', today),
          supabase
            .from('production_entries')
            .select('qty')
            .eq('voided', false)
            .gte('date', monthStart)
            .lte('date', today),
          supabase
            .from('product_stock_moves')
            .select('qty, unit_price')
            .eq('type', 'out')
            .eq('source', 'sale')
            .gte('date', today)
            .lte('date', today + 'T23:59:59'),
          supabase
            .from('product_stock_moves')
            .select('qty, unit_price')
            .eq('type', 'out')
            .eq('source', 'sale')
            .gte('date', monthStart)
            .lte('date', today + 'T23:59:59'),
        ]);

      const err =
        matAgg.error ||
        varAgg.error ||
        lowMat.error ||
        todayProd.error ||
        monthProd.error ||
        todaySale.error ||
        monthSale.error;
      if (err) throw err;

      const materialValue = (matAgg.data || []).reduce(
        (s, m) => s + Number(m.current_stock || 0) * Number(m.last_price || 0),
        0,
      );
      const variantStock = (varAgg.data || []).reduce(
        (s, v) => s + Number(v.current_stock || 0),
        0,
      );
      const low = (lowMat.data || []).filter(
        (m) => Number(m.current_stock) <= Number(m.min_stock),
      );

      const sumQty = (rows) => (rows || []).reduce((s, r) => s + Number(r.qty || 0), 0);
      const sumRevenue = (rows) =>
        (rows || []).reduce(
          (s, r) => s + Number(r.qty || 0) * Number(r.unit_price || 0),
          0,
        );

      return {
        materialValue,
        variantStock,
        lowStockItems: low,
        todayProduction: sumQty(todayProd.data),
        monthProduction: sumQty(monthProd.data),
        todaySaleQty: sumQty(todaySale.data),
        monthSaleQty: sumQty(monthSale.data),
        todayRevenue: sumRevenue(todaySale.data),
        monthRevenue: sumRevenue(monthSale.data),
      };
    },
  });
}

// Daily series for charts (last N days)
export function useDailyProduction(days = 14) {
  return useQuery({
    queryKey: ['dashboard', 'daily-production', days],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      const fromIso = from.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('production_entries')
        .select('date, qty, voided')
        .eq('voided', false)
        .gte('date', fromIso)
        .order('date');
      if (error) throw error;
      const map = buildDateMap(days);
      (data || []).forEach((r) => {
        map.set(r.date, (map.get(r.date) || 0) + Number(r.qty));
      });
      return Array.from(map.entries()).map(([date, qty]) => ({ date, qty }));
    },
  });
}

// Daily production/sales/revenue series (last N days)
export function useDailyOps(days = 14) {
  return useQuery({
    queryKey: ['dashboard', 'daily-ops', days],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      const fromIso = from.toISOString().slice(0, 10);

      const [prod, sales] = await Promise.all([
        supabase
          .from('production_entries')
          .select('date, qty')
          .eq('voided', false)
          .gte('date', fromIso)
          .order('date'),
        supabase
          .from('product_stock_moves')
          .select('date, qty, unit_price')
          .eq('type', 'out')
          .eq('source', 'sale')
          .gte('date', fromIso)
          .order('date'),
      ]);

      if (prod.error) throw prod.error;
      if (sales.error) throw sales.error;

      const base = buildDateMap(days);
      const byDate = new Map();
      base.forEach((_, date) => {
        byDate.set(date, {
          date,
          productionQty: 0,
          saleQty: 0,
          saleRevenue: 0,
        });
      });

      (prod.data || []).forEach((r) => {
        const row = byDate.get(r.date);
        if (!row) return;
        row.productionQty += Number(r.qty || 0);
      });

      (sales.data || []).forEach((r) => {
        const day = String(r.date).slice(0, 10);
        const row = byDate.get(day);
        if (!row) return;
        const qty = Number(r.qty || 0);
        row.saleQty += qty;
        row.saleRevenue += qty * Number(r.unit_price || 0);
      });

      return Array.from(byDate.values());
    },
  });
}

// Activity check for "is production/sales active" status cards.
export function useOpsHealth() {
  return useQuery({
    queryKey: ['dashboard', 'ops-health', todayIso()],
    queryFn: async () => {
      const today = todayIso();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartIso = weekStart.toISOString().slice(0, 10);

      const [lastProd, lastSale, weeklyProd, weeklySale] = await Promise.all([
        supabase
          .from('production_entries')
          .select('date')
          .eq('voided', false)
          .order('date', { ascending: false })
          .limit(1),
        supabase
          .from('product_stock_moves')
          .select('date')
          .eq('type', 'out')
          .eq('source', 'sale')
          .order('date', { ascending: false })
          .limit(1),
        supabase
          .from('production_entries')
          .select('qty')
          .eq('voided', false)
          .gte('date', weekStartIso)
          .lte('date', today),
        supabase
          .from('product_stock_moves')
          .select('qty')
          .eq('type', 'out')
          .eq('source', 'sale')
          .gte('date', weekStartIso)
          .lte('date', today + 'T23:59:59'),
      ]);

      const err = lastProd.error || lastSale.error || weeklyProd.error || weeklySale.error;
      if (err) throw err;

      const weeklyProductionQty = (weeklyProd.data || []).reduce((s, r) => s + Number(r.qty || 0), 0);
      const weeklySaleQty = (weeklySale.data || []).reduce((s, r) => s + Number(r.qty || 0), 0);

      return {
        lastProductionDate: lastProd.data?.[0]?.date || null,
        lastSaleDate: lastSale.data?.[0]?.date || null,
        weeklyProductionQty,
        weeklySaleQty,
        productionActive: weeklyProductionQty > 0,
        saleActive: weeklySaleQty > 0,
      };
    },
  });
}

// Top selling variants
export function useTopVariants({ from, to, limit = 5 } = {}) {
  return useQuery({
    queryKey: ['dashboard', 'top-variants', from, to, limit],
    queryFn: async () => {
      let q = supabase
        .from('product_stock_moves')
        .select(
          'qty, unit_price, product_variants(sku, product_types(name), product_sizes(label), product_colors(label))',
        )
        .eq('type', 'out')
        .eq('source', 'sale');
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to + 'T23:59:59');
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map();
      (data || []).forEach((r) => {
        const key = r.product_variants?.sku ?? '?';
        const cur = map.get(key) || {
          sku: key,
          name: `${r.product_variants?.product_types?.name ?? ''} · ${r.product_variants?.product_colors?.label ?? ''} · ${r.product_variants?.product_sizes?.label ?? ''}`,
          qty: 0,
          revenue: 0,
        };
        cur.qty += Number(r.qty);
        cur.revenue += Number(r.qty) * Number(r.unit_price || 0);
        map.set(key, cur);
      });
      return Array.from(map.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit);
    },
  });
}
