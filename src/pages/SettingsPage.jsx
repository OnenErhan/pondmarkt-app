import { useState } from 'react';
import { Settings, Download, Database, ExternalLink, User, LogOut, Shield } from 'lucide-react';
import { exportBackup, downloadBackup, summarizeBackup } from '../lib/backup.js';
import { supabase } from '../lib/supabase/client.js';
import { useAuthStore } from '../store/authStore.js';
import { toast } from '../components/ui/Toast.jsx';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);

  const handleExport = async () => {
    setBusy(true);
    setProgress({ current: 0, total: 1, table: 'Hazırlanıyor' });
    try {
      const data = await exportBackup({
        onProgress: (p) => setProgress(p),
      });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadBackup(data, `pondmarkt-yedek-${stamp}.json`);
      const totalRows = Object.values(data.tables).reduce(
        (s, arr) => s + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
      setLastSummary(summarizeBackup(data));
      toast.success(`Yedek indirildi (${totalRows} kayıt)`);
    } catch (e) {
      toast.error('Yedek başarısız: ' + e.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\./)?.[1];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
          <p className="text-sm text-slate-500">Yedek, hesap ve sistem bilgileri</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Account */}
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <User size={16} /> Hesap
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="E-posta" value={user?.email ?? '—'} />
            <Row
              label="Kullanıcı ID"
              value={<span className="font-mono text-xs">{user?.id ?? '—'}</span>}
            />
            <Row
              label="Son Giriş"
              value={
                user?.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString('tr-TR')
                  : '—'
              }
            />
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="btn-secondary mt-4 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={14} /> Oturumu Kapat
          </button>
        </section>

        {/* Backup */}
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Download size={16} /> Yedek (JSON İndir)
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Tüm tabloları (hammaddeler, ürünler, üretim, depo hareketleri vs.) tek JSON dosyasına
            indir. Düzenli aralıklarla bilgisayarına yedek almanı öneririz.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="btn-primary"
          >
            <Download size={16} /> {busy ? 'Hazırlanıyor...' : 'Yedek İndir'}
          </button>

          {progress && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {progress.current}/{progress.total} · {progress.table}
              </p>
            </div>
          )}

          {lastSummary && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {lastSummary.map((s) => (
                <div
                  key={s.table}
                  className="rounded bg-slate-50 px-2 py-1 ring-1 ring-slate-100"
                >
                  <div className="font-mono text-[10px] text-slate-500">{s.table}</div>
                  <div className="font-semibold text-slate-800">{s.count}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
            <strong>Geri yükleme:</strong> Yedek geri yükleme şu an manuel: Supabase Dashboard'tan
            tabloları temizleyip JSON içeriğini SQL ile insert etmen gerekir. Tam otomatik restore
            ihtiyaç doğdukça eklenecek.
          </div>
        </section>

        {/* System */}
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Database size={16} /> Sistem
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Uygulama" value="PondMarkt APP" />
            <Row label="Versiyon" value="1.0.0" />
            <Row label="Supabase Proje" value={<span className="font-mono text-xs">{projectRef ?? '—'}</span>} />
          </div>
          {projectRef && (
            <a
              href={`https://supabase.com/dashboard/project/${projectRef}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary mt-4 text-sm"
            >
              <ExternalLink size={14} /> Supabase Dashboard
            </a>
          )}
        </section>

        {/* Security tips */}
        <section className="card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Shield size={16} /> Güvenlik
          </h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
            <li>Tüm tablolarda RLS açık. Sadece giriş yapmış kullanıcılar veri görebilir.</li>
            <li>Yeni kullanıcı eklemek için Supabase Dashboard → Authentication → Users.</li>
            <li>Şifre değiştirmek için aşağıdaki butonu kullan (e-posta ile sıfırlama linki gönderilir).</li>
          </ul>
          <button
            type="button"
            className="btn-secondary mt-4 text-sm"
            onClick={async () => {
              if (!user?.email) return;
              const { error } = await supabase.auth.resetPasswordForEmail(user.email);
              if (error) toast.error(error.message);
              else toast.success('Şifre sıfırlama linki e-postana gönderildi');
            }}
          >
            Şifre Sıfırlama Linki Gönder
          </button>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
