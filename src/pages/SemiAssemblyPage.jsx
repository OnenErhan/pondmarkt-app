import { useMemo, useState } from 'react';
import { Check, Factory } from 'lucide-react';
import {
  useProductTypes,
  useProductTypeDetail,
  useProductTypeSemiComponents,
  useSemiComponentStocks,
  useSemiProductTypeIds,
} from '../hooks/useProducts.js';
import { useRecordSemiAssembly, useSemiAssemblyList } from '../hooks/useProduction.js';
import { toast } from '../components/ui/Toast.jsx';

const STEPS = ['Tip', 'Beden', 'Renk', 'Adet'];

export default function SemiAssemblyPage() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState(null);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const { data: types = [] } = useProductTypes();
  const { data: componentTypeIds = [] } = useSemiProductTypeIds();
  const { data: detail } = useProductTypeDetail(type?.id);
  const { data: components = [] } = useProductTypeSemiComponents(type?.id);
  const assemble = useRecordSemiAssembly();
  const { data: recentAssembly = [] } = useSemiAssemblyList();

  const assemblyTypes = useMemo(() => {
    const set = new Set(componentTypeIds);
    const items = types.filter((t) => set.has(t.id));
    return sortTypes(items);
  }, [types, componentTypeIds]);

  const sortedSizes = useMemo(() => sortSizes(detail?.sizes ?? []), [detail?.sizes]);
  const sortedColors = useMemo(() => sortColors(detail?.colors ?? []), [detail?.colors]);

  const variant = useMemo(() => {
    if (!detail || !size || !color) return null;
    return detail.variants.find((v) => v.size_id === size.id && v.color_id === color.id);
  }, [detail, size, color]);

  const { data: componentStocks = [] } = useSemiComponentStocks(variant?.id);

  const reset = () => {
    setStep(0);
    setType(null);
    setSize(null);
    setColor(null);
    setQty('');
    setNote('');
  };

  const partRows = useMemo(() => {
    const byComponent = new Map(componentStocks.map((x) => [x.component_id, Number(x.current_stock ?? 0)]));
    const q = Number(String(qty).replace(',', '.')) || 0;
    return components.map((c) => {
      const available = byComponent.get(c.id) ?? 0;
      const required = Number(c.required_qty ?? 1) * q;
      return {
        id: c.id,
        name: c.name,
        requiredQty: Number(c.required_qty ?? 1),
        available,
        required,
        enough: q <= 0 ? true : available >= required,
      };
    });
  }, [components, componentStocks, qty]);

  const submit = async () => {
    if (!variant) {
      toast.error('Bu kombinasyon icin varyant tanimli degil');
      return;
    }
    const q = Number(String(qty).replace(',', '.'));
    if (!q || q <= 0) {
      toast.error('Gecerli bir adet girin');
      return;
    }
    if (!partRows.every((r) => r.enough)) {
      toast.error('Parca stoklari yetersiz');
      return;
    }
    try {
      await assemble.mutateAsync({ variantId: variant.id, qty: q, date, note });
      toast.success(`${q} adet tam mamul birlestirildi`);
      reset();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <Factory size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Yari Mamul Birlestirme</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Parca stoklarindan tam mamul olusturur</p>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`rounded-lg p-3 text-center text-xs font-semibold ring-1 ${
              i === step
                ? 'bg-indigo-600 text-white ring-indigo-600'
                : i < step
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-white text-slate-400 ring-slate-200'
            }`}
          >
            {i < step && <Check size={12} className="mr-1 inline" />}
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <div className="card min-h-[420px]">
        {step === 0 && (
          <Step title="Hangi urun birlestirilecek?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {assemblyTypes.map((t) => (
                <BigCard
                  key={t.id}
                  active={type?.id === t.id}
                  onClick={() => {
                    setType(t);
                    setSize(null);
                    setColor(null);
                    setStep(1);
                  }}
                >
                  <div className="text-xs font-mono text-slate-400">{t.code}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{t.name}</div>
                </BigCard>
              ))}
              {assemblyTypes.length === 0 && (
                <p className="col-span-full text-sm text-slate-500">
                  Birlestirme icin uygun urun yok. Urun detayinda yari mamul parcalari tanimlayin.
                </p>
              )}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title={`${type?.name} - hangi beden?`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sortedSizes.map((s) => (
                <BigCard
                  key={s.id}
                  active={size?.id === s.id}
                  onClick={() => {
                    setSize(s);
                    setStep(2);
                  }}
                >
                  <div className="text-[10px] font-mono text-slate-400 break-all">{s.code}</div>
                  <div className="mt-1 text-base font-bold text-slate-900">{s.label}</div>
                </BigCard>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title={`${type?.name} ${size?.label} - hangi renk?`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sortedColors.map((c) => {
                const exists = !!detail?.variants.find((x) => x.size_id === size.id && x.color_id === c.id);
                return (
                  <BigCard
                    key={c.id}
                    active={color?.id === c.id}
                    disabled={!exists}
                    onClick={() => {
                      if (!exists) return;
                      setColor(c);
                      setStep(3);
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <span className="block h-10 w-10 rounded-full ring-2 ring-white" style={{ backgroundColor: c.hex || '#cbd5e1' }} />
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{c.label}</div>
                  </BigCard>
                );
              })}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Kac adet birlestirilecek?">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Parca Stok Durumu</div>
                <div className="mt-2 space-y-2 text-sm">
                  {partRows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded bg-white px-3 py-2 ring-1 ring-slate-200">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-slate-500">1 urun icin {r.requiredQty} adet</div>
                      </div>
                      <div className={`text-xs font-semibold ${r.enough ? 'text-emerald-700' : 'text-red-700'}`}>
                        Mevcut {r.available} | Gerekli {Number(r.required).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  ))}
                  {partRows.length === 0 && <p className="text-xs text-amber-700">Bu urun turunde parca tanimi yok.</p>}
                </div>
              </div>

              <div>
                <label className="label">Adet</label>
                <input type="number" min="1" step="1" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarih</label>
                  <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Not (ops.)</label>
                  <input type="text" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>

              <button type="button" className="btn-primary w-full" onClick={submit} disabled={assemble.isPending || partRows.length === 0}>
                {assemble.isPending ? 'Kaydediliyor...' : 'Birlestir ve Tam Mamule Cevir'}
              </button>
            </div>
          </Step>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
          Geri
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setStep(Math.min(3, step + 1))}
          disabled={step === 3 || (step === 0 && !type) || (step === 1 && !size) || (step === 2 && !color)}
        >
          Ileri
        </button>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Son Birlestirme Kayitlari</h2>
        {recentAssembly.length === 0 ? (
          <p className="text-sm text-slate-400">Henuz birlestirme kaydi yok.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Urun</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentAssembly.slice(0, 20).map((e) => (
                  <tr key={e.id} className="text-sm hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(e.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-3 font-medium">
                      {e.product_variants?.product_types?.name} · {e.product_variants?.product_colors?.label} · {e.product_variants?.product_sizes?.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{e.product_variants?.sku}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(e.qty).toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function BigCard({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl p-4 text-center transition ring-2 ${
        disabled
          ? 'cursor-not-allowed bg-slate-50 ring-slate-100 opacity-50'
          : active
            ? 'bg-indigo-50 ring-indigo-500 shadow-sm'
            : 'bg-white ring-slate-200 hover:ring-indigo-400 hover:shadow-sm'
      }`}
    >
      {children}
    </button>
  );
}

function sortTypes(items = []) {
  return [...items].sort((a, b) =>
    String(a?.code ?? a?.name ?? '').localeCompare(String(b?.code ?? b?.name ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

function sortSizes(items = []) {
  return [...items].sort((a, b) =>
    String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

function sortColors(items = []) {
  return [...items].sort((a, b) =>
    String(a?.label ?? a?.code ?? '').localeCompare(String(b?.label ?? b?.code ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}
