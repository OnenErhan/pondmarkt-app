import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, ChevronRight } from 'lucide-react';
import {
  useProductTypes,
  useSaveProductType,
  useDeleteProductType,
} from '../hooks/useProducts.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import Modal from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';
import { useForm } from 'react-hook-form';

export default function ProductsPage() {
  const { data = [], isLoading } = useProductTypes();
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const save = useSaveProductType();
  const del = useDeleteProductType();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ürünler</h1>
          <p className="text-sm text-slate-500">Ürün türleri, boyutlar, renkler ve reçeteler</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={16} />
          Yeni Ürün Türü
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Henüz ürün türü yok"
          message="Önce ürün türü oluştur (örn. KAP = Kapak), sonra boyut/renk varyantları ekle"
        />
      ) : (
        (() => {
          // Group by category
          const groups = new Map();
          data.forEach((t) => {
            const k = t.category || 'Diğer';
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(t);
          });
          return (
            <div className="space-y-6">
              {Array.from(groups.entries()).map(([cat, items]) => (
                <section key={cat}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {cat}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((t) => (
                      <div key={t.id} className="card flex items-center justify-between">
                        <Link to={`/products/${t.id}`} className="flex flex-1 items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 font-mono text-xs font-bold text-brand-700">
                            {t.code}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{t.name}</p>
                            {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                          </div>
                          <ChevronRight size={18} className="text-slate-400" />
                        </Link>
                        <div className="ml-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(t);
                              setFormOpen(true);
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(t)}
                            className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          );
        })()
      )}

      {formOpen && (
        <TypeForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onClose={() => setFormOpen(false)}
          save={save}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Ürün türü silinsin mi?"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleting(null)}>
              Vazgeç
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                try {
                  await del.mutateAsync(deleting.id);
                  toast.success('Silindi');
                  setDeleting(null);
                } catch (e) {
                  toast.error(e.message);
                }
              }}
            >
              Sil
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-medium">{deleting?.name}</span> silinecek. Bu türe ait tüm boyut,
          renk ve varyantlar da silinir. Stok hareketi olan varyant varsa silme başarısız olur.
        </p>
      </Modal>
    </div>
  );
}

function TypeForm({ initial, onClose, save }) {
  const isEdit = !!initial?.id;
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { code: '', name: '', category: '', description: '', ...initial },
  });
  const onSubmit = async (v) => {
    try {
      await save.mutateAsync({
        ...initial,
        ...v,
        code: v.code.toUpperCase(),
        category: v.category || null,
      });
      toast.success(isEdit ? 'Güncellendi' : 'Eklendi');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Ürün Türü Düzenle' : 'Yeni Ürün Türü'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="submit"
            form="typeForm"
            className="btn-primary"
            disabled={formState.isSubmitting}
          >
            Kaydet
          </button>
        </>
      }
    >
      <form id="typeForm" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Kısa Kod * (SKU prefix)</label>
            <input
              className="input font-mono uppercase"
              required
              maxLength={10}
              {...register('code')}
              placeholder="KAP-BU"
            />
            <p className="mt-1 text-xs text-slate-500">Örn: KAP-BU, MRD-DK</p>
          </div>
          <div>
            <label className="label">Ana Grup</label>
            <input
              className="input"
              list="category-options"
              {...register('category')}
              placeholder="POND KAPAKLAR"
            />
            <datalist id="category-options">
              <option value="YARI MAMUL" />
              <option value="TAM MAMUL" />
              <option value="POND KAPAKLAR" />
              <option value="POND MERDİVENLER" />
              <option value="POND AYAK YIKAMA" />
              <option value="POND ÇATI PENCERESİ" />
            </datalist>
          </div>
        </div>
        <div>
          <label className="label">İsim *</label>
          <input className="input" required {...register('name')} placeholder="Beton Üzeri Kapak" />
        </div>
        <div>
          <label className="label">Açıklama</label>
          <textarea className="input" rows={3} {...register('description')} />
        </div>
      </form>
    </Modal>
  );
}
