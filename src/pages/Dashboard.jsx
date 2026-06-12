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
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useDashboardStats,
  useDailyOps,
  useOpsHealth,
  useTopVariants,
} from '../hooks/useDashboard.js';

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtTl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`;
const fmtShortDate = (s) => {
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: dailyOps = [], isLoading: isOpsLoading } = useDailyOps(14);
  const { data: opsHealth, isLoading: isHealthLoading } = useOpsHealth();
  const { data: topAll = [] } = useTopVariants({
    from: todayMinusDays(30),
    to: new Date().toISOString().slice(0, 10),
    limit: 5,
  });

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
              <TrendingUp size={16} /> Son 14 Gün Üretim vs Satış
            </h2>
            <Link to="/production" className="text-xs text-brand-600 hover:underline">
              Tümünü gör <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {dailyOps.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Veri yok</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyOps} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtShortDate}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<OpsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="productionQty"
                    name="Üretim"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="saleQty"
                    name="Satış"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={16} className="text-brand-600" />
              <h2 className="text-base font-semibold">Aktivite Kontrolü</h2>
            </div>
            {isHealthLoading ? (
              <p className="py-4 text-sm text-slate-400">Kontrol ediliyor…</p>
            ) : (
              <div className="space-y-3 text-sm">
                <ActivityRow
                  label="Üretim"
                  active={Boolean(opsHealth?.productionActive)}
                  qty={opsHealth?.weeklyProductionQty}
                  lastDate={opsHealth?.lastProductionDate}
                />
                <ActivityRow
                  label="Satış"
                  active={Boolean(opsHealth?.saleActive)}
                  qty={opsHealth?.weeklySaleQty}
                  lastDate={opsHealth?.lastSaleDate}
                />
                <p className="pt-1 text-xs text-slate-500">
                  Son 7 gün işlem miktarına göre değerlendirilir.
                </p>
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
                {stats.lowStockItems.slice(0, 4).map((m) => (
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
                {stats.lowStockItems.length > 4 && (
                  <p className="text-center text-xs text-slate-500">
                    +{stats.lowStockItems.length - 4} daha
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Son 14 Gün Ciro Trendi</h2>
            <Link to="/reports" className="text-xs text-brand-600 hover:underline">
              Ciro detay <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          {dailyOps.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Ciro verisi yok</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyOps} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ciroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtShortDate}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => fmtTl(v)} labelFormatter={(l) => new Date(l).toLocaleDateString('tr-TR')} />
                  <Area
                    type="monotone"
                    dataKey="saleRevenue"
                    name="Ciro"
                    stroke="#16a34a"
                    fill="url(#ciroGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

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

      {isOpsLoading && (
        <p className="mt-4 text-center text-xs text-slate-500">Grafikler güncelleniyor…</p>
      )}
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

function ActivityRow({ label, active, qty, lastDate }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-800">{label}</div>
        <div className={`inline-flex items-center gap-1 text-xs font-semibold ${active ? 'text-emerald-700' : 'text-red-700'}`}>
          {active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {active ? 'Aktif' : 'Pasif'}
        </div>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Son 7 gün miktar: <span className="font-semibold text-slate-700">{fmt(qty)}</span>
      </div>
      <div className="text-xs text-slate-500">
        Son işlem: {lastDate ? new Date(lastDate).toLocaleDateString('tr-TR') : '-'}
      </div>
    </div>
  );
}

function OpsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const prod = payload.find((p) => p.dataKey === 'productionQty')?.value ?? 0;
  const sale = payload.find((p) => p.dataKey === 'saleQty')?.value ?? 0;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-slate-700">{new Date(label).toLocaleDateString('tr-TR')}</div>
      <div className="text-emerald-700">Üretim: {fmt(prod)} adet</div>
      <div className="text-brand-700">Satış: {fmt(sale)} adet</div>
      <div className="text-slate-600">Ciro: {fmtTl(row?.saleRevenue || 0)}</div>
    </div>
  );
}
