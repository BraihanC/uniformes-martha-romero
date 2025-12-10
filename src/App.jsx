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
import PedidosB2B from './pages/PedidosB2B';
import ReportesImperfectos from './pages/ReportesImperfectos';
import Apartados from './pages/Apartados';
import Devoluciones from './pages/Devoluciones';
import Egresos from './pages/Egresos';
import ProductosReparacion from './pages/ProductosReparacion';
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

// Portal B2B Imports
import { PortalAuthProvider } from './portal/context/PortalAuthContext';
import { CartProvider } from './portal/context/CartContext';
import { NotificacionesProvider } from './portal/context/NotificacionesContext';
import PortalLogin from './portal/pages/Login';
import PortalLayout from './portal/components/PortalLayout';
import ProtectedRoute from './portal/components/ProtectedRoute';
import Catalogo from './portal/pages/Catalogo';
import CrearPedido from './portal/pages/CrearPedido';
import MisPedidos from './portal/pages/MisPedidos';
import ReportarImperfecto from './portal/pages/ReportarImperfecto';

function App() {
  return (
    <Router>
      <Routes>
        {/* ==================== PORTAL B2B ROUTES ==================== */}
        <Route path="/portal/*" element={
          <PortalAuthProvider>
            <CartProvider>
              <NotificacionesProvider>
                <Routes>
                  {/* Portal Login */}
                  <Route path="login" element={<PortalLogin />} />

                  {/* Portal Protected Routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <PortalLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/portal/catalogo" replace />} />
                    <Route path="catalogo" element={<Catalogo />} />
                    <Route path="crear-pedido" element={<CrearPedido />} />
                    <Route path="mis-pedidos" element={<MisPedidos />} />
                    <Route path="reportar-imperfecto" element={<ReportarImperfecto />} />
                  </Route>

                  {/* Catch all portal - redirect to catalogo */}
                  <Route path="*" element={<Navigate to="/portal/catalogo" replace />} />
                </Routes>
              </NotificacionesProvider>
            </CartProvider>
          </PortalAuthProvider>
        } />

        {/* ==================== ADMIN ROUTES ==================== */}
        <Route path="/*" element={
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
                <Route path="pedidos-b2b" element={<PedidosB2B />} />
                <Route path="reportes-imperfectos" element={<ReportesImperfectos />} />
                <Route path="apartados" element={<Apartados />} />
                <Route path="devoluciones" element={<Devoluciones />} />
                <Route path="productos-reparacion" element={<ProductosReparacion />} />
                <Route path="egresos" element={<Egresos />} />
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

                {/* Reportes - Accesible para vendedor (Cierre y Facturas) y admin (todos) */}
                <Route path="reportes" element={<ReportesLayout />}>
                  {/* Ruta por defecto (cuando entras a /reportes) */}
                  <Route index element={<CierreCaja />} />

                  {/* Rutas accesibles para vendedor y admin */}
                  <Route path="cierre" element={<CierreCaja />} />
                  <Route path="facturas" element={<BuscadorFacturas />} />

                  {/* Rutas solo para admin */}
                  <Route
                    path="corte"
                    element={
                      <PrivateRoute requireAdmin>
                        <ReporteCorte />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="cuentas-por-pagar"
                    element={
                      <PrivateRoute requireAdmin>
                        <CuentasPorPagar />
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="utilidad"
                    element={
                      <PrivateRoute requireAdmin>
                        <ReporteUtilidad />
                      </PrivateRoute>
                    }
                  />
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
        } />
      </Routes>
    </Router>
  );
}

export default App;
