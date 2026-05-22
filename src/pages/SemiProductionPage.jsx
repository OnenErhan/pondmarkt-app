import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Factory, RotateCcw } from 'lucide-react';
import {
  useProductTypes,
  useProductTypeDetail,
  useProductTypeSemiComponents,
  useSemiComponentStocks,
} from '../hooks/useProducts.js';
import { useRecordSemiProduction } from '../hooks/useProduction.js';
import { toast } from '../components/ui/Toast.jsx';
import { useSemiProductTypeIds } from '../hooks/useProducts.js';

const STEPS = ['Tip', 'Beden', 'Renk', 'Parca', 'Adet'];

export default function SemiProductionPage() {
  const [step, setStep] = useState(0);
  const [type, setType] = useState(null);
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [component, setComponent] = useState(null);
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const { data: types = [] } = useProductTypes();
  const { data: semiTypeIds = [] } = useSemiProductTypeIds();
  const { data: detail } = useProductTypeDetail(type?.id);
  const { data: components = [] } = useProductTypeSemiComponents(type?.id);
  const record = useRecordSemiProduction();
  const semiTypes = useMemo(() => {
    const idSet = new Set(semiTypeIds);
    return sortTypes(types.filter((t) => idSet.has(t.id)));
  }, [types, semiTypeIds]);
  const sortedSizes = useMemo(() => sortSizes(detail?.sizes ?? []), [detail?.sizes]);
  const sortedColors = useMemo(() => sortColors(detail?.colors ?? []), [detail?.colors]);

  const variant = useMemo(() => {
    if (!detail || !size || !color) return null;
    return detail.variants.find((v) => v.size_id === size.id && v.color_id === color.id);
  }, [detail, size, color]);
  const { data: componentStocks = [] } = useSemiComponentStocks(variant?.id);
  const selectedComponentStock = useMemo(() => {
    if (!component) return 0;
    const row = componentStocks.find((x) => x.component_id === component.id);
    return Number(row?.current_stock ?? 0);
  }, [componentStocks, component]);

  const reset = () => {
    setStep(0);
    setType(null);
    setSize(null);
    setColor(null);
    setComponent(null);
    setQty('');
    setNote('');
  };

  const submit = async () => {
    if (!variant) {
      toast.error('Bu kombinasyon icin varyant tanimli degil');
      return;
    }
    if (!component) {
      toast.error('Once parca secin');
      return;
    }
    const q = Number(String(qty).replace(',', '.'));
    if (!q || q <= 0) {
      toast.error('Gecerli bir adet girin');
      return;
    }
    try {
      await record.mutateAsync({ variantId: variant.id, componentId: component.id, qty: q, date, note });
      toast.success(`${q} adet ${component.name} kaydedildi`);
      reset();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Factory size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Yari Mamul Uretim Girisi</h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Yari mamul stok girisi yapar, hammadde dusmez
          </p>
        </div>
        <button type="button" onClick={reset} className="btn-secondary text-xs">
          <RotateCcw size={14} /> Sifirla
        </button>
      </header>

      <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200">
        Tam mamul uretiminde receteye ekli yari mamuller otomatik dusulur. Tam mamul girisi icin{' '}
        <Link to="/production/new" className="font-semibold underline">
          burayi kullan
        </Link>
        .
      </div>

      <div className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`rounded-lg p-3 text-center text-xs font-semibold ring-1 ${
              i === step
                ? 'bg-amber-600 text-white ring-amber-600'
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
          <Step title="Hangi yari mamul tipi uretildi?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {semiTypes.map((t) => (
                <BigCard
                  key={t.id}
                  active={type?.id === t.id}
                  onClick={() => {
                    setType(t);
                    setSize(null);
                    setColor(null);
                    setComponent(null);
                    setStep(1);
                  }}
                >
                  <div className="text-xs font-mono text-slate-400">{t.code}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{t.name}</div>
                </BigCard>
              ))}
              {semiTypes.length === 0 && (
                <p className="col-span-full text-sm text-slate-500">
                  Bu ekrandaki turler, urun detayinda YM penceresinden baglanan bilesen turlerinden gelir.
                  Once bir tam mamul varyantinda YM baglantisi yap.
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
                    setComponent(null);
                    setStep(2);
                  }}
                >
                  <div className="text-[10px] font-mono text-slate-400 break-all">{s.code}</div>
                  <div className="mt-1 text-base font-bold text-slate-900 break-words sm:text-xl md:text-2xl">
                    {s.label}
                  </div>
                  {s.value && (
                    <div className="text-xs text-slate-500">
                      {s.value} {s.unit ?? ''}
                    </div>
                  )}
                </BigCard>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title={`${type?.name} ${size?.label} - hangi renk?`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sortedColors.map((c) => {
                const v = detail?.variants.find((x) => x.size_id === size.id && x.color_id === c.id);
                const exists = !!v;
                return (
                  <BigCard
                    key={c.id}
                    active={color?.id === c.id}
                    disabled={!exists}
                    onClick={() => {
                      if (!exists) {
                        toast.error('Bu kombinasyon icin varyant yok. Once urunler sayfasindan olusturun.');
                        return;
                      }
                      setColor(c);
                      setComponent(null);
                      setStep(3);
                    }}
                  >
                    <div className="flex items-center justify-center">
                      <span
                        className="block h-10 w-10 rounded-full ring-2 ring-white shadow-sm"
                        style={{ backgroundColor: c.hex || '#cbd5e1' }}
                      />
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{c.label}</div>
                    <div className="text-xs font-mono text-slate-400">{c.code}</div>
                    {!exists && <div className="mt-1 text-[10px] text-red-500">Varyant yok</div>}
                  </BigCard>
                );
              })}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Hangi parca uretildi?">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {components.map((p) => (
                <BigCard
                  key={p.id}
                  active={component?.id === p.id}
                  onClick={() => {
                    setComponent(p);
                    setStep(4);
                  }}
                >
                  <div className="text-lg font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    1 urunde: {Number(p.required_qty).toLocaleString('tr-TR')} adet
                  </div>
                </BigCard>
              ))}
              {components.length === 0 && (
                <p className="col-span-full text-sm text-slate-500">
                  Bu urun turu icin parca tanimi yok. Urun detayinda "Yari Mamul Parcalari"ndan ekleyin.
                </p>
              )}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Kac adet uretildi?">
            <div className="mx-auto max-w-md space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-slate-500">Yari Mamul</div>
                <div className="mt-1 text-lg font-semibold">
                  {type?.name} - {size?.label} - {color?.label}
                </div>
                <div className="mt-1 text-sm font-medium text-amber-700">Parca: {component?.name}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{variant?.sku}</div>
                {variant && component && (
                  <div className="mt-2 text-xs text-slate-500">
                    Mevcut parca stogu:{' '}
                    <span className="font-medium text-slate-800">
                      {selectedComponentStock.toLocaleString('tr-TR')} adet
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="label text-center block">Adet</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  className="input text-center text-3xl font-bold !py-4"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarih</label>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Not (ops.)</label>
                  <input
                    type="text"
                    className="input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={record.isPending}
                className="btn-primary btn-lg w-full"
              >
                {record.isPending ? 'Kaydediliyor...' : 'Yari Mamul Uretimini Kaydet'}
              </button>
            </div>
          </Step>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={16} /> Geri
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setStep(Math.min(4, step + 1))}
          disabled={
            step === 4 ||
            (step === 0 && !type) ||
            (step === 1 && !size) ||
            (step === 2 && !color) ||
            (step === 3 && !component)
          }
        >
          Ileri <ArrowRight size={16} />
        </button>
      </div>
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
            ? 'bg-brand-50 ring-brand-500 shadow-sm'
            : 'bg-white ring-slate-200 hover:ring-brand-400 hover:shadow-sm'
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
  return [...items].sort((a, b) => {
    const left = toSortableNumber(a?.value);
    const right = toSortableNumber(b?.value);
    const leftIsNumber = !Number.isNaN(left);
    const rightIsNumber = !Number.isNaN(right);

    if (leftIsNumber && rightIsNumber && left !== right) return left - right;
    if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;

    return String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

function toSortableNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return Number(value);
}

function sortColors(items = []) {
  return [...items].sort((a, b) =>
    String(a?.label ?? a?.code ?? '').localeCompare(String(b?.label ?? b?.code ?? ''), 'tr', {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}
