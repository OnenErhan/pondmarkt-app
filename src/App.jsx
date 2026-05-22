import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { useAuthStore } from './store/authStore.js';
import RequireAuth from './routes/RequireAuth.jsx';
import AppShell from './components/AppShell.jsx';
import ToastHost from './components/ui/Toast.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Placeholder = lazy(() => import('./pages/Placeholder.jsx'));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage.jsx'));
const ProductsPage = lazy(() => import('./pages/ProductsPage.jsx'));
const ProductTypeDetailPage = lazy(() => import('./pages/ProductTypeDetailPage.jsx'));
const RecipeEditorPage = lazy(() => import('./pages/RecipeEditorPage.jsx'));
const ProductLabelPage = lazy(() => import('./pages/ProductLabelPage.jsx'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage.jsx'));
const ProductionWizardPage = lazy(() => import('./pages/ProductionWizardPage.jsx'));
const SemiProductionPage = lazy(() => import('./pages/SemiProductionPage.jsx'));
const SemiAssemblyPage = lazy(() => import('./pages/SemiAssemblyPage.jsx'));
const ProductionListPage = lazy(() => import('./pages/ProductionListPage.jsx'));
const MaterialIntakePage = lazy(() => import('./pages/MaterialIntakePage.jsx'));
const WarehousePage = lazy(() => import('./pages/WarehousePage.jsx'));
const WarehouseMovesPage = lazy(() => import('./pages/WarehouseMovesPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center text-slate-400">Yükleniyor...</div>
  );
}

const PLACEHOLDER_ROUTES = [];

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Suspense fallback={<Loading />}>
      <ToastHost />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="materials/intake" element={<MaterialIntakePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductTypeDetailPage />} />
          <Route path="products/recipes/:variantId" element={<RecipeEditorPage />} />
          <Route path="products/:variantId/label" element={<ProductLabelPage />} />
          <Route path="production/new" element={<ProductionWizardPage />} />
          <Route path="production/semi" element={<SemiProductionPage />} />
          <Route path="production/assemble" element={<SemiAssemblyPage />} />
          <Route path="production" element={<ProductionListPage />} />
          <Route path="warehouse" element={<WarehousePage />} />
          <Route path="warehouse/moves" element={<WarehouseMovesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          {PLACEHOLDER_ROUTES.map(([path, title]) => (
            <Route key={path} path={path} element={<Placeholder title={title} />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
