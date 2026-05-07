import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, ArrowDownToLine, ArrowUpFromLine, Search, Tag } from 'lucide-react';
import { useWarehouseStock } from '../hooks/useWarehouse.js';
import { useProductTypes } from '../hooks/useProducts.js';
import StockMoveModal from '../components/StockMoveModal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function WarehousePage() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const { data: types = [] } = useProductTypes();
  const { data: stock = [], isLoading } = useWarehouseStock(tab === 'all' ? null : tab);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveType, setMoveType] = useState('out');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter(
      (v) =>
        v.sku.toLowerCase().includes(q) ||
        v.product_types?.name?.toLowerCase().includes(q) ||
        v.product_colors?.label?.toLowerCase().includes(q),
    );
  }, [stock, search]);

  const totalUnits = filtered.reduce((s, v) => s + Number(v.current_stock || 0), 0);

  const openMove = (variant, type) => {
    setMoveTarget(variant);
    setMoveType(type);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Depo</h1>
          <p className="text-sm text-slate-500">
            Bitmiş ürün stoğu ·{' '}
            <span className="font-medium text-slate-700">
              Toplam {totalUnits.toLocaleString('tr-TR')} adet
            </span>
          </p>
        </div>
        <Link to="/warehouse/moves" className="btn-secondary">
          Hareket Geçmişi
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            Tümü
          </TabBtn>
          {types.map((t) => (
            <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.name}
            </TabBtn>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-2 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="SKU / ürün ara..."
            className="input pl-7 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Stokta ürün yok"
          message="Üretim girişi yapın veya stok girişi ekleyin"
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Renk / Beden</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((v) => {
                const empty = Number(v.current_stock) <= 0;
                return (
                  <tr key={v.id} className="text-sm hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{v.product_types?.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-200"
                          style={{ backgroundColor: v.product_colors?.hex || '#cbd5e1' }}
                        />
                        <span>{v.product_colors?.label}</span>
                        <span className="text-slate-300">·</span>
                        <span>{v.product_sizes?.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${empty ? 'text-slate-400' : 'text-slate-900'}`}
                    >
                      {Number(v.current_stock).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openMove(v, 'in')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                          title="Stok girişi"
                        >
                          <ArrowDownToLine size={13} /> Giriş
                        </button>
                        <button
                          type="button"
                          onClick={() => openMove(v, 'out')}
                          disabled={empty}
                          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-40"
                          title="Stok çıkışı"
                        >
                          <ArrowUpFromLine size={13} /> Çıkış
                        </button>
                        <Link
                          to={`/products/${v.id}/label`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Barkod etiketi"
                        >
                          <Tag size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StockMoveModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        variant={moveTarget}
        type={moveType}
      />
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
