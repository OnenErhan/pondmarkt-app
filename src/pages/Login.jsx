import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export default function Login() {
  const { user, signIn } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (user) {
    const dest = location.state?.from?.pathname ?? '/';
    return <Navigate to={dest} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      const dest = location.state?.from?.pathname ?? '/';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err?.message ?? 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/logo.png"
            alt="PondMarkt"
            className="mx-auto mb-3 h-20 w-auto select-none"
            draggable={false}
          />
          <p className="text-sm text-slate-500">Hammadde &amp; Üretim Takip Sistemi</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <label className="label" htmlFor="email">
          E-posta
        </label>
        <div className="relative mb-4">
          <Mail
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input pl-9"
            placeholder="ornek@firma.com"
          />
        </div>

        <label className="label" htmlFor="pw">
          Şifre
        </label>
        <div className="relative mb-6">
          <Lock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="pw"
            type="password"
            required
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pl-9"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          Hesabı yöneticin Supabase üzerinden oluşturur.
        </p>
      </form>
    </div>
  );
}
