import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2, ChefHat, Save, ClipboardPaste, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase/client.js';
import { useMaterials, MATERIAL_CATEGORIES } from '../hooks/useMaterials.js';
import { useRecipe, useSaveRecipe } from '../hooks/useProducts.js';
import { toast } from '../components/ui/Toast.jsx';
import Modal from '../components/ui/Modal.jsx';

export default function RecipeEditorPage() {
  const { variantId } = useParams();
  const navigate = useNavigate();
  const [variant, setVariant] = useState(null);
  const { data: materials = [] } = useMaterials();
  const { data: recipeData, isLoading } = useRecipe(variantId);
  const save = useSaveRecipe();

  const { register, handleSubmit, control, reset, getValues } = useForm({
    defaultValues: { yield_qty: 1, items: [] },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState('append'); // 'append' | 'replace'

  // Load variant info
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, product_types(code,name), product_sizes(label,code), product_colors(label,code,hex)')
        .eq('id', variantId)
        .single();
      if (active && !error) setVariant(data);
    })();
    return () => {
      active = false;
    };
  }, [variantId]);

  // Reset form when recipe loads
  useEffect(() => {
    if (recipeData) {
      reset({
        yield_qty: recipeData.recipe?.yield_qty ?? 1,
        items: recipeData.items.map((it) => ({
          material_id: it.material_id,
          qty: it.qty,
          wastage_pct: it.wastage_pct,
        })),
      });
    }
  }, [recipeData, reset]);

  const onSubmit = async (values) => {
    const items = values.items.filter((it) => it.material_id && Number(it.qty) > 0);
    try {
      await save.mutateAsync({
        variantId,
        yieldQty: Number(values.yield_qty) || 1,
        items,
      });
      toast.success('Reçete kaydedildi');
      navigate(-1);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (isLoading || !variant) return <p className="p-6 text-sm text-slate-400">Yükleniyor...</p>;

  // Materials grouped by category
  const grouped = MATERIAL_CATEGORIES.map((c) => ({
    ...c,
    materials: materials.filter((m) => m.category === c.value),
  }));

  // Map: KOD (uppercase) -> material
  const codeMap = new Map(materials.map((m) => [String(m.code).trim().toUpperCase(), m]));

  const handleCopy = async () => {
    const items = getValues('items') || [];
    if (items.length === 0) {
      toast.error('Kopyalanacak kalem yok');
      return;
    }
    const lines = items
      .map((it) => {
        const m = materials.find((x) => x.id === it.material_id);
        if (!m) return null;
        return `${m.code}\t${it.qty ?? 0}\t${it.wastage_pct ?? 0}`;
      })
      .filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(`${lines.length} kalem panoya kopyalandı`);
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  const parseRows = (text) => {
    const rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = [];
    const errors = [];
    rows.forEach((line, i) => {
      // split by tab, semicolon, or comma (Excel uses tab)
      const cols = line.split(/[\t;,]+/).map((c) => c.trim());
      if (cols.length < 2) {
        errors.push(`Satır ${i + 1}: en az KOD ve miktar lazım`);
        return;
      }
      const code = cols[0].toUpperCase();
      const qty = Number(cols[1].replace(',', '.'));
      const wastage = cols[2] ? Number(cols[2].replace(',', '.')) : 0;
      const mat = codeMap.get(code);
      if (!mat) {
        errors.push(`Satır ${i + 1}: "${code}" bulunamadı`);
        return;
      }
      if (!qty || qty <= 0) {
        errors.push(`Satır ${i + 1}: geçersiz miktar`);
        return;
      }
      parsed.push({ material_id: mat.id, qty, wastage_pct: Number.isFinite(wastage) ? wastage : 0 });
    });
    return { parsed, errors };
  };

  const handlePasteApply = () => {
    const { parsed, errors } = parseRows(pasteText);
    if (parsed.length === 0) {
      toast.error(errors[0] || 'Satır okunamadı');
      return;
    }
    if (pasteMode === 'replace') {
      replace(parsed);
    } else {
      parsed.forEach((p) => append(p));
    }
    if (errors.length) {
      toast.info(`${parsed.length} eklendi, ${errors.length} satır atlandı`);
    } else {
      toast.success(`${parsed.length} kalem eklendi`);
    }
    setPasteOpen(false);
    setPasteText('');
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        to={`/products/${variant.product_type_id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> {variant.product_types?.name}
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <ChefHat size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reçete</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono">{variant.sku}</span> ·{' '}
            {variant.product_colors?.label} · {variant.product_sizes?.label}
            {recipeData?.recipe?.version && (
              <span className="ml-2 text-xs text-slate-400">
                v{recipeData.recipe.version} · son {new Date(recipeData.recipe.updated_at).toLocaleDateString('tr-TR')}
              </span>
            )}
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="card grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">1 reçete kaç adet üretir? *</label>
            <input
              type="number"
              step="0.001"
              required
              className="input"
              {...register('yield_qty')}
            />
            <p className="mt-1 text-xs text-slate-500">
              Aşağıdaki kalemler bu adet için yazılacak. Üretimde adet/yield çarpanı uygulanır.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Yari mamul bilesen yonetimi urun detayinda varyant kartindaki YM butonundan yapilir.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Malzemeler</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleCopy}
                title="Mevcut kalemleri panoya kopyala"
              >
                <Copy size={14} /> Kopyala
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setPasteOpen(true)}
                title="Excel'den / panodan yapıştır"
              >
                <ClipboardPaste size={14} /> Yapıştır
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => append({ material_id: '', qty: '', wastage_pct: 0 })}
              >
                <Plus size={14} /> Kalem Ekle
              </button>
            </div>
          </div>

          {fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Henüz kalem yok. Yukarıdaki butondan ekleyin.
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="col-span-6">
                    <label className="label">Malzeme</label>
                    <select className="input" {...register(`items.${idx}.material_id`)} required>
                      <option value="">— Seç —</option>
                      {grouped.map((g) =>
                        g.materials.length ? (
                          <optgroup key={g.value} label={g.label}>
                            {g.materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.code} — {m.name} ({m.unit})
                              </option>
                            ))}
                          </optgroup>
                        ) : null,
                      )}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="label">Miktar</label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      className="input"
                      {...register(`items.${idx}.qty`)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Fire %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      {...register(`items.${idx}.wastage_pct`)}
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="btn-secondary !p-2"
                      aria-label="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Vazgeç
          </button>
          <button type="submit" className="btn-primary">
            <Save size={16} /> Kaydet
          </button>
        </div>
      </form>

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Reçete kalemlerini yapıştır"
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPasteOpen(false)}>
              Vazgeç
            </button>
            <button type="button" className="btn-primary" onClick={handlePasteApply}>
              Uygula
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-800">Format: <code>KOD miktar fire%</code> (her satırda bir kalem)</p>
            <p className="mt-1">Ayıraç: <kbd>Tab</kbd> (Excel’den kopyala-yapıştır), nokta-virgül veya virgül. Fire% opsiyonel.</p>
            <pre className="mt-2 rounded bg-white p-2 text-[11px] text-slate-700 ring-1 ring-slate-200">PLY-01〉0.5〉5
MEK-01〉0.02
BOY-KRM〉0.05〉2</pre>
          </div>
          <textarea
            className="input min-h-[180px] font-mono text-sm"
            placeholder="Excel'den kopyalayıp buraya yapıştır..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="pasteMode"
                value="append"
                checked={pasteMode === 'append'}
                onChange={() => setPasteMode('append')}
              />
              Mevcut listeye ekle
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="pasteMode"
                value="replace"
                checked={pasteMode === 'replace'}
                onChange={() => setPasteMode('replace')}
              />
              Listeyi değiştir
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
