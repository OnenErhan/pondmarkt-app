import { useForm } from 'react-hook-form';
import Modal from '../components/ui/Modal.jsx';
import { MATERIAL_CATEGORIES, useSaveMaterial } from '../hooks/useMaterials.js';
import { useSuppliers } from '../hooks/useSuppliers.js';
import { toast } from '../components/ui/Toast.jsx';

const DEFAULTS = {
  code: '',
  name: '',
  category: 'chemical',
  unit: 'kg',
  current_stock: 0,
  min_stock: 0,
  supplier_id: '',
  last_price: '',
  notes: '',
};

export default function MaterialFormModal({ open, onClose, initial }) {
  const isEdit = !!initial?.id;
  const { data: suppliers = [] } = useSuppliers();
  const save = useSaveMaterial();
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { ...DEFAULTS, ...initial },
  });

  const onSubmit = async (values) => {
    try {
      await save.mutateAsync({
        ...values,
        id: initial?.id,
        current_stock: Number(values.current_stock) || 0,
        min_stock: Number(values.min_stock) || 0,
        last_price: values.last_price === '' ? null : Number(values.last_price),
      });
      toast.success(isEdit ? 'Hammadde güncellendi' : 'Hammadde eklendi');
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Hammadde Düzenle' : 'Yeni Hammadde'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="submit"
            form="materialForm"
            className="btn-primary"
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <form id="materialForm" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Kod *</label>
          <input className="input" required {...register('code')} placeholder="PLY-01" />
        </div>
        <div>
          <label className="label">Kategori *</label>
          <select className="input" {...register('category')}>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">İsim *</label>
          <input className="input" required {...register('name')} placeholder="Polyester Reçine" />
        </div>
        <div>
          <label className="label">Birim *</label>
          <input className="input" required {...register('unit')} placeholder="kg / lt / adet" />
        </div>
        <div>
          <label className="label">Tedarikçi</label>
          <select className="input" {...register('supplier_id')}>
            <option value="">— Seçilmedi —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            Mevcut Stok {isEdit && <span className="text-amber-600">(düzeltme için kullan)</span>}
          </label>
          <input type="number" step="0.001" className="input" {...register('current_stock')} />
        </div>
        <div>
          <label className="label">Min Stok</label>
          <input type="number" step="0.001" className="input" {...register('min_stock')} />
        </div>
        <div>
          <label className="label">Son Birim Fiyat (TL)</label>
          <input type="number" step="0.01" className="input" {...register('last_price')} />
        </div>
        <div>
          <label className="label">Notlar</label>
          <input className="input" {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
