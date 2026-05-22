import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warehouse, ArrowDownToLine, ArrowUpFromLine, Search, Tag } from 'lucide-react';
import { useSemiComponentWarehouseStock, useWarehouseStock } from '../hooks/useWarehouse.js';
import { useProductTypes } from '../hooks/useProducts.js';
import StockMoveModal from '../components/StockMoveModal.jsx';
import SemiStockMoveModal from '../components/SemiStockMoveModal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function WarehousePage() {
  const [mode, setMode] = useState('products');
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const { data: types = [] } = useProductTypes();
  const { data: stock = [], isLoading } = useWarehouseStock(tab === 'all' ? null : tab);
  const { data: semiStock = [], isLoading: isSemiLoading } = useSemiComponentWarehouseStock(
    tab === 'all' ? null : tab,
  );
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveType, setMoveType] = useState('out');
  const [semiMoveTarget, setSemiMoveTarget] = useState(null);
  const [semiMoveType, setSemiMoveType] = useState('out');

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

  const filteredSemi = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return semiStock;
    return semiStock.filter(
      (row) =>
        row.product_variants?.sku?.toLowerCase().includes(q) ||
        row.product_variants?.product_types?.name?.toLowerCase().includes(q) ||
        row.product_variants?.product_colors?.label?.toLowerCase().includes(q) ||
        row.product_type_semi_components?.name?.toLowerCase().includes(q),
    );
  }, [semiStock, search]);

  const totalUnits = filtered.reduce((s, v) => s + Number(v.current_stock || 0), 0);
  const totalSemiUnits = filteredSemi.reduce((s, v) => s + Number(v.current_stock || 0), 0);

  const openMove = (variant, type) => {
    setMoveTarget(variant);
    setMoveType(type);
  };

  const openSemiMove = (row, type) => {
    setSemiMoveTarget(row);
    setSemiMoveType(type);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Depo</h1>
          <p className="text-sm text-slate-500">
            {mode === 'products' ? 'Bitmis urun stogu' : 'Yari mamul parca stogu'} ·{' '}
            <span className="font-medium text-slate-700">
              Toplam {(mode === 'products' ? totalUnits : totalSemiUnits).toLocaleString('tr-TR')} adet
            </span>
          </p>
        </div>
        <Link to="/warehouse/moves" className="btn-secondary">
          Hareket Geçmişi
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <TabBtn active={mode === 'products'} onClick={() => setMode('products')}>
            Urun Stogu
          </TabBtn>
          <TabBtn active={mode === 'semi'} onClick={() => setMode('semi')}>
            Yari Mamul Stogu
          </TabBtn>
        </div>
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

      {mode === 'products' && isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : mode === 'semi' && isSemiLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : mode === 'products' && filtered.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Stokta ürün yok"
          message="Üretim girişi yapın veya stok girişi ekleyin"
        />
      ) : mode === 'semi' && filteredSemi.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Yari mamul stok kaydi yok"
          message="Yari mamul uretim ekranindan parca uretimi girin"
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {mode === 'products' ? (
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
          ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Renk / Beden</th>
                <th className="px-4 py-3">Parca</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Guncellendi</th>
                <th className="px-4 py-3 text-right">Islem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSemi.map((row) => {
                const empty = Number(row.current_stock || 0) <= 0;
                return (
                <tr key={`${row.variant_id}-${row.component_id}`} className="text-sm hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.product_variants?.product_types?.name}</td>
                  <td className="px-4 py-3">
                    {row.product_variants?.product_colors?.label} · {row.product_variants?.product_sizes?.label}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      {row.product_type_semi_components?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.product_variants?.sku}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(row.current_stock).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {row.updated_at ? new Date(row.updated_at).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openSemiMove(row, 'in')}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        title="Stok girisi"
                      >
                        <ArrowDownToLine size={13} /> Giris
                      </button>
                      <button
                        type="button"
                        onClick={() => openSemiMove(row, 'out')}
                        disabled={empty}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-40"
                        title="Stok cikisi"
                      >
                        <ArrowUpFromLine size={13} /> Cikis
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      )}

      <StockMoveModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        variant={moveTarget}
        type={moveType}
      />
      <SemiStockMoveModal
        open={!!semiMoveTarget}
        onClose={() => setSemiMoveTarget(null)}
        row={semiMoveTarget}
        type={semiMoveType}
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
