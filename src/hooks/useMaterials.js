import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

const KEY = ['materials'];

function formatRecipeUsageLabel(variant) {
  if (!variant) return null;
  const sku = variant.sku ? String(variant.sku) : '';
  const typeName = variant.product_types?.name ? String(variant.product_types.name) : '';
  const size = variant.product_sizes?.label ? String(variant.product_sizes.label) : '';
  const color = variant.product_colors?.label ? String(variant.product_colors.label) : '';

  const detail = [typeName, size, color].filter(Boolean).join(' / ');
  if (sku && detail) return `${sku} (${detail})`;
  return sku || detail || null;
}

async function loadRecipeUsage(materialId) {
  const itemsRes = await supabase
    .from('recipe_items')
    .select('recipe_id')
    .eq('material_id', materialId)
    .limit(6);
  if (itemsRes.error) return [];

  const recipeIds = [...new Set((itemsRes.data ?? []).map((row) => row.recipe_id).filter(Boolean))];
  if (!recipeIds.length) return [];

  const recipesRes = await supabase.from('recipes').select('id, variant_id').in('id', recipeIds);
  if (recipesRes.error) return [];

  const variantIds = [...new Set((recipesRes.data ?? []).map((row) => row.variant_id).filter(Boolean))];
  if (!variantIds.length) return [];

  const variantsRes = await supabase
    .from('product_variants')
    .select('id, sku, product_types(name), product_sizes(label), product_colors(label)')
    .in('id', variantIds);
  if (variantsRes.error) return [];

  const variantById = new Map((variantsRes.data ?? []).map((variant) => [variant.id, variant]));
  const labels = (recipesRes.data ?? [])
    .map((recipe) => formatRecipeUsageLabel(variantById.get(recipe.variant_id)))
    .filter(Boolean);
  return [...new Set(labels)].slice(0, 5);
}

export const MATERIAL_CATEGORIES = [
  { value: 'chemical', label: 'Kimyasal', color: 'chemical' },
  { value: 'accessory', label: 'Aksesuar', color: 'accessory' },
  { value: 'packaging', label: 'Ambalaj', color: 'packaging' },
];

export function useMaterials(category) {
  return useQuery({
    queryKey: [...KEY, category ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('materials').select('*, suppliers(name)').eq('active', true).order('name');
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

async function archiveMaterial(id) {
  const { data, error } = await supabase
    .from('materials')
    .select('id, current_stock, active')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Silinecek hammadde bulunamadi.');
  if (!data.active) return { action: 'archived' };

  if (Number(data.current_stock || 0) !== 0) {
    throw new Error('Bu hammaddenin gecmisi var ve mevcut stok sifir degil. Once stogu sifirlayip tekrar deneyin.');
  }

  const { error: updateError } = await supabase.from('materials').update({ active: false }).eq('id', id);
  if (updateError) throw updateError;

  return { action: 'archived' };
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
    mutationFn: async (input) => {
      const id = typeof input === 'string' ? input : input?.id;
      if (!id) throw new Error('Silinecek hammadde bulunamadi.');

      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) {
        const msg = String(error.message ?? '');
        const recipeBlocked = /recipe_items_material_id_fkey/i.test(msg);
        const moveBlocked = /material_stock_moves_material_id_fkey|production_consumed_material_id_fkey/i.test(msg);

        if (recipeBlocked) {
          const usage = await loadRecipeUsage(id);
          if (usage.length) {
            throw new Error(`Bu hammadde recetelerde kullaniliyor: ${usage.join(', ')}. Once recetelerden kaldirip tekrar deneyin.`);
          }
          throw new Error('Bu hammadde recetelerde kullaniliyor. Once recetelerden kaldirip tekrar deneyin.');
        }
        if (moveBlocked) {
          return archiveMaterial(id);
        }
        throw error;
      }

      return { action: 'deleted' };
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
