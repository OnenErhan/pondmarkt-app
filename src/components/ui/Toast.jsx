import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

let counter = 0;
const subs = new Set();
const state = { items: [] };

function emit() {
  subs.forEach((cb) => cb(state.items));
}

export const toast = {
  show(message, type = 'info', duration = 3000) {
    const id = ++counter;
    state.items = [...state.items, { id, message, type }];
    emit();
    if (duration > 0) {
      setTimeout(() => toast.dismiss(id), duration);
    }
    return id;
  },
  success(m, d) {
    return toast.show(m, 'success', d);
  },
  error(m, d) {
    return toast.show(m, 'error', d ?? 5000);
  },
  info(m, d) {
    return toast.show(m, 'info', d);
  },
  dismiss(id) {
    state.items = state.items.filter((x) => x.id !== id);
    emit();
  },
};

const STYLES = {
  success: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
  error: { cls: 'bg-red-50 text-red-800 ring-red-200', Icon: AlertCircle },
  info: { cls: 'bg-slate-50 text-slate-800 ring-slate-200', Icon: Info },
};

export default function ToastHost() {
  const [items, setItems] = useState(state.items);
  useEffect(() => {
    subs.add(setItems);
    return () => subs.delete(setItems);
  }, []);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const { cls, Icon } = STYLES[t.type] ?? STYLES.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg p-3 shadow-lg ring-1 ${cls}`}
          >
            <Icon size={18} className="mt-0.5 flex-shrink-0" />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded p-0.5 hover:bg-black/5"
              aria-label="Kapat"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
