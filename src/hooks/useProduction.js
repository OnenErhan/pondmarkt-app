import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

const KEY = ['production'];

// All product variants for selection (with type/size/color labels)
export function useAllVariants() {
  return useQuery({
    queryKey: ['variants', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(
          '*, product_types(id,code,name), product_sizes(id,label,code), product_colors(id,label,code,hex)',
        )
        .order('sku');
      if (error) throw error;
      return data;
    },
  });
}

export function useProductionList({ from, to, variantId } = {}) {
  return useQuery({
    queryKey: [...KEY, { from, to, variantId }],
    queryFn: async () => {
      let q = supabase
        .from('production_entries')
        .select(
          'id, date, qty, variant_id, entry_kind, operator_note, voided, voided_at, void_reason, created_at, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label)), production_consumed(qty, materials(last_price)), production_consumed_variants(qty, product_variants(sku))',
        )
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      if (variantId) q = q.eq('variant_id', variantId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useRecordProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, qty, date, note }) => {
      const { data, error } = await supabase.rpc('record_production', {
        p_variant_id: variantId,
        p_qty: qty,
        p_date: date ?? null,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['materials'] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
}

export function useRecordSemiProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, componentId, qty, date, note }) => {
      const { data, error } = await supabase.rpc('record_semi_component_production', {
        p_variant_id: variantId,
        p_component_id: componentId,
        p_qty: qty,
        p_date: date ?? null,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
}

export function useRecordSemiAssembly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, qty, date, note }) => {
      const { data, error } = await supabase.rpc('record_semi_component_assembly', {
        p_variant_id: variantId,
        p_qty: qty,
        p_date: date ?? null,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
}

export function useVoidProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, reason }) => {
      const { error } = await supabase.rpc('void_production', {
        p_entry_id: entryId,
        p_reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['materials'] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
}
