import { useState } from 'react';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { useSuppliers, useSaveSupplier, useDeleteSupplier } from '../hooks/useSuppliers.js';
import Modal from '../components/ui/Modal.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { toast } from '../components/ui/Toast.jsx';
import { useForm } from 'react-hook-form';

export default function SuppliersPage() {
  const { data = [], isLoading } = useSuppliers();
  const save = useSaveSupplier();
  const del = useDeleteSupplier();
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const open = (s) => {
    setEditing(s ?? null);
    setFormOpen(true);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tedarikçiler</h1>
          <p className="text-sm text-slate-500">Hammadde tedarikçi listesi</p>
        </div>
        <button type="button" onClick={() => open(null)} className="btn-primary">
          <Plus size={16} /> Yeni Tedarikçi
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : data.length === 0 ? (
        <EmptyState icon={Truck} title="Henüz tedarikçi yok" />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">İsim</th>
                <th className="px-4 py-3 text-left">Telefon</th>
                <th className="px-4 py-3 text-left">E-posta</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => open(s)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(s)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <SupplierForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onClose={() => setFormOpen(false)}
          save={save}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Tedarikçi silinsin mi?"
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
          <span className="font-medium">{deleting?.name}</span> silinecek.
        </p>
      </Modal>
    </div>
  );
}

function SupplierForm({ initial, onClose, save }) {
  const isEdit = !!initial?.id;
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { name: '', phone: '', email: '', notes: '', ...initial },
  });
  const onSubmit = async (v) => {
    try {
      await save.mutateAsync({ ...initial, ...v });
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
      title={isEdit ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="submit"
            form="supplierForm"
            className="btn-primary"
            disabled={formState.isSubmitting}
          >
            Kaydet
          </button>
        </>
      }
    >
      <form id="supplierForm" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div>
          <label className="label">İsim *</label>
          <input className="input" required {...register('name')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Telefon</label>
            <input className="input" {...register('phone')} />
          </div>
          <div>
            <label className="label">E-posta</label>
            <input type="email" className="input" {...register('email')} />
          </div>
        </div>
        <div>
          <label className="label">Notlar</label>
          <textarea className="input" rows={3} {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
