import { useState } from 'react';
import { PackagePlus, Plus, Trash2, Save } from 'lucide-react';
import { useMaterials, MATERIAL_CATEGORIES } from '../hooks/useMaterials.js';
import { useSuppliers } from '../hooks/useSuppliers.js';
import { useRecordMaterialIntake } from '../hooks/useWarehouse.js';
import { toast } from '../components/ui/Toast.jsx';

const newRow = () => ({ material_id: '', qty: '', unit_price: '', supplier_id: '', note: '' });

export default function MaterialIntakePage() {
  const { data: materials = [] } = useMaterials();
  const { data: suppliers = [] } = useSuppliers();
  const intake = useRecordMaterialIntake();
  const [rows, setRows] = useState([newRow(), newRow(), newRow()]);

  const grouped = MATERIAL_CATEGORIES.map((c) => ({
    ...c,
    materials: materials.filter((m) => m.category === c.value),
  }));

  const update = (i, field, val) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  };
  const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () => setRows((r) => [...r, newRow()]);
  const reset = () => setRows([newRow(), newRow(), newRow()]);

  const total = rows.reduce((sum, r) => {
    const q = Number(r.qty) || 0;
    const p = Number(r.unit_price) || 0;
    return sum + q * p;
  }, 0);

  const submit = async () => {
    const items = rows
      .filter((r) => r.material_id && Number(r.qty) > 0)
      .map((r) => ({
        material_id: r.material_id,
        qty: Number(String(r.qty).replace(',', '.')),
        unit_price: r.unit_price === '' ? null : Number(String(r.unit_price).replace(',', '.')),
        supplier_id: r.supplier_id || null,
        note: r.note || null,
      }));
    if (items.length === 0) {
      toast.error('En az bir geçerli kalem girin');
      return;
    }
    try {
      const count = await intake.mutateAsync({ items });
      toast.success(`${count} kalem hammadde alındı`);
      reset();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
          <PackagePlus size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hammadde Alımı</h1>
          <p className="text-sm text-slate-500">Toplu satır halinde alım kaydı oluşturun</p>
        </div>
      </header>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Hammadde *</th>
                <th className="px-2 py-2 w-32">Miktar *</th>
                <th className="px-2 py-2 w-32">Birim Fiyat</th>
                <th className="px-2 py-2 w-44">Tedarikçi</th>
                <th className="px-2 py-2">Not</th>
                <th className="px-2 py-2 w-32 text-right">Tutar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const mat = materials.find((m) => m.id === r.material_id);
                const lineTotal = (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        value={r.material_id}
                        onChange={(e) => update(i, 'material_id', e.target.value)}
                      >
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
                    </td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="input"
                          value={r.qty}
                          onChange={(e) => update(i, 'qty', e.target.value)}
                        />
                        {mat && (
                          <span className="pointer-events-none absolute right-2 top-2.5 text-xs text-slate-400">
                            {mat.unit}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input"
                        placeholder="₺"
                        value={r.unit_price}
                        onChange={(e) => update(i, 'unit_price', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        value={r.supplier_id}
                        onChange={(e) => update(i, 'supplier_id', e.target.value)}
                      >
                        <option value="">— —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        className="input"
                        value={r.note}
                        onChange={(e) => update(i, 'note', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-medium text-slate-800">
                      {lineTotal > 0 ? `${lineTotal.toLocaleString('tr-TR')} ₺` : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Sil"
                        disabled={rows.length === 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={5} className="px-2 py-3 text-right text-sm font-medium text-slate-600">
                  Toplam
                </td>
                <td className="px-2 py-3 text-right text-base font-bold text-slate-900">
                  {total > 0 ? `${total.toLocaleString('tr-TR')} ₺` : '—'}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={add}>
            <Plus size={14} /> Satır Ekle
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
              Temizle
            </button>
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={submit}
              disabled={intake.isPending}
            >
              <Save size={16} /> {intake.isPending ? 'Kaydediliyor...' : 'Alımı Kaydet'}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Birim fiyat girilirse hammaddenin son fiyatı güncellenir. Boş bırakırsanız sadece miktar
        eklenir.
      </p>
    </div>
  );
}
