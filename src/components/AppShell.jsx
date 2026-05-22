import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  PackagePlus,
  Factory,
  ClipboardList,
  Warehouse,
  ArrowLeftRight,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Truck,
  Package,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/production/new', label: 'Tam Mamul Uretim', icon: Factory },
  { to: '/production/semi', label: 'Yari Mamul Uretim', icon: Factory },
  { to: '/production/assemble', label: 'Yari Mamul Birlestirme', icon: Factory },
  { to: '/production', label: 'Üretim Geçmişi', icon: ClipboardList },
  { to: '/materials', label: 'Hammaddeler', icon: Boxes },
  { to: '/materials/intake', label: 'Hammadde Alımı', icon: PackagePlus },
  { to: '/products', label: 'Ürünler', icon: Package },
  { to: '/warehouse', label: 'Depo', icon: Warehouse },
  { to: '/warehouse/moves', label: 'Depo Hareketleri', icon: ArrowLeftRight },
  { to: '/suppliers', label: 'Tedarikçiler', icon: Truck },
  { to: '/reports', label: 'Raporlar', icon: BarChart3 },
  { to: '/settings', label: 'Ayarlar', icon: Settings },
];

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export default function AppShell() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const online = useOnline();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between gap-3 border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="PondMarkt"
              className="h-12 w-auto select-none"
              draggable={false}
            />
            <div className="leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Hammadde &amp; Üretim
              </p>
              <p className="text-xs font-semibold text-slate-700">Takip Sistemi</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded p-1 text-slate-500 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-xs text-slate-500">Giriş yapan</p>
            <p className="truncate text-sm font-medium text-slate-800">{user?.email ?? '—'}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} />
            Çıkış yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            className="rounded p-2 text-slate-600 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menü"
          >
            <Menu size={22} />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            Hoş geldin, <span className="font-medium text-slate-700">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                online ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
              title={online ? 'Çevrimiçi' : 'Bağlantı yok'}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {!online && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              İnternet bağlantısı yok — kayıt ekleme/güncelleme şu an mümkün değil.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
