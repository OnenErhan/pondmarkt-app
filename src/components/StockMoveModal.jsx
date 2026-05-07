import { useState } from 'react';
import { useRecordWarehouseMove } from '../hooks/useWarehouse.js';
import Modal from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';

const SOURCES = {
  in: [
    { value: 'return', label: 'İade (Müşteriden)' },
    { value: 'manual', label: 'Manuel Düzeltme' },
    { value: 'transfer', label: 'Transfer Girişi' },
  ],
  out: [
    { value: 'sale', label: 'Satış' },
    { value: 'manual', label: 'Manuel Düzeltme' },
    { value: 'transfer', label: 'Transfer Çıkışı' },
  ],
};

export default function StockMoveModal({ open, onClose, variant, type = 'out' }) {
  const move = useRecordWarehouseMove();
  const [moveType, setMoveType] = useState(type);
  const [source, setSource] = useState(SOURCES[type][0].value);
  const [qty, setQty] = useState('');
  const [customer, setCustomer] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [note, setNote] = useState('');

  const switchType = (t) => {
    setMoveType(t);
    setSource(SOURCES[t][0].value);
  };

  const submit = async () => {
    const q = Number(String(qty).replace(',', '.'));
    if (!q || q <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }
    if (moveType === 'out' && q > Number(variant.current_stock)) {
      toast.error(`Stokta sadece ${variant.current_stock} adet var`);
      return;
    }
    try {
      await move.mutateAsync({
        variantId: variant.id,
        type: moveType,
        qty: q,
        source,
        customer: customer || null,
        orderNo: orderNo || null,
        unitPrice: unitPrice === '' ? null : Number(unitPrice),
        note: note || null,
      });
      toast.success(moveType === 'in' ? `${q} adet girişi yapıldı` : `${q} adet çıkışı yapıldı`);
      onClose?.();
      // reset
      setQty('');
      setCustomer('');
      setOrderNo('');
      setUnitPrice('');
      setNote('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!variant) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${variant.product_types?.name} - Stok Hareketi`}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button className="btn-primary" onClick={submit} disabled={move.isPending}>
            {move.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-900">
            {variant.product_colors?.label} · {variant.product_sizes?.label}
          </div>
          <div className="font-mono text-xs text-slate-500">{variant.sku}</div>
          <div className="mt-1 text-xs text-slate-500">
            Mevcut:{' '}
            <span className="font-semibold text-slate-800">
              {Number(variant.current_stock).toLocaleString('tr-TR')} adet
            </span>
          </div>
        </div>

        {/* Type toggle */}
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
            Stok Girişi (+)
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
            Stok Çıkışı (−)
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
              step="1"
              min="1"
              className="input"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {(source === 'sale' || source === 'return') && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Müşteri</label>
              <input
                type="text"
                className="input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Sipariş No</label>
              <input
                type="text"
                className="input"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
              />
            </div>
            {source === 'sale' && (
              <div className="col-span-2">
                <label className="label">Birim Fiyat (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label">Not</label>
          <input
            type="text"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
