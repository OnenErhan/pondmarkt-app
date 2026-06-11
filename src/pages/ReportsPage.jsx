import { useMemo, useState } from 'react';
import { BarChart3, Download, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase/client.js';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '../components/ui/EmptyState.jsx';
import { toast } from '../components/ui/Toast.jsx';

const TABS = [
  { value: 'fullProduction', label: 'Tam Mamul' },
  { value: 'semiProduction', label: 'Yarı Mamul' },
  { value: 'sales', label: 'Satış' },
  { value: 'consumption', label: 'Hammadde Tüketimi' },
];

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtTl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

export default function ReportsPage() {
  const [tab, setTab] = useState('production');
  const [from, setFrom] = useState(todayMinusDays(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <BarChart3 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Raporlar</h1>
          <p className="text-sm text-slate-500">Tarih aralığına göre özet ve Excel dışa aktarım</p>
        </div>
      </header>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === t.value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Filter size={16} className="text-slate-400" />
          <div>
            <label className="label">Başlangıç</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setFrom(todayMinusDays(7));
              setTo(new Date().toISOString().slice(0, 10));
            }}
          >
            Son 7 gün
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setFrom(todayMinusDays(30));
              setTo(new Date().toISOString().slice(0, 10));
            }}
          >
            Son 30 gün
          </button>
        </div>
      </div>

      {tab === 'fullProduction' && <FullProductionReport from={from} to={to} />}
      {tab === 'semiProduction' && <SemiProductionReport from={from} to={to} />}
      {tab === 'sales' && <SalesReport from={from} to={to} />}
      {tab === 'consumption' && <ConsumptionReport from={from} to={to} />}
    </div>
  );
}

function formatVariantLabel(row) {
  return `${row.product_variants?.product_types?.name ?? ''} · ${row.product_variants?.product_colors?.label ?? ''} · ${row.product_variants?.product_sizes?.label ?? ''}`;
}

// --- Tam mamul report ---
function useFullProductionReport(from, to) {
  return useQuery({
    queryKey: ['report', 'full-production', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_entries')
        .select(
          'id, date, qty, operator_note, entry_kind, product_variants(sku, product_types(name), product_sizes(label), product_colors(label))',
        )
        .or('entry_kind.eq.full,entry_kind.is.null')
        .gte('date', from)
        .lte('date', to)
        .order('date');
      if (error) throw error;
      return data || [];
    },
  });
}

function FullProductionReport({ from, to }) {
  const { data: rows = [], isLoading } = useFullProductionReport(from, to);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.product_variants?.sku ?? '?';
      const cur = map.get(key) || {
        sku: key,
        type: r.product_variants?.product_types?.name ?? '',
        color: r.product_variants?.product_colors?.label ?? '',
        size: r.product_variants?.product_sizes?.label ?? '',
        qty: 0,
        count: 0,
      };
      cur.qty += Number(r.qty);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [rows]);

  const total = grouped.reduce((s, r) => s + r.qty, 0);

  const exportXlsx = () => {
    if (grouped.length === 0) {
      toast.error('İhraç edilecek veri yok');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        grouped.map((r) => ({
          SKU: r.sku,
          Tip: r.type,
          Renk: r.color,
          Beden: r.size,
          'Toplam Adet': r.qty,
          'Kayıt Sayısı': r.count,
        })),
      ),
      'Özet',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          Tarih: r.date,
          SKU: r.product_variants?.sku,
          Tip: r.product_variants?.product_types?.name,
          Renk: r.product_variants?.product_colors?.label,
          Beden: r.product_variants?.product_sizes?.label,
          Adet: Number(r.qty),
          Not: r.operator_note ?? '',
        })),
      ),
      'Detay',
    );
    XLSX.writeFile(wb, `tam-mamul-raporu-${from}_${to}.xlsx`);
    toast.success('Excel indirildi');
  };

  if (isLoading) return <p className="text-sm text-slate-400">Yükleniyor...</p>;
  if (rows.length === 0)
    return <EmptyState icon={BarChart3} title="Bu aralıkta tam mamul üretimi yok" message="Tarih aralığını genişletin" />;

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Toplam Tam Mamul</div>
          <div className="text-2xl font-bold text-slate-900">{fmt(total)} adet</div>
          <div className="text-xs text-slate-500">{rows.length} kayıt · {grouped.length} farklı varyant</div>
        </div>
        <button type="button" onClick={exportXlsx} className="btn-primary">
          <Download size={16} /> Excel İndir
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3 text-right">Adet</th>
              <th className="px-4 py-3 text-right">Kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {grouped.map((r) => (
              <tr key={r.sku} className="text-sm hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-3">{r.type} · {r.color} · {r.size}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(r.qty)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Yari mamul report ---
function useSemiProductionReport(from, to) {
  return useQuery({
    queryKey: ['report', 'semi-production', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('semi_component_production_entries')
        .select(
          'id, date, qty, operator_note, product_variants(sku, product_types(name), product_sizes(label), product_colors(label)), product_type_semi_components(name)',
        )
        .gte('date', from)
        .lte('date', to)
        .order('date');
      if (error) throw error;
      return data || [];
    },
  });
}

function SemiProductionReport({ from, to }) {
  const { data: rows = [], isLoading } = useSemiProductionReport(from, to);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const sku = r.product_variants?.sku ?? '?';
      const component = r.product_type_semi_components?.name ?? 'Parça';
      const key = `${sku}__${component}`;
      const cur = map.get(key) || {
        sku,
        component,
        name: formatVariantLabel(r),
        qty: 0,
        count: 0,
      };
      cur.qty += Number(r.qty);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [rows]);

  const totalQty = grouped.reduce((s, r) => s + r.qty, 0);

  const exportXlsx = () => {
    if (grouped.length === 0) {
      toast.error('İhraç edilecek veri yok');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        grouped.map((r) => ({
          SKU: r.sku,
          Ürün: r.name,
          Parça: r.component,
          Adet: r.qty,
          Kayıt: r.count,
        })),
      ),
      'Özet',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          Tarih: r.date,
          SKU: r.product_variants?.sku,
          Ürün: formatVariantLabel(r),
          Parça: r.product_type_semi_components?.name,
          Adet: Number(r.qty),
          Not: r.operator_note ?? '',
        })),
      ),
      'Detay',
    );
    XLSX.writeFile(wb, `yari-mamul-raporu-${from}_${to}.xlsx`);
    toast.success('Excel indirildi');
  };

  if (isLoading) return <p className="text-sm text-slate-400">Yükleniyor...</p>;
  if (rows.length === 0)
    return <EmptyState icon={BarChart3} title="Bu aralıkta yarı mamul üretimi yok" message="Tarih aralığını genişletin" />;

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Toplam Yarı Mamul</div>
          <div className="text-2xl font-bold text-slate-900">{fmt(totalQty)} adet</div>
          <div className="text-xs text-slate-500">{rows.length} kayıt · {grouped.length} farklı parça/ürün</div>
        </div>
        <button type="button" onClick={exportXlsx} className="btn-primary">
          <Download size={16} /> Excel İndir
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Parça</th>
              <th className="px-4 py-3 text-right">Adet</th>
              <th className="px-4 py-3 text-right">Kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {grouped.map((r) => (
              <tr key={`${r.sku}-${r.component}`} className="text-sm hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{r.component}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(r.qty)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Sales report ---
function useSalesReport(from, to) {
  return useQuery({
    queryKey: ['report', 'sales', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_moves')
        .select(
          'id, date, qty, unit_price, customer, order_no, product_variants(sku, product_types(name), product_sizes(label), product_colors(label))',
        )
        .eq('type', 'out')
        .eq('source', 'sale')
        .gte('date', from)
        .lte('date', to + 'T23:59:59')
        .order('date');
      if (error) throw error;
      return data || [];
    },
  });
}

function SalesReport({ from, to }) {
  const { data: rows = [], isLoading } = useSalesReport(from, to);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.product_variants?.sku ?? '?';
      const cur = map.get(key) || {
        sku: key,
        name: `${r.product_variants?.product_types?.name ?? ''} · ${r.product_variants?.product_colors?.label ?? ''} · ${r.product_variants?.product_sizes?.label ?? ''}`,
        qty: 0,
        revenue: 0,
      };
      cur.qty += Number(r.qty);
      cur.revenue += Number(r.qty) * Number(r.unit_price || 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const totalQty = grouped.reduce((s, r) => s + r.qty, 0);
  const totalRev = grouped.reduce((s, r) => s + r.revenue, 0);

  const exportXlsx = () => {
    if (rows.length === 0) {
      toast.error('İhraç edilecek veri yok');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        grouped.map((r) => ({ SKU: r.sku, Ürün: r.name, 'Adet': r.qty, 'Ciro (TL)': r.revenue })),
      ),
      'Özet',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          Tarih: r.date,
          SKU: r.product_variants?.sku,
          Ürün: `${r.product_variants?.product_types?.name} · ${r.product_variants?.product_colors?.label} · ${r.product_variants?.product_sizes?.label}`,
          Adet: Number(r.qty),
          'Birim Fiyat': Number(r.unit_price || 0),
          Tutar: Number(r.qty) * Number(r.unit_price || 0),
          Müşteri: r.customer ?? '',
          'Sipariş No': r.order_no ?? '',
        })),
      ),
      'Detay',
    );
    XLSX.writeFile(wb, `satis-raporu-${from}_${to}.xlsx`);
    toast.success('Excel indirildi');
  };

  if (isLoading) return <p className="text-sm text-slate-400">Yükleniyor...</p>;
  if (rows.length === 0)
    return <EmptyState icon={BarChart3} title="Bu aralıkta satış yok" message="Tarih aralığını genişletin" />;

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div className="flex gap-8">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Toplam Adet</div>
            <div className="text-2xl font-bold text-slate-900">{fmt(totalQty)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Toplam Ciro</div>
            <div className="text-2xl font-bold text-emerald-700">{fmtTl(totalRev)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Sipariş Sayısı</div>
            <div className="text-2xl font-bold text-slate-900">{rows.length}</div>
          </div>
        </div>
        <button type="button" onClick={exportXlsx} className="btn-primary">
          <Download size={16} /> Excel İndir
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3 text-right">Adet</th>
              <th className="px-4 py-3 text-right">Ciro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {grouped.map((r) => (
              <tr key={r.sku} className="text-sm hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(r.qty)}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  {fmtTl(r.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Consumption report (production_consumed in date range) ---
function useConsumptionReport(from, to) {
  return useQuery({
    queryKey: ['report', 'consumption', from, to],
    queryFn: async () => {
      // get entries in range, then their consumed
      const entries = await supabase
        .from('production_entries')
        .select('id')
        .eq('voided', false)
        .gte('date', from)
        .lte('date', to);
      if (entries.error) throw entries.error;
      const ids = (entries.data || []).map((e) => e.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('production_consumed')
        .select('qty, materials(code,name,unit,category,last_price)')
        .in('entry_id', ids);
      if (error) throw error;
      return data || [];
    },
  });
}

function ConsumptionReport({ from, to }) {
  const { data: rows = [], isLoading } = useConsumptionReport(from, to);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const m = r.materials;
      if (!m) return;
      const key = m.code;
      const cur = map.get(key) || {
        code: m.code,
        name: m.name,
        unit: m.unit,
        category: m.category,
        last_price: Number(m.last_price || 0),
        qty: 0,
      };
      cur.qty += Number(r.qty);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, cost: r.qty * r.last_price }))
      .sort((a, b) => b.cost - a.cost);
  }, [rows]);

  const totalCost = grouped.reduce((s, r) => s + r.cost, 0);

  const exportXlsx = () => {
    if (grouped.length === 0) {
      toast.error('İhraç edilecek veri yok');
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        grouped.map((r) => ({
          Kod: r.code,
          Hammadde: r.name,
          Kategori: r.category,
          'Tüketilen Miktar': r.qty,
          Birim: r.unit,
          'Son Birim Fiyat': r.last_price,
          'Tahmini Maliyet (TL)': r.cost,
        })),
      ),
      'Tüketim',
    );
    XLSX.writeFile(wb, `tuketim-raporu-${from}_${to}.xlsx`);
    toast.success('Excel indirildi');
  };

  if (isLoading) return <p className="text-sm text-slate-400">Yükleniyor...</p>;
  if (grouped.length === 0)
    return <EmptyState icon={BarChart3} title="Bu aralıkta tüketim yok" message="Tarih aralığını genişletin" />;

  const CAT_LABEL = { chemical: 'Kimyasal', accessory: 'Aksesuar', packaging: 'Ambalaj' };

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Toplam Tahmini Maliyet</div>
          <div className="text-2xl font-bold text-amber-700">{fmtTl(totalCost)}</div>
          <div className="text-xs text-slate-500">{grouped.length} farklı hammadde</div>
        </div>
        <button type="button" onClick={exportXlsx} className="btn-primary">
          <Download size={16} /> Excel İndir
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Kod</th>
              <th className="px-4 py-3">Hammadde</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Tüketim</th>
              <th className="px-4 py-3 text-right">Birim Fiyat</th>
              <th className="px-4 py-3 text-right">Maliyet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {grouped.map((r) => (
              <tr key={r.code} className="text-sm hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{CAT_LABEL[r.category] ?? r.category}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {fmt(r.qty)} {r.unit}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {r.last_price ? fmtTl(r.last_price) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">
                  {r.cost > 0 ? fmtTl(r.cost) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
