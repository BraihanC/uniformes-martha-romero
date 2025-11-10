import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Clients from './pages/Clients';
import Pedidos from './pages/Pedidos';
import Apartados from './pages/Apartados';
import Devoluciones from './pages/Devoluciones';
import EntradasLayout from './pages/Entradas';
import EntradaSatelite from './components/entradas/EntradaSatelite';
import EntradaProveedor from './components/entradas/EntradaProveedor';
import ReportesLayout from './pages/Reportes';
import CierreCaja from './components/reportes/CierreCaja';
import BuscadorFacturas from './components/reportes/BuscadorFacturas';
import ReporteCorte from './components/reportes/ReporteCorte';
import CuentasPorPagar from './components/reportes/CuentasPorPagar';
import ReporteUtilidad from './components/reportes/ReporteUtilidad';
import Config from './pages/Config';
import Perfil from './pages/Perfil';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="clients" element={<Clients />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="apartados" element={<Apartados />} />
            <Route path="devoluciones" element={<Devoluciones />} />
            <Route path="perfil" element={<Perfil />} />

            {/* Entradas con sub-rutas */}
            <Route path="entradas" element={<EntradasLayout />}>
              {/* Ruta por defecto (cuando entras a /entradas) */}
              <Route index element={<EntradaSatelite />} />

              {/* Rutas de cada pestaña */}
              <Route path="satelite" element={<EntradaSatelite />} />
              <Route path="proveedor" element={<EntradaProveedor />} />
            </Route>

            {/* Admin only routes */}
            <Route
              path="inventory"
              element={
                <PrivateRoute requireAdmin>
                  <Inventory />
                </PrivateRoute>
              }
            />
            <Route
              path="reportes"
              element={
                <PrivateRoute requireAdmin>
                  <ReportesLayout />
                </PrivateRoute>
              }
            >
              {/* Ruta por defecto (cuando entras a /reportes) */}
              <Route index element={<CierreCaja />} />

              {/* Rutas de cada pestaña */}
              <Route path="cierre" element={<CierreCaja />} />
              <Route path="facturas" element={<BuscadorFacturas />} />
              <Route path="corte" element={<ReporteCorte />} />
              <Route path="cuentas-por-pagar" element={<CuentasPorPagar />} />
              <Route path="utilidad" element={<ReporteUtilidad />} />
            </Route>
            <Route
              path="config"
              element={
                <PrivateRoute requireAdmin>
                  <Config />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
