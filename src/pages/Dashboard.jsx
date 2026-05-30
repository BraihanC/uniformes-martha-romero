import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  Package,
  AlertTriangle,
  ClipboardList,
  ShoppingCart,
  Users,
  Box
} from 'lucide-react';

/**
 * Formatea un número como moneda colombiana (COP).
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Dashboard = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    ingresosHoy: 0,
    pedidosPendientes: 0,
    apartadosActivos: 0,
  });

  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [pendingPedidos, setPendingPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  /**
   * Carga todos los datos necesarios para el dashboard
   */
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // --- 1. Definir rango de "Hoy" ---
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todayTimestamp = Timestamp.fromDate(today);
      const tomorrowTimestamp = Timestamp.fromDate(tomorrow);

      // --- 2. Fetch Ingresos de Hoy (de TRANSACTIONS) ---
      const transQuery = query(
        collection(db, 'transactions'),
        where('fecha', '>=', todayTimestamp),
        where('fecha', '<', tomorrowTimestamp)
      );
      const transSnapshot = await getDocs(transQuery);
      let totalIngresos = 0;
      transSnapshot.forEach(doc => {
        if (doc.data().monto > 0) { // Solo sumar ingresos
          totalIngresos += doc.data().monto;
        }
      });

      // --- 3. Fetch Pedidos Pendientes (En Proceso) ---
      const pedidosQuery = query(
        collection(db, 'pedidos'),
        where('estadoGeneral', '==', 'En Proceso')
      );
      const pedidosSnapshot = await getDocs(pedidosQuery);

      // --- 4. Fetch Apartados Activos ---
      const apartadosQuery = query(
        collection(db, 'apartados'),
        where('estadoGeneral', '==', 'Activo')
      );
      const apartadosSnapshot = await getDocs(apartadosQuery);

      // Guardar estadísticas principales
      setStats({
        ingresosHoy: totalIngresos,
        pedidosPendientes: pedidosSnapshot.size,
        apartadosActivos: apartadosSnapshot.size,
      });

      // --- 5. Fetch Productos con Bajo Stock (Alertas) ---
      const productsQuery = query(collection(db, 'products'));
      const productsSnapshot = await getDocs(productsQuery);

      const lowStock = [];
      productsSnapshot.forEach((doc) => {
        const product = doc.data();
        const calc = (product.stockTotal || 0) -
                     (product.stockReservadoPedidos || 0) -
                     (product.stockReservadoApartados || 0);
        const disponible = Math.max(0, calc); // Nunca muestra negativos

        if (disponible <= 5) { // Alerta si hay 5 o menos
          lowStock.push({
            id: doc.id,
            nombre: product.nombre,
            talla: product.talla,
            stockDisponible: disponible,
          });
        }
      });
      setLowStockProducts(lowStock.sort((a, b) => a.stockDisponible - b.stockDisponible).slice(0, 5)); // Mostrar solo 5

      // --- 6. Fetch Pedidos más Antiguos "En Producción" ---
      const pendingPedidosQuery = query(
        collection(db, 'pedidos'),
        where('estadoGeneral', '==', 'En Proceso'),
        orderBy('createdAt', 'asc'), // Los más antiguos primero
        limit(5) // Solo los 5 más urgentes
      );
      const pendingPedidosSnapshot = await getDocs(pendingPedidosQuery);
      setPendingPedidos(pendingPedidosSnapshot.docs.map(doc => ({
        id: doc.id,
        numeroPedido: doc.data().numeroPedido,
        clienteNombre: doc.data().clienteNombre,
        fecha: doc.data().createdAt.toDate().toLocaleDateString('es-CO'),
      })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Aquí podrías mostrar un error en la UI
    } finally {
      setLoading(false);
    }
  };

  /**
   * Componente de Tarjeta de Estadística
   */
  const StatCard = ({ title, value, icon, colorClass, isCurrency = false }) => (
    <div className="bg-white rounded-lg shadow p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            {loading ? '...' : (isCurrency ? formatCurrency(value) : value)}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Bienvenido, {currentUser?.email?.split('@')[0] || 'Admin'}
        </h1>
        <p className="text-gray-600 mt-1">Resumen general del negocio al día de hoy.</p>
      </div>

      {/* Rejilla de Estadísticas */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
        {/* Ingresos de Hoy: solo admin (cifra financiera). El vendedor hace su
            cuadre en Cierre de Caja, no aquí. */}
        {isAdmin && (
          <StatCard
            title="Ingresos de Hoy"
            value={stats.ingresosHoy}
            isCurrency={true}
            colorClass="bg-green-100"
            icon={<DollarSign className="w-6 h-6 text-green-600" />}
          />
        )}
        <StatCard
          title="Pedidos Pendientes"
          value={stats.pedidosPendientes}
          colorClass="bg-blue-100"
          icon={<ClipboardList className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="Apartados Activos"
          value={stats.apartadosActivos}
          colorClass="bg-purple-100"
          icon={<Package className="w-6 h-6 text-purple-600" />}
        />
      </div>

      {/* Listas Accionables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertas de Inventario */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-bold text-gray-800">Alertas de Inventario (Top 5)</h2>
          </div>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : lowStockProducts.length === 0 ? (
            <p className="text-gray-500">¡Todo en orden! No hay productos con bajo stock.</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => navigate('/inventory')}
                  className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-800">{product.nombre}</p>
                    <p className="text-sm text-gray-500">Talla: {product.talla}</p>
                  </div>
                  <span className="font-bold text-red-600">
                    Quedan: {product.stockDisponible}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Producción Pendiente */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">Producción Urgente (Top 5)</h2>
          </div>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : pendingPedidos.length === 0 ? (
            <p className="text-gray-500">¡Excelente! No hay pedidos en producción.</p>
          ) : (
            <div className="space-y-3">
              {pendingPedidos.map(pedido => (
                <div
                  key={pedido.id}
                  onClick={() => navigate('/pedidos')}
                  className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-800">Pedido #{pedido.numeroPedido}</p>
                    <p className="text-sm text-gray-500">{pedido.clienteNombre}</p>
                  </div>
                  <span className="text-sm text-gray-500">{pedido.fecha}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Acciones Rápidas (Navegación) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <button
            onClick={() => navigate('/pos')}
            className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-all text-gray-700 hover:text-pink-600"
            style={{color: '#D50565'}}
          >
            <ShoppingCart size={32} />
            <p className="font-semibold text-center">Nueva Venta</p>
          </button>

          <button
            onClick={() => navigate('/pedidos')}
            className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-600"
          >
            <ClipboardList size={32} />
            <p className="font-semibold text-center">Nuevo Pedido</p>
          </button>

          <button
            onClick={() => navigate('/inventory')}
            className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-gray-700 hover:text-orange-600"
            style={{color: '#EA5C2E'}}
          >
            <Box size={32} />
            <p className="font-semibold text-center">Inventario</p>
          </button>

          <button
            onClick={() => navigate('/clients')}
            className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-gray-700 hover:text-purple-600"
          >
            <Users size={32} />
            <p className="font-semibold text-center">Clientes</p>
          </button>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
