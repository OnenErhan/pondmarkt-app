import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChefHat, Save, ClipboardPaste, Copy, ChevronDown, Check } from 'lucide-react';
import { supabase } from '../lib/supabase/client.js';
import { useMaterials, MATERIAL_CATEGORIES } from '../hooks/useMaterials.js';
import { useProductTypeSemiComponents, useRecipe, useSaveRecipe } from '../hooks/useProducts.js';
import { toast } from '../components/ui/Toast.jsx';
import Modal from '../components/ui/Modal.jsx';

const EMPTY_ROW = { material_id: '', qty: '', wastage_pct: 0 };

const formatMaterialOptionLabel = (material) => `${material.code} — ${material.name} (${material.unit})`;

function MaterialSelect({ value, groupedMaterials, materialMap, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedMaterial = materialMap.get(String(value ?? ''));
  const selectedLabel = selectedMaterial ? formatMaterialOptionLabel(selectedMaterial) : '— Seç —';

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className={`input flex min-h-[4.25rem] items-start justify-between gap-2 text-left ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedMaterial ? selectedLabel : undefined}
      >
        <span className={`block min-w-0 flex-1 whitespace-normal break-words pr-1 text-sm leading-5 ${selectedMaterial ? 'text-slate-800' : 'text-slate-400'}`}>
          {selectedLabel}
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-100">
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${value ? 'text-slate-600' : 'bg-slate-50 text-slate-900'}`}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            role="option"
            aria-selected={!value}
          >
            <span>— Seç —</span>
            {!value ? <Check size={14} className="shrink-0 text-brand-600" /> : null}
          </button>

          {groupedMaterials.map((group) =>
            group.materials.length ? (
              <div key={group.value} className="mt-2 first:mt-0">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</div>
                <div className="space-y-1">
                  {group.materials.map((material) => {
                    const optionLabel = formatMaterialOptionLabel(material);
                    const isSelected = String(value ?? '') === String(material.id);

                    return (
                      <button
                        key={material.id}
                        type="button"
                        className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 ${isSelected ? 'bg-brand-50 text-brand-900' : 'text-slate-700'}`}
                        onClick={() => {
                          onChange(material.id);
                          setOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                        title={optionLabel}
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-5">{optionLabel}</span>
                        {isSelected ? <Check size={14} className="mt-1 shrink-0 text-brand-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function RecipeSection({
  section,
  items,
  groupedMaterials,
  materialMap,
  onCopy,
  onOpenPaste,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{section.label}</h2>
          <p className="mt-1 text-xs text-slate-500">{section.hint}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{items.length} kalem</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={onCopy}>
          <Copy size={14} /> Kopyala
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={onOpenPaste}>
          <ClipboardPaste size={14} /> Yapıştır
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={onAddRow}>
          <Plus size={14} /> Kalem Ekle
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">Bu bölümde henüz kalem yok.</p>
      ) : (
        <div className="space-y-3">
          {items.map((row, index) => (
            <div
              key={`${section.key}-${index}`}
              className="grid grid-cols-12 items-end gap-2 rounded-lg bg-slate-50 p-3 xl:grid-cols-[minmax(0,1.9fr)_minmax(7rem,0.85fr)_minmax(5rem,0.6fr)_auto]"
            >
              <div className="col-span-12 min-w-0 xl:col-span-1">
                <label className="label">Malzeme</label>
                <MaterialSelect
                  value={row.material_id ?? ''}
                  groupedMaterials={groupedMaterials}
                  materialMap={materialMap}
                  onChange={(value) => onUpdateRow(index, 'material_id', value)}
                />
              </div>
              <div className="col-span-5 xl:col-span-1">
                <label className="label">Miktar</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  className="input text-sm"
                  value={row.qty ?? ''}
                  onChange={(event) => onUpdateRow(index, 'qty', event.target.value)}
                />
              </div>
              <div className="col-span-5 xl:col-span-1">
                <label className="label">Fire %</label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-sm"
                  value={row.wastage_pct ?? 0}
                  onChange={(event) => onUpdateRow(index, 'wastage_pct', event.target.value)}
                />
              </div>
              <div className="col-span-2 xl:col-span-1">
                <button type="button" onClick={() => onRemoveRow(index)} className="btn-secondary !p-2" aria-label="Sil">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecipeEditorPage() {
  const { variantId } = useParams();
  const navigate = useNavigate();
  const [variant, setVariant] = useState(null);
  const [yieldQty, setYieldQty] = useState(1);
  const [commonItems, setCommonItems] = useState([]);
  const [componentItems, setComponentItems] = useState({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState('append');
  const [pasteTarget, setPasteTarget] = useState('common');

  const { data: materials = [] } = useMaterials();
  const { data: recipeData, isLoading } = useRecipe(variantId);
  const { data: components = [] } = useProductTypeSemiComponents(variant?.product_type_id);
  const save = useSaveRecipe();

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

  const groupedMaterials = useMemo(
    () =>
      MATERIAL_CATEGORIES.map((category) => ({
        ...category,
        materials: materials.filter((material) => material.category === category.value),
      })),
    [materials],
  );

  const codeMap = useMemo(
    () => new Map(materials.map((material) => [String(material.code).trim().toUpperCase(), material])),
    [materials],
  );

  const materialMap = useMemo(
    () => new Map(materials.map((material) => [String(material.id), material])),
    [materials],
  );

  const sections = useMemo(
    () => [
      ...components.map((component) => ({
        key: component.id,
        label: component.name,
        hint: `${Number(component.required_qty ?? 1).toLocaleString('tr-TR')} adet / tam mamul`,
      })),
      {
        key: 'common',
        label: 'Ortak Reçete',
        hint: 'Birleştirme ve tam mamul üretiminde kullanılır',
      },
    ],
    [components],
  );

  useEffect(() => {
    if (!recipeData) return;

    setYieldQty(recipeData.recipe?.yield_qty ?? 1);
    setCommonItems(
      (recipeData.items ?? []).map((item) => ({
        material_id: item.material_id,
        qty: item.qty,
        wastage_pct: item.wastage_pct,
      })),
    );

    const nextComponentItems = {};
    for (const component of components) {
      nextComponentItems[component.id] = [];
    }
    for (const item of recipeData.componentItems ?? []) {
      if (!nextComponentItems[item.component_id]) {
        nextComponentItems[item.component_id] = [];
      }
      nextComponentItems[item.component_id].push({
        material_id: item.material_id,
        qty: item.qty,
        wastage_pct: item.wastage_pct,
      });
    }

    setComponentItems(nextComponentItems);
  }, [components, recipeData]);

  useEffect(() => {
    if (!components.length) return;
    setComponentItems((current) => {
      const next = { ...current };
      for (const component of components) {
        if (!Array.isArray(next[component.id])) {
          next[component.id] = [];
        }
      }
      return next;
    });
  }, [components]);

  const getSectionItems = (sectionKey) =>
    sectionKey === 'common' ? commonItems : componentItems[sectionKey] ?? [];

  const setSectionItems = (sectionKey, updater) => {
    if (sectionKey === 'common') {
      setCommonItems((current) => (typeof updater === 'function' ? updater(current) : updater));
      return;
    }

    setComponentItems((current) => {
      const previous = current[sectionKey] ?? [];
      const nextItems = typeof updater === 'function' ? updater(previous) : updater;
      return { ...current, [sectionKey]: nextItems };
    });
  };

  const normalizeRows = (rows) =>
    (rows ?? [])
      .map((row) => ({
        material_id: row.material_id,
        qty: Number(String(row.qty ?? '').replace(',', '.')),
        wastage_pct: Number(String(row.wastage_pct ?? 0).replace(',', '.')) || 0,
      }))
      .filter((row) => row.material_id && row.qty > 0);

  const validateSectionRows = (rows, sectionLabel) => {
    const seen = new Set();
    for (const row of rows) {
      const key = String(row.material_id ?? '');
      if (!key) continue;
      if (seen.has(key)) {
        throw new Error(`${sectionLabel} içinde aynı malzeme birden fazla kez eklenemez`);
      }
      seen.add(key);
    }
  };

  const handleCopy = async (sectionKey) => {
    const items = normalizeRows(getSectionItems(sectionKey));
    if (items.length === 0) {
      toast.error('Kopyalanacak kalem yok');
      return;
    }

    const lines = items
      .map((item) => {
        const material = materials.find((entry) => entry.id === item.material_id);
        if (!material) return null;
        return `${material.code}\t${item.qty ?? 0}\t${item.wastage_pct ?? 0}`;
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
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = [];
    const errors = [];

    rows.forEach((line, index) => {
      const cols = line.split(/[\t;,]+/).map((cell) => cell.trim());
      if (cols.length < 2) {
        errors.push(`Satır ${index + 1}: en az KOD ve miktar lazım`);
        return;
      }

      const code = cols[0].toUpperCase();
      const qty = Number(cols[1].replace(',', '.'));
      const wastage = cols[2] ? Number(cols[2].replace(',', '.')) : 0;
      const material = codeMap.get(code);

      if (!material) {
        errors.push(`Satır ${index + 1}: "${code}" bulunamadı`);
        return;
      }
      if (!qty || qty <= 0) {
        errors.push(`Satır ${index + 1}: geçersiz miktar`);
        return;
      }

      parsed.push({
        material_id: material.id,
        qty,
        wastage_pct: Number.isFinite(wastage) ? wastage : 0,
      });
    });

    return { parsed, errors };
  };

  const handlePasteApply = () => {
    const { parsed, errors } = parseRows(pasteText);
    if (parsed.length === 0) {
      toast.error(errors[0] || 'Satır okunamadı');
      return;
    }

    setSectionItems(pasteTarget, (rows) => (pasteMode === 'replace' ? parsed : [...rows, ...parsed]));

    if (errors.length) {
      toast.info(`${parsed.length} eklendi, ${errors.length} satır atlandı`);
    } else {
      toast.success(`${parsed.length} kalem eklendi`);
    }

    setPasteOpen(false);
    setPasteText('');
  };

  const submit = async (event) => {
    event.preventDefault();

    const normalizedCommonItems = normalizeRows(commonItems);
    const normalizedComponentItems = components.flatMap((component) =>
      normalizeRows(componentItems[component.id]).map((row, index) => ({
        ...row,
        component_id: component.id,
        sort_order: index + 1,
      })),
    );

    try {
      validateSectionRows(normalizedCommonItems, 'Ortak reçete');
      for (const component of components) {
        validateSectionRows(normalizeRows(componentItems[component.id]), component.name);
      }

      await save.mutateAsync({
        variantId,
        yieldQty: Number(String(yieldQty).replace(',', '.')) || 1,
        items: normalizedCommonItems,
        componentItems: normalizedComponentItems,
      });
      toast.success('Reçete kaydedildi');
      navigate(-1);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (isLoading || !variant) {
    return <p className="p-6 text-sm text-slate-400">Yükleniyor...</p>;
  }

  return (
    <div className="mx-auto max-w-[1500px] p-6">
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
            <span className="font-mono">{variant.sku}</span> · {variant.product_colors?.label} ·{' '}
            {variant.product_sizes?.label}
            {recipeData?.recipe?.version && (
              <span className="ml-2 text-xs text-slate-400">
                v{recipeData.recipe.version} · son{' '}
                {new Date(recipeData.recipe.updated_at).toLocaleDateString('tr-TR')}
              </span>
            )}
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="card grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">1 reçete kaç adet üretir? *</label>
            <input
              type="number"
              step="0.001"
              required
              className="input"
              value={yieldQty}
              onChange={(event) => setYieldQty(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Aşağıdaki kalemler bu adet için yazılacak. Üretimde adet/yield çarpanı uygulanır.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Parça kolonları yarı mamül üretiminde kendi hammaddesini düşer. Ortak reçete, birleştirme ve tam mamülde kullanılır.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {sections.map((section) => (
            <RecipeSection
              key={section.key}
              section={section}
              items={getSectionItems(section.key)}
              groupedMaterials={groupedMaterials}
              materialMap={materialMap}
              onCopy={() => handleCopy(section.key)}
              onOpenPaste={() => {
                setPasteTarget(section.key);
                setPasteOpen(true);
              }}
              onAddRow={() => setSectionItems(section.key, (rows) => [...rows, { ...EMPTY_ROW }])}
              onRemoveRow={(index) =>
                setSectionItems(section.key, (rows) => rows.filter((_, rowIndex) => rowIndex !== index))
              }
              onUpdateRow={(index, field, value) =>
                setSectionItems(section.key, (rows) =>
                  rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
                )
              }
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Vazgeç
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            <Save size={16} /> {save.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title={`Reçete kalemlerini yapıştır${pasteTarget === 'common' ? ' - Ortak Reçete' : ''}`}
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
            <p className="font-medium text-slate-800">Format: <code>KOD	miktar	fire%</code> (her satırda bir kalem)</p>
            <p className="mt-1">Ayıraç: <kbd>Tab</kbd> (Excel’den kopyala-yapıştır), nokta-virgül veya virgül. Fire% opsiyonel.</p>
            <pre className="mt-2 rounded bg-white p-2 text-[11px] text-slate-700 ring-1 ring-slate-200">PLY-01	0.5	5
MEK-01	0.02
BOY-KRM	0.05	2</pre>
          </div>
          <textarea
            className="input min-h-[180px] font-mono text-sm"
            placeholder="Excel'den kopyalayıp buraya yapıştır..."
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
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
