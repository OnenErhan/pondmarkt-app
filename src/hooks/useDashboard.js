import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
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
      // group
      const map = new Map();
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        map.set(key, 0);
      }
      (data || []).forEach((r) => {
        map.set(r.date, (map.get(r.date) || 0) + Number(r.qty));
      });
      return Array.from(map.entries()).map(([date, qty]) => ({ date, qty }));
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
