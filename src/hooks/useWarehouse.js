import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

const KEY = ['warehouse'];

// Variant stock list (from variants joined with type/size/color)
export function useWarehouseStock(typeId) {
  return useQuery({
    queryKey: [...KEY, 'stock', typeId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('product_variants')
        .select(
          'id, sku, barcode, current_stock, product_types(id,code,name), product_sizes(label,code), product_colors(label,code,hex)',
        )
        .order('sku');
      if (typeId) q = q.eq('product_type_id', typeId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useSemiComponentWarehouseStock(typeId) {
  return useQuery({
    queryKey: [...KEY, 'semi-components', typeId ?? 'all'],
    queryFn: async () => {
      const q = supabase
        .from('semi_component_stocks')
        .select(
          'variant_id, component_id, current_stock, updated_at, product_variants(id, product_type_id, sku, product_types(id,name), product_sizes(label), product_colors(label,hex)), product_type_semi_components(id,name)',
        )
        .order('updated_at', { ascending: false })
        .limit(1000);

      const { data, error } = await q;
      if (!error) {
        if (!typeId) return data ?? [];
        return (data ?? []).filter((row) => row.product_variants?.product_type_id === typeId);
      }

      const tableMissing =
        error.code === '42P01' ||
        /semi_component_stocks|product_type_semi_components/i.test(error.message ?? '');
      if (tableMissing) return [];
      throw error;
    },
  });
}

export function useWarehouseMoves({ from, to, variantId, type, source } = {}) {
  return useQuery({
    queryKey: [...KEY, 'moves', { from, to, variantId, type, source }],
    queryFn: async () => {
      let q = supabase
        .from('product_stock_moves')
        .select(
          'id, date, type, source, qty, customer, order_no, unit_price, note, product_variants(sku, product_types(name), product_sizes(label), product_colors(label))',
        )
        .order('date', { ascending: false })
        .limit(500);
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      if (variantId) q = q.eq('variant_id', variantId);
      if (type) q = q.eq('type', type);
      if (source) q = q.eq('source', source);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useRecordWarehouseMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      variantId,
      type,
      qty,
      source,
      customer,
      orderNo,
      unitPrice,
      note,
      date,
      restoreMaterials,
    }) => {
      const params = {
        p_variant_id: variantId,
        p_type: type,
        p_qty: qty,
        p_source: source,
        p_customer: customer ?? null,
        p_order_no: orderNo ?? null,
        p_unit_price: unitPrice ?? null,
        p_note: note ?? null,
        p_date: date ?? null,
      };

      const wantsRestore = restoreMaterials === true;
      const call = (rpcParams) => supabase.rpc('record_warehouse_move', rpcParams);

      let { data, error } = await call({
        ...params,
        p_restore_materials: wantsRestore,
      });

      const missingNewSignature =
        error &&
        (error.code === 'PGRST202' || /Could not find the function .*record_warehouse_move/i.test(error.message ?? ''));

      if (missingNewSignature && !wantsRestore) {
        // Backward compatibility: environments without 0014 still have the old 9-arg signature.
        ({ data, error } = await call(params));
      }

      if (missingNewSignature && wantsRestore) {
        throw new Error('Hammadde geri yukleme icin veritabani migrationi eksik. 0014 migrationini Supabase tarafinda uygulayin.');
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRecordSemiComponentMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, componentId, type, qty, note }) => {
      const { data, error } = await supabase.rpc('record_semi_component_manual_move', {
        p_variant_id: variantId,
        p_component_id: componentId,
        p_type: type,
        p_qty: qty,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMaterialMoves({ from, to, materialId, type } = {}) {
  return useQuery({
    queryKey: ['material_moves', { from, to, materialId, type }],
    queryFn: async () => {
      let q = supabase
        .from('material_stock_moves')
        .select('id, date, type, qty, unit_price, note, materials(code,name,unit), suppliers(name)')
        .order('date', { ascending: false })
        .limit(500);
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      if (materialId) q = q.eq('material_id', materialId);
      if (type) q = q.eq('type', type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useRecordMaterialIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items }) => {
      // items: [{ material_id, qty, unit_price?, supplier_id?, note? }]
      const { data, error } = await supabase.rpc('record_material_intake', {
        p_items: items,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      qc.invalidateQueries({ queryKey: ['material_moves'] });
    },
  });
}
