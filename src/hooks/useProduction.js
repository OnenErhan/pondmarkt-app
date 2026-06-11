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
      const applyFilters = (query) => {
        let q = query
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500);
        if (from) q = q.gte('date', from);
        if (to) q = q.lte('date', to);
        if (variantId) q = q.eq('variant_id', variantId);
        return q;
      };

      const latestQuery = applyFilters(
        supabase
          .from('production_entries')
          .select(
            'id, date, qty, variant_id, entry_kind, operator_note, voided, voided_at, void_reason, created_at, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label)), production_consumed(qty, materials(last_price)), production_consumed_variants(qty, product_variants(sku))',
          ),
      );
      const latest = await latestQuery;
      if (!latest.error) return latest.data;

      const legacyQuery = applyFilters(
        supabase
          .from('production_entries')
          .select(
            'id, date, qty, variant_id, operator_note, voided, voided_at, void_reason, created_at, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label)), production_consumed(qty, materials(last_price))',
          ),
      );
      const legacy = await legacyQuery;
      if (legacy.error) throw latest.error;

      return (legacy.data ?? []).map((row) => ({
        ...row,
        entry_kind: 'full',
        production_consumed_variants: [],
      }));
    },
  });
}

export function useSemiAssemblyList({ from, to, variantId } = {}) {
  return useQuery({
    queryKey: [...KEY, 'semi-assembly', { from, to, variantId }],
    queryFn: async () => {
      const applyFilters = (query) => {
        let q = query
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500);
        if (from) q = q.gte('date', from);
        if (to) q = q.lte('date', to);
        if (variantId) q = q.eq('variant_id', variantId);
        return q;
      };

      const isMissingRelationError = (err, relation) => {
        if (!err) return false;
        const text = [err.message, err.details, err.hint].filter(Boolean).join(' ');
        return err.code === '42P01' || new RegExp(`relation\\s+['"]?${relation}['"]?\\s+does\\s+not\\s+exist`, 'i').test(text);
      };

      const richQuery = applyFilters(
        supabase
          .from('semi_component_assembly_entries')
          .select(
            'id, date, qty, variant_id, operator_note, voided, voided_at, void_reason, created_at, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label)), semi_component_assembly_consumed(qty, product_type_semi_components(name))',
          ),
      );
      const rich = await richQuery;
      if (!rich.error) return rich.data ?? [];

      if (isMissingRelationError(rich.error, 'semi_component_assembly_consumed')) {
        const leanQuery = applyFilters(
          supabase
            .from('semi_component_assembly_entries')
            .select(
              'id, date, qty, variant_id, operator_note, voided, voided_at, void_reason, created_at, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label))',
            ),
        );
        const lean = await leanQuery;
        if (!lean.error) {
          return (lean.data ?? []).map((row) => ({
            ...row,
            semi_component_assembly_consumed: [],
          }));
        }
        if (!isMissingRelationError(lean.error, 'semi_component_assembly_entries')) {
          throw lean.error;
        }
      } else if (!isMissingRelationError(rich.error, 'semi_component_assembly_entries')) {
        throw rich.error;
      }

      // Legacy fallback for environments where component-based assembly tables are not migrated yet.
      const legacyQuery = applyFilters(
        supabase
          .from('production_entries')
          .select(
            'id, date, qty, variant_id, operator_note, voided, voided_at, void_reason, created_at, entry_kind, product_variants(sku, current_stock, product_types(name), product_sizes(label), product_colors(label))',
          )
          .in('entry_kind', ['semi', 'assembly']),
      );
      const legacy = await legacyQuery;
      if (legacy.error) throw legacy.error;
      return (legacy.data ?? []).map((row) => ({
        ...row,
        semi_component_assembly_consumed: [],
      }));
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
