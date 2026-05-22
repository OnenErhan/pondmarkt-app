import { useEffect, useState } from 'react';
import Modal from './ui/Modal.jsx';
import { toast } from './ui/Toast.jsx';
import { useRecordSemiComponentMove } from '../hooks/useWarehouse.js';

const SOURCES = {
  in: [
    { value: 'manual', label: 'Manuel Duzeltme' },
    { value: 'transfer', label: 'Transfer Girisi' },
  ],
  out: [
    { value: 'manual', label: 'Manuel Duzeltme' },
    { value: 'transfer', label: 'Transfer Cikisi' },
  ],
};

export default function SemiStockMoveModal({ open, onClose, row, type = 'out' }) {
  const move = useRecordSemiComponentMove();
  const [moveType, setMoveType] = useState(type);
  const [source, setSource] = useState(SOURCES[type][0].value);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setMoveType(type);
    setSource(SOURCES[type][0].value);
  }, [type, row?.variant_id, row?.component_id]);

  const switchType = (next) => {
    setMoveType(next);
    setSource(SOURCES[next][0].value);
  };

  const submit = async () => {
    const q = Number(String(qty).replace(',', '.'));
    if (!q || q <= 0) {
      toast.error('Gecerli bir miktar girin');
      return;
    }
    if (moveType === 'out' && q > Number(row.current_stock || 0)) {
      toast.error(`Stokta sadece ${row.current_stock} adet var`);
      return;
    }

    try {
      await move.mutateAsync({
        variantId: row.variant_id,
        componentId: row.component_id,
        type: moveType,
        qty: q,
        note: [source === 'transfer' ? 'Transfer' : 'Manuel', note].filter(Boolean).join(' - '),
      });
      toast.success(moveType === 'in' ? `${q} adet giris yapildi` : `${q} adet cikis yapildi`);
      onClose?.();
      setQty('');
      setNote('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!row) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Yari Mamul Parca Hareketi - ${row.product_type_semi_components?.name ?? 'Parca'}`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgec
          </button>
          <button className="btn-primary" onClick={submit} disabled={move.isPending}>
            {move.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-900">{row.product_variants?.product_types?.name}</div>
          <div className="text-slate-600">
            {row.product_variants?.product_colors?.label} · {row.product_variants?.product_sizes?.label}
          </div>
          <div className="font-mono text-xs text-slate-500">{row.product_variants?.sku}</div>
          <div className="mt-1 text-xs text-slate-500">
            Mevcut:{' '}
            <span className="font-semibold text-slate-800">
              {Number(row.current_stock || 0).toLocaleString('tr-TR')} adet
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-lg p-3 text-sm font-semibold ring-2 ${
              moveType === 'in'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-500'
                : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'
            }`}
            onClick={() => switchType('in')}
          >
            Stok Girisi (+)
          </button>
          <button
            type="button"
            className={`rounded-lg p-3 text-sm font-semibold ring-2 ${
              moveType === 'out'
                ? 'bg-red-50 text-red-700 ring-red-500'
                : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'
            }`}
            onClick={() => switchType('out')}
          >
            Stok Cikisi (-)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tip</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES[moveType].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Miktar (adet) *</label>
            <input
              type="number"
              min="1"
              step="1"
              className="input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="label">Not</label>
          <input
            type="text"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opsiyonel"
          />
        </div>
      </div>
    </Modal>
  );
}
