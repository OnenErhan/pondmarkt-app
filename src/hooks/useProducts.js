import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client.js';

export function buildSku(typeCode, colorCode, sizeCode) {
  return [typeCode, colorCode, sizeCode]
    .map((s) => (s ?? '').toString().trim().toUpperCase())
    .filter(Boolean)
    .join('-');
}

export function useProductTypes() {
  return useQuery({
    queryKey: ['product_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_types').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useProductTypeDetail(typeId) {
  return useQuery({
    queryKey: ['product_types', typeId, 'detail'],
    enabled: !!typeId,
    queryFn: async () => {
      const [tp, sz, cl, vr] = await Promise.all([
        supabase.from('product_types').select('*').eq('id', typeId).single(),
        supabase.from('product_sizes').select('*').eq('product_type_id', typeId).order('label'),
        supabase.from('product_colors').select('*').eq('product_type_id', typeId).order('label'),
        supabase
          .from('product_variants')
          .select('*, product_sizes(label,code), product_colors(label,code,hex)')
          .eq('product_type_id', typeId),
      ]);
      const err = tp.error || sz.error || cl.error || vr.error;
      if (err) throw err;
      return { type: tp.data, sizes: sz.data, colors: cl.data, variants: vr.data };
    },
  });
}

export function useSaveProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('product_types').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_types').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_types'] }),
  });
}

export function useDeleteProductType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('product_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_types'] }),
  });
}

export function useSaveSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('product_sizes').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_sizes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.product_type_id, 'detail'] }),
  });
}

export function useDeleteSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('product_sizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.typeId, 'detail'] }),
  });
}

export function useSaveColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from('product_colors').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_colors').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.product_type_id, 'detail'] }),
  });
}

export function useDeleteColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('product_colors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.typeId, 'detail'] }),
  });
}

// Variants
export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ typeCode, sizeCode, colorCode, ...payload }) => {
      const sku = buildSku(typeCode, colorCode, sizeCode);
      const { error } = await supabase
        .from('product_variants')
        .insert({ ...payload, sku, barcode: sku });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.product_type_id, 'detail'] }),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['product_types', vars.typeId, 'detail'] }),
  });
}

// Recipes
export function useRecipe(variantId) {
  return useQuery({
    queryKey: ['recipe', variantId],
    enabled: !!variantId,
    queryFn: async () => {
      const r = await supabase.from('recipes').select('*').eq('variant_id', variantId).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return { recipe: null, items: [] };
      const items = await supabase
        .from('recipe_items')
        .select('*, materials(id,code,name,category,unit)')
        .eq('recipe_id', r.data.id);
      if (items.error) throw items.error;
      const variantItems = await supabase
        .from('recipe_variant_items')
        .select(
          'recipe_id, input_variant_id, qty, wastage_pct, product_variants(id, sku, product_types(name, category), product_sizes(label), product_colors(label))',
        )
        .eq('recipe_id', r.data.id);
      if (variantItems.error) throw variantItems.error;
      const typeItems = await supabase
        .from('recipe_type_items')
        .select('recipe_id, input_product_type_id, qty, wastage_pct, product_types(id, code, name)')
        .eq('recipe_id', r.data.id);
      if (typeItems.error) throw typeItems.error;
      return {
        recipe: r.data,
        items: items.data,
        variantItems: variantItems.data,
        typeItems: typeItems.data,
      };
    },
  });
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, yieldQty, items, variantItems }) => {
      // upsert recipe
      let recipeId;
      const existing = await supabase
        .from('recipes')
        .select('id, version')
        .eq('variant_id', variantId)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        recipeId = existing.data.id;
        const { error } = await supabase
          .from('recipes')
          .update({
            yield_qty: yieldQty,
            version: existing.data.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipeId);
        if (error) throw error;
        // wipe items
        const del = await supabase.from('recipe_items').delete().eq('recipe_id', recipeId);
        if (del.error) throw del.error;
        if (Array.isArray(variantItems)) {
          const delVariantItems = await supabase
            .from('recipe_variant_items')
            .delete()
            .eq('recipe_id', recipeId);
          if (delVariantItems.error) throw delVariantItems.error;
        }
      } else {
        const ins = await supabase
          .from('recipes')
          .insert({ variant_id: variantId, yield_qty: yieldQty })
          .select('id')
          .single();
        if (ins.error) throw ins.error;
        recipeId = ins.data.id;
      }
      // insert items
      if (items.length) {
        const rows = items.map((it) => ({
          recipe_id: recipeId,
          material_id: it.material_id,
          qty: Number(it.qty),
          wastage_pct: Number(it.wastage_pct ?? 0),
        }));
        const { error } = await supabase.from('recipe_items').insert(rows);
        if (error) throw error;
      }

      if (Array.isArray(variantItems) && variantItems.length) {
        const variantRows = variantItems.map((it) => ({
          recipe_id: recipeId,
          input_variant_id: it.input_variant_id,
          qty: Number(it.qty),
          wastage_pct: Number(it.wastage_pct ?? 0),
        }));
        const insVariants = await supabase.from('recipe_variant_items').insert(variantRows);
        if (insVariants.error) throw insVariants.error;
      }
      return recipeId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['recipe', vars.variantId] });
    },
  });
}

export function useRecipeTypeItems(variantId) {
  return useQuery({
    queryKey: ['recipe_type_items', variantId],
    enabled: !!variantId,
    queryFn: async () => {
      const r = await supabase
        .from('recipes')
        .select('id, yield_qty, version')
        .eq('variant_id', variantId)
        .maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) return { recipeId: null, yieldQty: 1, items: [] };

      const items = await supabase
        .from('recipe_type_items')
        .select(
          'recipe_id, input_product_type_id, qty, wastage_pct, product_types(id, code, name, category)',
        )
        .eq('recipe_id', r.data.id)
        .order('input_product_type_id');
      if (items.error) throw items.error;

      return {
        recipeId: r.data.id,
        yieldQty: r.data.yield_qty ?? 1,
        version: r.data.version ?? 1,
        items: items.data ?? [],
      };
    },
  });
}

export function useSaveRecipeTypeItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, items, yieldQty }) => {
      const existing = await supabase
        .from('recipes')
        .select('id, version')
        .eq('variant_id', variantId)
        .maybeSingle();
      if (existing.error) throw existing.error;

      let recipeId = existing.data?.id;
      if (!recipeId) {
        const ins = await supabase
          .from('recipes')
          .insert({ variant_id: variantId, yield_qty: Number(yieldQty) || 1 })
          .select('id')
          .single();
        if (ins.error) throw ins.error;
        recipeId = ins.data.id;
      } else {
        const upd = await supabase
          .from('recipes')
          .update({
            yield_qty: Number(yieldQty) || 1,
            version: Number(existing.data.version ?? 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipeId);
        if (upd.error) throw upd.error;
      }

      const delTypes = await supabase.from('recipe_type_items').delete().eq('recipe_id', recipeId);
      if (delTypes.error) throw delTypes.error;

      // Eski modelle kaydedilen satirlarin cift tuketim yaratmamasi icin temizle.
      const delLegacy = await supabase.from('recipe_variant_items').delete().eq('recipe_id', recipeId);
      if (delLegacy.error) throw delLegacy.error;

      if (items?.length) {
        const rows = items.map((it) => ({
          recipe_id: recipeId,
          input_product_type_id: it.input_product_type_id,
          qty: Number(it.qty),
          wastage_pct: Number(it.wastage_pct ?? 0),
        }));
        const insRows = await supabase.from('recipe_type_items').insert(rows);
        if (insRows.error) throw insRows.error;
      }

      return recipeId;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recipe_type_items', vars.variantId] });
      qc.invalidateQueries({ queryKey: ['recipe', vars.variantId] });
      qc.invalidateQueries({ queryKey: ['product_types'] });
      qc.invalidateQueries({ queryKey: ['production'] });
    },
  });
}

export function useSemiProductTypeIds() {
  return useQuery({
    queryKey: ['semi_product_type_ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_type_semi_components')
        .select('product_type_id');
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((x) => x.product_type_id).filter(Boolean)));
    },
  });
}

export function useProductTypeSemiComponents(productTypeId) {
  return useQuery({
    queryKey: ['product_type_semi_components', productTypeId],
    enabled: !!productTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_type_semi_components')
        .select('*')
        .eq('product_type_id', productTypeId)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveProductTypeSemiComponents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productTypeId, items }) => {
      const existingRes = await supabase
        .from('product_type_semi_components')
        .select('id, name')
        .eq('product_type_id', productTypeId);
      if (existingRes.error) throw existingRes.error;

      const existing = existingRes.data ?? [];
      const existingById = new Map(existing.map((row) => [row.id, row]));
      const existingByName = new Map(
        existing.map((row) => [String(row.name ?? '').trim().toLocaleLowerCase('tr-TR'), row]),
      );
      const keepIds = new Set();
      const usedFallbackIds = new Set();

      for (let idx = 0; idx < (items?.length ?? 0); idx += 1) {
        const raw = items[idx];
        const name = String(raw?.name ?? '').trim();
        if (!name) continue;
        const requiredQty = Number(raw?.required_qty ?? 1) || 1;
        const sortOrder = idx + 1;

        let targetId = raw?.component_id || raw?.id || null;

        if (!targetId) {
          const byName = existingByName.get(name.toLocaleLowerCase('tr-TR'));
          if (byName && !usedFallbackIds.has(byName.id)) {
            targetId = byName.id;
            usedFallbackIds.add(byName.id);
          }
        }

        if (targetId && existingById.has(targetId)) {
          const upd = await supabase
            .from('product_type_semi_components')
            .update({ name, required_qty: requiredQty, sort_order: sortOrder })
            .eq('id', targetId);
          if (upd.error) throw upd.error;
          keepIds.add(targetId);
        } else {
          const ins = await supabase.from('product_type_semi_components').insert({
            product_type_id: productTypeId,
            name,
            required_qty: requiredQty,
            sort_order: sortOrder,
          });
          if (ins.error) throw ins.error;
        }
      }

      const removable = existing.filter((row) => !keepIds.has(row.id));
      for (const row of removable) {
        const del = await supabase.from('product_type_semi_components').delete().eq('id', row.id);
        if (!del.error) continue;

        const fkBlocked =
          del.error.code === '23503' ||
          /semi_component_stock_moves_component_id_fkey|semi_component_stocks_component_id_fkey|semi_component_assembly_consumed_component_id_fkey/i.test(
            del.error.message ?? '',
          );
        if (fkBlocked) {
          throw new Error(
            `"${row.name}" parcasi gecmis kayitlarda kullanildigi icin silinemez. Ismi duzenleyebilir veya parcayi oldugu gibi birakabilirsiniz.`,
          );
        }
        throw del.error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['product_type_semi_components', vars.productTypeId] });
      qc.invalidateQueries({ queryKey: ['semi_product_type_ids'] });
      qc.invalidateQueries({ queryKey: ['production'] });
    },
  });
}

export function useSemiComponentStocks(variantId) {
  return useQuery({
    queryKey: ['semi_component_stocks', variantId],
    enabled: !!variantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('semi_component_stocks')
        .select('component_id, current_stock, product_type_semi_components(id,name,required_qty,sort_order)')
        .eq('variant_id', variantId);
      if (error) throw error;
      return data ?? [];
    },
  });
}
