import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

const KEY = ['materials'];

export const MATERIAL_CATEGORIES = [
  { value: 'chemical', label: 'Kimyasal', color: 'chemical' },
  { value: 'accessory', label: 'Aksesuar', color: 'accessory' },
  { value: 'packaging', label: 'Ambalaj', color: 'packaging' },
];

export function useMaterials(category) {
  return useQuery({
    queryKey: [...KEY, category ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('materials').select('*, suppliers(name)').order('name');
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      // Strip joined/derived fields that don't exist as columns
      const {
        suppliers: _s,
        created_at: _c,
        updated_at: _u,
        ...cleaned
      } = payload;
      if (cleaned.supplier_id === '') cleaned.supplier_id = null;
      if (cleaned.last_price === '') cleaned.last_price = null;
      if (cleaned.id) {
        const { id, ...rest } = cleaned;
        const { error } = await supabase.from('materials').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { id: _id, ...insertRow } = cleaned;
        const { error } = await supabase.from('materials').insert(insertRow);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) {
        const msg = String(error.message ?? '');
        const recipeBlocked = /recipe_items_material_id_fkey/i.test(msg);
        const moveBlocked = /material_stock_moves_material_id_fkey|production_consumed_material_id_fkey/i.test(msg);

        if (recipeBlocked) {
          throw new Error('Bu hammadde recetelerde kullaniliyor. Once recetelerden kaldirip tekrar deneyin.');
        }
        if (moveBlocked) {
          throw new Error('Bu hammaddenin stok/uretim gecmisi var. Gecmis kayitlar nedeniyle silinemez.');
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAdjustMaterialStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ materialId, delta, note }) => {
      const { error } = await supabase.rpc('adjust_material_stock', {
        p_material_id: materialId,
        p_delta: delta,
        p_note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
