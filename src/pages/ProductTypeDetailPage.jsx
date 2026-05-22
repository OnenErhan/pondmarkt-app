import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowLeft,
  Ruler,
  Palette,
  Sparkles,
  ChefHat,
  Tag,
  Pencil,
} from 'lucide-react';
import {
  useProductTypeDetail,
  useSaveSize,
  useDeleteSize,
  useSaveColor,
  useDeleteColor,
  useCreateVariant,
  useDeleteVariant,
  useRecipeVariantItems,
  useSaveRecipeVariantItems,
  buildSku,
} from '../hooks/useProducts.js';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { toast } from '../components/ui/Toast.jsx';
import { useFieldArray, useForm } from 'react-hook-form';
import { isSemiFinishedCategory } from '../lib/productCategory.js';
import { supabase } from '../lib/supabase/client.js';

export default function ProductTypeDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useProductTypeDetail(id);
  const [sizeForm, setSizeForm] = useState(null); // null | {} | size
  const [colorForm, setColorForm] = useState(null);
  const [semiModalVariant, setSemiModalVariant] = useState(null);
  const sortedSizes = useMemo(() => sortSizes(data?.sizes ?? []), [data?.sizes]);
  const sortedColors = useMemo(() => sortColors(data?.colors ?? []), [data?.colors]);

  if (isLoading) return <p className="p-6 text-sm text-slate-400">Yükleniyor...</p>;
  if (!data?.type) return <p className="p-6">Ürün bulunamadı</p>;

  const { type, sizes, colors, variants } = data;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        to="/products"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> Ürünler
      </Link>
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 font-mono font-bold text-brand-700">
          {type.code}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{type.name}</h1>
          {type.description && <p className="text-sm text-slate-500">{type.description}</p>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* SIZES */}
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Ruler size={16} className="text-slate-500" />
              Boyutlar
            </h2>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setSizeForm({})}
            >
              <Plus size={14} /> Ekle
            </button>
          </div>
          {sortedSizes.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Henüz boyut yok</p>
          ) : (
            <div className="space-y-1">
              {sortedSizes.map((s) => (
                <Row
                  key={s.id}
                  code={s.code}
                  label={s.label}
                  meta={s.value ? `${s.value} ${s.unit ?? ''}`.trim() : null}
                  onEdit={() => setSizeForm(s)}
                  typeId={type.id}
                  table="size"
                />
              ))}
            </div>
          )}
        </section>

        {/* COLORS */}
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Palette size={16} className="text-slate-500" />
              Renkler
            </h2>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setColorForm({})}
            >
              <Plus size={14} /> Ekle
            </button>
          </div>
          {sortedColors.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Henüz renk yok</p>
          ) : (
            <div className="space-y-1">
              {sortedColors.map((c) => (
                <Row
                  key={c.id}
                  code={c.code}
                  label={c.label}
                  swatch={c.hex}
                  onEdit={() => setColorForm(c)}
                  typeId={type.id}
                  table="color"
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* VARIANTS MATRIX */}
      <section className="card mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles size={16} className="text-slate-500" />
            Varyantlar
          </h2>
          <p className="text-xs text-slate-500">
            {variants.length} / {sortedSizes.length * sortedColors.length} olası varyant
          </p>
        </div>
        {sortedSizes.length === 0 || sortedColors.length === 0 ? (
          <EmptyState
            title="Önce boyut ve renk ekleyin"
            message="Varyantlar boyut + renk kombinasyonundan otomatik oluşur"
          />
        ) : (
          <VariantMatrix
            type={type}
            sizes={sortedSizes}
            colors={sortedColors}
            variants={variants}
            onManageSemi={(v) => setSemiModalVariant(v)}
          />
        )}
      </section>

      {sizeForm !== null && (
        <SizeForm
          key={sizeForm.id ?? 'new-size'}
          initial={sizeForm}
          typeId={type.id}
          onClose={() => setSizeForm(null)}
        />
      )}
      {colorForm !== null && (
        <ColorForm
          key={colorForm.id ?? 'new-color'}
          initial={colorForm}
          typeId={type.id}
          onClose={() => setColorForm(null)}
        />
      )}
      {semiModalVariant && (
        <SemiComponentModal
          key={semiModalVariant.id}
          variant={semiModalVariant}
          onClose={() => setSemiModalVariant(null)}
        />
      )}
    </div>
  );
}

function Row({ code, label, meta, swatch, onEdit }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50">
      <button type="button" onClick={onEdit} className="flex flex-1 items-center gap-3 text-left">
        {swatch && (
          <span
            className="inline-block h-5 w-5 rounded-full ring-1 ring-slate-200"
            style={{ background: swatch }}
          />
        )}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
          {code}
        </span>
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {meta && <span className="text-xs text-slate-500">{meta}</span>}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}

function SizeForm({ initial, typeId, onClose }) {
  const isEdit = !!initial?.id;
  const save = useSaveSize();
  const del = useDeleteSize();
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { label: '', code: '', value: '', unit: '', ...initial },
  });
  const onSubmit = async (v) => {
    try {
      await save.mutateAsync({
        ...initial,
        ...v,
        code: v.code.toUpperCase(),
        value: v.value === '' ? null : Number(v.value),
        product_type_id: typeId,
      });
      toast.success(isEdit ? 'Güncellendi' : 'Eklendi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleDel = async () => {
    if (!confirm(`"${initial.label}" boyutu silinsin mi?`)) return;
    try {
      await del.mutateAsync({ id: initial.id, typeId });
      toast.success('Silindi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Boyut Düzenle' : 'Yeni Boyut'}
      footer={
        <>
          {isEdit && (
            <button type="button" className="btn-danger mr-auto" onClick={handleDel}>
              <Trash2 size={14} /> Sil
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" form="sizeForm" className="btn-primary" disabled={formState.isSubmitting}>
            Kaydet
          </button>
        </>
      }
    >
      <form id="sizeForm" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Görünen İsim *</label>
          <input className="input" required {...register('label')} placeholder="Small / 1 Litre" />
        </div>
        <div>
          <label className="label">Kısa Kod *</label>
          <input
            className="input font-mono uppercase"
            required
            maxLength={6}
            {...register('code')}
            placeholder="S"
          />
        </div>
        <div>
          <label className="label">Sayısal Değer</label>
          <input type="number" step="0.001" className="input" {...register('value')} />
        </div>
        <div className="col-span-2">
          <label className="label">Birim</label>
          <input className="input" {...register('unit')} placeholder="L, cm, basamak" />
        </div>
      </form>
    </Modal>
  );
}

function ColorForm({ initial, typeId, onClose }) {
  const isEdit = !!initial?.id;
  const save = useSaveColor();
  const del = useDeleteColor();
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { label: '', code: '', hex: '#888888', ...initial },
  });
  const onSubmit = async (v) => {
    try {
      await save.mutateAsync({
        ...initial,
        ...v,
        code: v.code.toUpperCase(),
        product_type_id: typeId,
      });
      toast.success(isEdit ? 'Güncellendi' : 'Eklendi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const handleDel = async () => {
    if (!confirm(`"${initial.label}" rengi silinsin mi?`)) return;
    try {
      await del.mutateAsync({ id: initial.id, typeId });
      toast.success('Silindi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Renk Düzenle' : 'Yeni Renk'}
      footer={
        <>
          {isEdit && (
            <button type="button" className="btn-danger mr-auto" onClick={handleDel}>
              <Trash2 size={14} /> Sil
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" form="colorForm" className="btn-primary" disabled={formState.isSubmitting}>
            Kaydet
          </button>
        </>
      }
    >
      <form id="colorForm" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">İsim *</label>
          <input className="input" required {...register('label')} placeholder="Kırmızı" />
        </div>
        <div>
          <label className="label">Kısa Kod *</label>
          <input
            className="input font-mono uppercase"
            required
            maxLength={6}
            {...register('code')}
            placeholder="KRM"
          />
        </div>
        <div>
          <label className="label">Renk</label>
          <input type="color" className="input h-10 p-1" {...register('hex')} />
        </div>
      </form>
    </Modal>
  );
}

function VariantMatrix({ type, sizes, colors, variants, onManageSemi }) {
  const create = useCreateVariant();
  const del = useDeleteVariant();
  const variantMap = new Map();
  variants.forEach((v) => variantMap.set(`${v.size_id}|${v.color_id}`, v));

  const handleCreate = async (size, color) => {
    try {
      await create.mutateAsync({
        product_type_id: type.id,
        size_id: size.id,
        color_id: color.id,
        typeCode: type.code,
        sizeCode: size.code,
        colorCode: color.code,
      });
      toast.success(`Varyant eklendi: ${buildSku(type.code, color.code, size.code)}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (variant) => {
    if (!confirm(`${variant.sku} silinsin mi?`)) return;
    try {
      await del.mutateAsync({ id: variant.id, typeId: type.id });
      toast.success('Silindi');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="bg-slate-50 px-2 py-1.5 text-left text-xs font-medium uppercase text-slate-500">
              Boyut \ Renk
            </th>
            {colors.map((c) => (
              <th key={c.id} className="bg-slate-50 px-2 py-1.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700">
                  <span
                    className="h-3 w-3 rounded-full ring-1 ring-slate-200"
                    style={{ background: c.hex ?? '#999' }}
                  />
                  {c.label}
                </div>
                <div className="font-mono text-[10px] text-slate-400">{c.code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s.id}>
              <th className="bg-slate-50 px-2 py-2 text-left text-xs font-medium text-slate-700">
                <div>{s.label}</div>
                <div className="font-mono text-[10px] text-slate-400">{s.code}</div>
              </th>
              {colors.map((c) => {
                const v = variantMap.get(`${s.id}|${c.id}`);
                if (!v) {
                  return (
                    <td key={c.id} className="bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => handleCreate(s, c)}
                        className="flex w-full items-center justify-center gap-1 rounded border-2 border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                      >
                        <Plus size={12} /> Oluştur
                      </button>
                    </td>
                  );
                }
                return (
                  <td key={c.id} className="bg-white">
                    <div className="rounded-lg p-2 ring-1 ring-slate-200">
                      <div className="mb-1 font-mono text-xs font-bold text-slate-800">{v.sku}</div>
                      <div className="mb-2 text-xs text-slate-500">
                        Stok: {Number(v.current_stock).toLocaleString('tr-TR')}
                      </div>
                      <div className="flex gap-1">
                        <Link
                          to={`/products/recipes/${v.id}`}
                          className="flex-1 rounded bg-brand-50 px-2 py-1 text-center text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                        >
                          <ChefHat size={11} className="inline" /> Reçete
                        </Link>
                        <button
                          type="button"
                          onClick={() => onManageSemi(v)}
                          className="rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                          title="Yari mamul bilesenleri"
                        >
                          YM
                        </button>
                        <Link
                          to={`/products/${v.id}/label`}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                          title="Barkod etiket"
                        >
                          <Tag size={11} className="inline" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Sil"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortSizes(items = []) {
  return [...items].sort((a, b) => {
    const left = toSortableNumber(a?.value);
    const right = toSortableNumber(b?.value);
    const leftIsNumber = !Number.isNaN(left);
    const rightIsNumber = !Number.isNaN(right);

    if (leftIsNumber && rightIsNumber && left !== right) return left - right;
    if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;

    const labelCmp = String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    });
    if (labelCmp !== 0) return labelCmp;

    return String(a?.code ?? '').localeCompare(String(b?.code ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function SemiComponentModal({ variant, onClose }) {
  const { data, isLoading } = useRecipeVariantItems(variant.id);
  const save = useSaveRecipeVariantItems();
  const [semiVariants, setSemiVariants] = useState([]);
  const { register, handleSubmit, control, reset } = useForm({
    defaultValues: { yield_qty: 1, items: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: variants, error } = await supabase
        .from('product_variants')
        .select('id, sku, product_types(name, category), product_sizes(label), product_colors(label)')
        .order('sku');
      if (!active || error) return;
      const filtered = (variants ?? []).filter((v) => isSemiFinishedCategory(v.product_types?.category));
      setSemiVariants(filtered);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    reset({
      yield_qty: data.yieldQty ?? 1,
      items: (data.items ?? []).map((it) => ({
        input_variant_id: it.input_variant_id,
        qty: it.qty,
        wastage_pct: it.wastage_pct,
      })),
    });
  }, [data, reset]);

  const submit = async (values) => {
    const items = (values.items ?? []).filter((it) => it.input_variant_id && Number(it.qty) > 0);
    if (items.some((it) => it.input_variant_id === variant.id)) {
      toast.error('Ayni varyant kendisini yari mamul olarak kullanamaz');
      return;
    }
    try {
      await save.mutateAsync({
        variantId: variant.id,
        yieldQty: Number(values.yield_qty) || 1,
        items,
      });
      toast.success('Yari mamul bilesenleri kaydedildi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Yari Mamul Bilesenleri - ${variant.sku}`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgec
          </button>
          <button
            type="submit"
            form="semiComponentForm"
            className="btn-primary"
            disabled={save.isPending}
          >
            {save.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-sm text-slate-400">Yukleniyor...</p>
      ) : (
        <form id="semiComponentForm" onSubmit={handleSubmit(submit)} className="space-y-3">
          <div>
            <label className="label">1 recete kac adet uretir?</label>
            <input type="number" step="0.001" className="input" {...register('yield_qty')} />
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Bagli yari mamuller</h3>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => append({ input_variant_id: '', qty: '', wastage_pct: 0 })}
            >
              <Plus size={14} /> Ekle
            </button>
          </div>

          {fields.length === 0 ? (
            <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Bu varyantta yari mamul bileseni yok.
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded bg-slate-50 p-3">
                  <div className="col-span-7">
                    <label className="label">Yari mamul varyant</label>
                    <select className="input" {...register(`items.${idx}.input_variant_id`)} required>
                      <option value="">- Sec -</option>
                      {semiVariants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sku} - {v.product_types?.name} - {v.product_colors?.label} - {v.product_sizes?.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Miktar</label>
                    <input
                      type="number"
                      step="0.001"
                      className="input"
                      required
                      {...register(`items.${idx}.qty`)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Fire %</label>
                    <input type="number" step="0.01" className="input" {...register(`items.${idx}.wastage_pct`)} />
                  </div>
                  <div className="col-span-1">
                    <button type="button" className="btn-secondary !p-2" onClick={() => remove(idx)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {semiVariants.length === 0 && (
            <p className="text-xs text-amber-700">
              Secenek listesi bos. Urun turu kategorilerinde YARI MAMUL tanimlanmis varyant olmali.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

function toSortableNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return Number(value);
}

function sortColors(items = []) {
  return [...items].sort((a, b) => {
    const labelCmp = String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    });
    if (labelCmp !== 0) return labelCmp;

    return String(a?.code ?? '').localeCompare(String(b?.code ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}
