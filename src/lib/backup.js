import { supabase } from './supabase/client.js';

// Tables to back up (in dependency order for restore)
const TABLES = [
  'suppliers',
  'materials',
  'product_types',
  'product_sizes',
  'product_colors',
  'product_variants',
  'recipes',
  'recipe_items',
  'recipe_variant_items',
  'production_entries',
  'production_consumed',
  'production_consumed_variants',
  'material_stock_moves',
  'product_stock_moves',
];

async function fetchAll(table) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function exportBackup({ onProgress } = {}) {
  const result = {
    meta: {
      app: 'PondMarkt APP',
      version: 1,
      exported_at: new Date().toISOString(),
    },
    tables: {},
  };
  for (let i = 0; i < TABLES.length; i++) {
    const t = TABLES[i];
    onProgress?.({ current: i + 1, total: TABLES.length, table: t });
    result.tables[t] = await fetchAll(t);
  }
  return result;
}

export function downloadBackup(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function summarizeBackup(data) {
  if (!data?.tables) return null;
  return Object.entries(data.tables).map(([table, rows]) => ({
    table,
    count: Array.isArray(rows) ? rows.length : 0,
  }));
}
