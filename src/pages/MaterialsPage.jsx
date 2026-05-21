import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, Boxes, PackagePlus } from 'lucide-react';
import {
  MATERIAL_CATEGORIES,
  useMaterials,
  useDeleteMaterial,
  useAdjustMaterialStock,
} from '../hooks/useMaterials.js';
import MaterialFormModal from '../components/MaterialFormModal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Modal from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';

const CAT_COLOR = {
  chemical: 'bg-blue-50 text-blue-700 ring-blue-200',
  accessory: 'bg-purple-50 text-purple-700 ring-purple-200',
  packaging: 'bg-orange-50 text-orange-700 ring-orange-200',
};

const CATEGORY_LABEL_MAP = Object.fromEntries(MATERIAL_CATEGORIES.map((c) => [c.value, c.label]));

const SORTABLE_COLUMNS = [
  { key: 'code', label: 'Kod', align: 'left', getValue: (m) => m.code ?? '', type: 'text' },
  { key: 'name', label: 'İsim', align: 'left', getValue: (m) => m.name ?? '', type: 'text' },
  {
    key: 'category',
    label: 'Kategori',
    align: 'left',
    getValue: (m) => CATEGORY_LABEL_MAP[m.category] ?? m.category ?? '',
    type: 'text',
  },
  { key: 'current_stock', label: 'Stok', align: 'right', getValue: (m) => m.current_stock, type: 'number' },
  { key: 'min_stock', label: 'Min', align: 'right', getValue: (m) => m.min_stock, type: 'number' },
  { key: 'unit', label: 'Birim', align: 'left', getValue: (m) => m.unit ?? '', type: 'text' },
  {
    key: 'supplier',
    label: 'Tedarikçi',
    align: 'left',
    getValue: (m) => m.suppliers?.name ?? '',
    type: 'text',
  },
  { key: 'last_price', label: 'Son Fiyat', align: 'right', getValue: (m) => m.last_price, type: 'number' },
];

export default function MaterialsPage() {
  const [tab, setTab] = useState('all');
  const [sortKey, setSortKey] = useState('code');
  const [sortDirection, setSortDirection] = useState('asc');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [adding, setAdding] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [addNote, setAddNote] = useState('');

  const { data: items = [], isLoading } = useMaterials(tab === 'all' ? null : tab);
  const del = useDeleteMaterial();
  const adjust = useAdjustMaterialStock();

  const sortedItems = useMemo(() => {
    const col = SORTABLE_COLUMNS.find((c) => c.key === sortKey) ?? SORTABLE_COLUMNS[0];
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => compareValues(col.getValue(a), col.getValue(b), col.type) * dir);
  }, [items, sortDirection, sortKey]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const openAdd = (m) => {
    setAdding(m);
    setAddQty('');
    setAddNote('');
  };
  const confirmAdd = async () => {
    const qty = Number(String(addQty).replace(',', '.'));
    if (!qty || qty <= 0) {
      toast.error('Geçerli bir miktar girin');
      return;
    }
    try {
      await adjust.mutateAsync({ materialId: adding.id, delta: qty, note: addNote || 'Hızlı stok ekleme' });
      toast.success(`${qty} ${adding.unit} eklendi`);
      setAdding(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (m) => {
    setEditing(m);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    try {
      await del.mutateAsync(deleting.id);
      toast.success('Hammadde silindi');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hammaddeler</h1>
          <p className="text-sm text-slate-500">Stok ve fiyat yönetimi</p>
        </div>
        <button type="button" onClick={openNew} className="btn-primary">
          <Plus size={16} />
          Yeni Hammadde
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
          Tümü
        </TabBtn>
        {MATERIAL_CATEGORIES.map((c) => (
          <TabBtn key={c.value} active={tab === c.value} onClick={() => setTab(c.value)}>
            {c.label}
          </TabBtn>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Henüz hammadde yok"
          message="Yeni Hammadde butonu ile ekleyebilirsin"
          action={
            <button type="button" onClick={openNew} className="btn-primary">
              <Plus size={16} />
              Yeni Hammadde
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                {SORTABLE_COLUMNS.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    align={col.align}
                    isActive={sortKey === col.key}
                    direction={sortDirection}
                    onClick={() => onSort(col.key)}
                  />
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedItems.map((m) => {
                const isLow = Number(m.current_stock) <= Number(m.min_stock);
                return (
                  <tr key={m.id} className="text-sm hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{m.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${CAT_COLOR[m.category]}`}
                      >
                        {MATERIAL_CATEGORIES.find((c) => c.value === m.category)?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${isLow ? 'text-red-600' : 'text-slate-800'}`}
                      >
                        {isLow && <AlertTriangle size={12} />}
                        {Number(m.current_stock).toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {Number(m.min_stock).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.unit}</td>
                    <td className="px-4 py-3 text-slate-600">{m.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {m.last_price ? `${Number(m.last_price).toLocaleString('tr-TR')} ₺` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openAdd(m)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                          aria-label="Stok Ekle"
                          title="Stok ekle"
                        >
                          <PackagePlus size={13} /> Stok Ekle
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Düzenle"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(m)}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <MaterialFormModal
          key={editing?.id ?? 'new'}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          initial={editing ?? undefined}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Hammaddeyi sil?"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleting(null)}>
              Vazgeç
            </button>
            <button className="btn-danger" onClick={confirmDelete}>
              Sil
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-medium">{deleting?.name}</span> kaydı silinecek. Bu hammadde
          herhangi bir reçete veya stok hareketinde kullanıldıysa silinemez.
        </p>
      </Modal>

      <Modal
        open={!!adding}
        onClose={() => setAdding(null)}
        title="Stok Ekle"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdding(null)} disabled={adjust.isPending}>
              Vazgeç
            </button>
            <button className="btn-primary" onClick={confirmAdd} disabled={adjust.isPending}>
              {adjust.isPending ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </>
        }
      >
        {adding && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="font-medium text-slate-900">{adding.name}</div>
              <div className="text-xs text-slate-500">
                Mevcut: <span className="font-medium text-slate-800">{Number(adding.current_stock).toLocaleString('tr-TR')} {adding.unit}</span>
              </div>
            </div>
            <div>
              <label className="label">Eklenecek miktar ({adding.unit}) *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                autoFocus
                className="input"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmAdd();
                  }
                }}
              />
            </div>
            <div>
              <label className="label">Not (opsiyonel)</label>
              <input
                type="text"
                className="input"
                placeholder="Örn: tedarikçiden geldi"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
              />
            </div>
            {addQty && Number(addQty) > 0 && (
              <p className="text-xs text-slate-500">
                Yeni stok:{' '}
                <span className="font-medium text-emerald-700">
                  {(Number(adding.current_stock) + Number(String(addQty).replace(',', '.'))).toLocaleString('tr-TR')} {adding.unit}
                </span>
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function compareValues(a, b, type) {
  if (type === 'number') {
    const left = toSortableNumber(a);
    const right = toSortableNumber(b);
    const leftMissing = Number.isNaN(left);
    const rightMissing = Number.isNaN(right);
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    return left - right;
  }
  return String(a ?? '').localeCompare(String(b ?? ''), 'tr', { sensitivity: 'base', numeric: true });
}

function toSortableNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return Number(value);
}

function SortHeader({ label, align, isActive, direction, onClick }) {
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''} hover:text-slate-700`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${isActive ? 'text-brand-600' : 'text-slate-300'}`}>
          {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
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
