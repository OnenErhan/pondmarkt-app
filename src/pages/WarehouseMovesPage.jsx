import { useState } from 'react';
import { ArrowLeftRight, Filter, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useWarehouseMoves } from '../hooks/useWarehouse.js';
import EmptyState from '../components/ui/EmptyState.jsx';

const SOURCE_LABEL = {
  production: 'Üretim',
  return: 'İade',
  manual: 'Manuel',
  sale: 'Satış',
  transfer: 'Transfer',
  void: 'Üretim İptali',
};

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function WarehouseMovesPage() {
  const [from, setFrom] = useState(todayMinusDays(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const { data: items = [], isLoading } = useWarehouseMoves({
    from,
    to: to ? to + 'T23:59:59' : undefined,
    type: type || undefined,
    source: source || undefined,
  });

  const totalIn = items.filter((i) => i.type === 'in').reduce((s, i) => s + Number(i.qty), 0);
  const totalOut = items.filter((i) => i.type === 'out').reduce((s, i) => s + Number(i.qty), 0);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Depo Hareketleri</h1>
        <p className="text-sm text-slate-500">Tüm giriş/çıkış işlemleri</p>
      </header>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <Filter size={16} className="text-slate-400" />
        <div>
          <label className="label">Başlangıç</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Bitiş</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Yön</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tümü</option>
            <option value="in">Giriş</option>
            <option value="out">Çıkış</option>
          </select>
        </div>
        <div>
          <label className="label">Tip</label>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Tümü</option>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-right text-sm">
          <div className="text-emerald-700">Giriş: <span className="font-semibold">{totalIn.toLocaleString('tr-TR')}</span></div>
          <div className="text-red-700">Çıkış: <span className="font-semibold">{totalOut.toLocaleString('tr-TR')}</span></div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Hareket bulunamadı" message="Filtreleri değiştirin" />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Yön</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3">Müşteri / Sipariş</th>
                <th className="px-4 py-3 text-right">Birim Fiyat</th>
                <th className="px-4 py-3">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((m) => (
                <tr key={m.id} className="text-sm hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(m.date).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {m.type === 'in' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <ArrowDownToLine size={11} /> Giriş
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                        <ArrowUpFromLine size={11} /> Çıkış
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{SOURCE_LABEL[m.source] ?? m.source}</td>
                  <td className="px-4 py-3 font-medium">
                    {m.product_variants?.product_types?.name} ·{' '}
                    {m.product_variants?.product_colors?.label} ·{' '}
                    {m.product_variants?.product_sizes?.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{m.product_variants?.sku}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${m.type === 'in' ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {m.type === 'in' ? '+' : '−'}
                    {Number(m.qty).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.customer || '—'}
                    {m.order_no && <span className="ml-1 text-xs text-slate-400">#{m.order_no}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {m.unit_price ? `${Number(m.unit_price).toLocaleString('tr-TR')} ₺` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
