import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, XCircle, Plus, Filter, Tag } from 'lucide-react';
import { useProductionList, useVoidProduction } from '../hooks/useProduction.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import Modal from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';

function todayMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ProductionListPage() {
  const [from, setFrom] = useState(todayMinusDays(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data: items = [], isLoading } = useProductionList({ from, to });
  const voidM = useVoidProduction();
  const navigate = useNavigate();
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');

  const confirmVoid = async () => {
    try {
      await voidM.mutateAsync({ entryId: voiding.id, reason });
      toast.success('Üretim iptal edildi, hammaddeler geri verildi');
      setVoiding(null);
      setReason('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Üretim Geçmişi</h1>
          <p className="text-sm text-slate-500">Yapılan üretimler ve iptal işlemleri</p>
        </div>
        <Link to="/production/new" className="btn-primary">
          <Plus size={16} /> Yeni Üretim
        </Link>
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
        <div className="ml-auto text-sm text-slate-500">{items.length} kayıt</div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Bu aralıkta üretim yok"
          message="Tarih aralığını genişletin veya yeni üretim girin"
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3">Not</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3 text-right">Maliyet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((e) => {
                const cost = (e.production_consumed ?? []).reduce(
                  (s, c) => s + Number(c.qty ?? 0) * Number(c.materials?.last_price ?? 0),
                  0,
                );
                const unitCost = Number(e.qty) > 0 ? cost / Number(e.qty) : 0;
                return (
                <tr
                  key={e.id}
                  className={`text-sm ${e.voided ? 'bg-red-50/40 text-slate-400 line-through' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-3">
                    {new Date(e.date).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {e.product_variants?.product_types?.name} · {e.product_variants?.product_colors?.label} · {e.product_variants?.product_sizes?.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.product_variants?.sku}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {Number(e.qty).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.operator_note ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.voided ? (
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                        İptal: {e.void_reason ?? '—'}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {cost > 0 ? (
                      <div className="leading-tight">
                        <div className="font-semibold text-slate-700">
                          ₺ {cost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          birim ₺ {unitCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!e.voided && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/products/${e.variant_id}/label?qty=${e.qty}&serial=true`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
                          title="Seri numaralı etiket yazdır"
                        >
                          <Tag size={13} /> Etiket
                        </button>
                        <button
                          type="button"
                          onClick={() => setVoiding(e)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                        >
                          <XCircle size={13} /> İptal
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Üretimi iptal et?"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setVoiding(null)}>
              Vazgeç
            </button>
            <button className="btn-danger" onClick={confirmVoid} disabled={voidM.isPending}>
              {voidM.isPending ? 'İptal ediliyor...' : 'Evet, iptal et'}
            </button>
          </>
        }
      >
        {voiding && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              <span className="font-medium">{voiding.qty}</span> adet{' '}
              <span className="font-medium">{voiding.product_variants?.product_types?.name}</span> üretimi geri alınacak. Tüketilen hammaddeler depoya iade edilecek.
            </p>
            {Number(voiding.product_variants?.current_stock ?? 0) < Number(voiding.qty) && (
              <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-amber-200">
                Uyarı: Mevcut depo stoğu bu üretimden az olabilir. Eğer satıldıysa iptal başarısız olur.
              </p>
            )}
            <div>
              <label className="label">İptal sebebi</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: yanlış renk girildi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
