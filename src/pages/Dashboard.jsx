import { Link } from 'react-router-dom';
import {
  Boxes,
  Package,
  Factory,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useDashboardStats, useDailyProduction, useTopVariants } from '../hooks/useDashboard.js';

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtTl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`;

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: daily = [] } = useDailyProduction(14);
  const { data: topAll = [] } = useTopVariants({
    from: todayMinusDays(30),
    to: new Date().toISOString().slice(0, 10),
    limit: 5,
  });

  const maxDaily = Math.max(1, ...daily.map((d) => d.qty));

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Factory} color="emerald" label="Bugünkü Üretim"
          value={isLoading ? '…' : fmt(stats?.todayProduction)}
          sub={`Bu ay: ${fmt(stats?.monthProduction)} adet`} to="/production" />
        <Kpi icon={ShoppingCart} color="brand" label="Bugünkü Satış"
          value={isLoading ? '…' : fmt(stats?.todaySaleQty)}
          sub={`Ciro: ${fmtTl(stats?.todayRevenue)}`} to="/warehouse/moves" />
        <Kpi icon={Package} color="violet" label="Depo Ürün"
          value={isLoading ? '…' : fmt(stats?.variantStock)} sub="adet" to="/warehouse" />
        <Kpi icon={Boxes} color="amber" label="Hammadde Değeri"
          value={isLoading ? '…' : fmtTl(stats?.materialValue)}
          sub={`${stats?.lowStockItems?.length ?? 0} düşük stok`} to="/materials" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp size={16} /> Son 14 Günlük Üretim
            </h2>
            <Link to="/production" className="text-xs text-brand-600 hover:underline">
              Tümünü gör <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {daily.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Veri yok</p>
          ) : (
            <div className="flex h-48 items-end gap-1">
              {daily.map((d) => {
                const h = (d.qty / maxDaily) * 100;
                const dt = new Date(d.date);
                return (
                  <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                    <div
                      className={`w-full rounded-t transition ${d.qty > 0 ? 'bg-brand-500 hover:bg-brand-600' : 'bg-slate-100'}`}
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={`${dt.toLocaleDateString('tr-TR')}: ${d.qty}`}
                    />
                    <div className="absolute -top-6 hidden rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
                      {d.qty}
                    </div>
                    <span className="mt-1 text-[10px] text-slate-400">
                      {dt.getDate()}/{dt.getMonth() + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2 text-red-700">
              <AlertTriangle size={16} /> Düşük Stok
            </h2>
            <Link to="/materials" className="text-xs text-brand-600 hover:underline">
              Hammaddeler <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {!stats?.lowStockItems?.length ? (
            <p className="py-6 text-center text-sm text-slate-400">Tüm stoklar yeterli</p>
          ) : (
            <div className="space-y-2">
              {stats.lowStockItems.slice(0, 6).map((m) => (
                <div key={m.id}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm ring-1 ring-red-100">
                  <div>
                    <div className="font-medium text-slate-900">{m.name}</div>
                    <div className="text-xs font-mono text-slate-500">{m.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-700">{fmt(m.current_stock)} {m.unit}</div>
                    <div className="text-xs text-slate-500">min {fmt(m.min_stock)}</div>
                  </div>
                </div>
              ))}
              {stats.lowStockItems.length > 6 && (
                <p className="text-center text-xs text-slate-500">
                  +{stats.lowStockItems.length - 6} daha
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
            <Calendar size={16} /> Bu Ay Özet
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Üretim" value={`${fmt(stats?.monthProduction)} adet`} />
            <Stat label="Satış" value={`${fmt(stats?.monthSaleQty)} adet`} />
            <Stat label="Aylık Ciro" value={fmtTl(stats?.monthRevenue)} accent="emerald" />
            <Stat label="Bugün Ciro" value={fmtTl(stats?.todayRevenue)} accent="emerald" />
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Son 30 Gün Çok Satanlar</h2>
            <Link to="/reports" className="text-xs text-brand-600 hover:underline">
              Raporlar <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {topAll.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Satış verisi yok</p>
          ) : (
            <div className="space-y-2">
              {topAll.map((v, i) => (
                <div key={v.sku} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{v.name}</div>
                    <div className="text-xs font-mono text-slate-500">{v.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmt(v.qty)} adet</div>
                    {v.revenue > 0 && <div className="text-xs text-emerald-700">{fmtTl(v.revenue)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const COLORS = {
  brand: 'bg-brand-50 text-brand-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
};

function Kpi({ icon: Icon, color, label, value, sub, to }) {
  const Wrapper = to ? Link : 'div';
  return (
    <Wrapper to={to} className="card group flex items-start gap-3 transition hover:shadow-md">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${COLORS[color]}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-0.5 text-2xl font-bold text-slate-900">{value}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </Wrapper>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}
