import { useState, useEffect } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  TrendingUp,
  Package,
  DollarSign,
  CreditCard,
  AlertCircle,
  Calendar,
  ShoppingBag,
  FileText
} from 'lucide-react';

const Dashboard = () => {
  const { clienteCorporativo } = usePortalAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPedidos: 0,
    pedidosActivos: 0,
    totalComprado: 0,
    totalAbonado: 0,
    totalAdeudado: 0,
    ultimosAbonos: [],
    pedidosRecientes: [],
    pedidosPorMes: []
  });

  useEffect(() => {
    if (clienteCorporativo) {
      fetchDashboardData();
    }
  }, [clienteCorporativo]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const pedidosRef = collection(db, 'pedidos_b2b');
      const q = query(
        pedidosRef,
        where('clienteId', '==', clienteCorporativo.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const pedidos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calcular estadísticas
      const totalPedidos = pedidos.length;
      const pedidosActivos = pedidos.filter(
        p => p.estado !== 'Entregado' && p.estado !== 'Cancelado'
      ).length;

      let totalComprado = 0;
      let totalAbonado = 0;
      let ultimosAbonos = [];

      pedidos.forEach(pedido => {
        totalComprado += pedido.total || 0;

        if (pedido.abonos && pedido.abonos.length > 0) {
          pedido.abonos.forEach(abono => {
            totalAbonado += abono.monto || 0;
            ultimosAbonos.push({
              ...abono,
              pedidoId: pedido.id,
              pedidoNumero: pedido.id.slice(-6).toUpperCase()
            });
          });
        }
      });

      // Ordenar abonos por fecha
      ultimosAbonos.sort((a, b) => {
        const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
        const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
        return dateB - dateA;
      });

      // Tomar solo los últimos 5 abonos
      ultimosAbonos = ultimosAbonos.slice(0, 5);

      const totalAdeudado = totalComprado - totalAbonado;

      // Pedidos recientes (últimos 5)
      const pedidosRecientes = pedidos.slice(0, 5);

      // Calcular pedidos por mes (últimos 6 meses)
      const pedidosPorMes = calcularPedidosPorMes(pedidos);

      setStats({
        totalPedidos,
        pedidosActivos,
        totalComprado,
        totalAbonado,
        totalAdeudado,
        ultimosAbonos,
        pedidosRecientes,
        pedidosPorMes
      });
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calcularPedidosPorMes = (pedidos) => {
    const meses = [];
    const ahora = new Date();

    // Generar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const nombreMes = fecha.toLocaleDateString('es-CO', { month: 'short' });
      const mes = fecha.getMonth();
      const año = fecha.getFullYear();

      const pedidosDelMes = pedidos.filter(p => {
        if (!p.createdAt) return false;
        const fechaPedido = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        return fechaPedido.getMonth() === mes && fechaPedido.getFullYear() === año;
      });

      const totalMes = pedidosDelMes.reduce((sum, p) => sum + (p.total || 0), 0);

      meses.push({
        mes: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        cantidad: pedidosDelMes.length,
        total: totalMes
      });
    }

    return meses;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Preparación':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Despachado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Entregado':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // Calcular el máximo para la gráfica
  const maxTotal = Math.max(...stats.pedidosPorMes.map(m => m.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <TrendingUp size={24} className="md:w-7 md:h-7" style={{ color: '#D50565' }} />
          Dashboard
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          {clienteCorporativo?.nombre}
        </p>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Pedidos */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderColor: '#D50565' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 rounded-full" style={{ backgroundColor: '#FEE2F8' }}>
              <Package size={24} style={{ color: '#D50565' }} />
            </div>
            <span className="text-3xl font-bold text-gray-800">{stats.totalPedidos}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Pedidos</h3>
        </div>

        {/* Pedidos Activos */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 rounded-full bg-blue-100">
              <ShoppingBag size={24} className="text-blue-500" />
            </div>
            <span className="text-3xl font-bold text-gray-800">{stats.pedidosActivos}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Pedidos Activos</h3>
        </div>

        {/* Total Comprado */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 rounded-full bg-green-100">
              <DollarSign size={24} className="text-green-500" />
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-800">
                {formatCurrency(stats.totalComprado)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Comprado</h3>
        </div>

        {/* Total Adeudado */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-800">
                {formatCurrency(stats.totalAdeudado)}
              </div>
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Adeudado</h3>
        </div>
      </div>

      {/* Gráfica de Pedidos por Mes */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <TrendingUp size={24} />
          Compras de los Últimos 6 Meses
        </h2>
        <div className="space-y-4">
          {stats.pedidosPorMes.map((mes, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 w-16">{mes.mes}</span>
                <span className="text-sm text-gray-600 flex-1 text-right mr-4">
                  {mes.cantidad} {mes.cantidad === 1 ? 'pedido' : 'pedidos'} • {formatCurrency(mes.total)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: '#D50565',
                    width: `${(mes.total / maxTotal) * 100}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dos Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Abonos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard size={24} className="text-green-500" />
            Últimos Abonos
          </h2>
          {stats.ultimosAbonos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No hay abonos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.ultimosAbonos.map((abono, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-green-800">
                      {formatCurrency(abono.monto)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Pedido #{abono.pedidoNumero}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(abono.fecha)}
                    </p>
                  </div>
                  {abono.notas && (
                    <div className="text-xs text-gray-600 max-w-[200px] text-right">
                      {abono.notas}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {stats.ultimosAbonos.length > 0 && (
            <button
              onClick={() => navigate('/portal/mis-pedidos')}
              className="mt-4 w-full px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#D50565' }}
            >
              Ver Todos los Pedidos
            </button>
          )}
        </div>

        {/* Pedidos Recientes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={24} style={{ color: '#D50565' }} />
            Pedidos Recientes
          </h2>
          {stats.pedidosRecientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No hay pedidos realizados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.pedidosRecientes.map((pedido) => (
                <div
                  key={pedido.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/portal/mis-pedidos')}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        #{pedido.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(pedido.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${getEstadoBadgeColor(
                        pedido.estado
                      )}`}
                    >
                      {pedido.estado}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-600">
                      {pedido.productos?.length || 0} productos
                    </span>
                    <span className="font-semibold" style={{ color: '#D50565' }}>
                      {formatCurrency(pedido.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {stats.pedidosRecientes.length > 0 && (
            <button
              onClick={() => navigate('/portal/catalogo')}
              className="mt-4 w-full px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Realizar Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Resumen Financiero */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg shadow-md p-6 border-2" style={{ borderColor: '#D50565' }}>
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileText size={24} style={{ color: '#D50565' }} />
          Resumen Financiero
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Comprado</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(stats.totalComprado)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Total Abonado</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalAbonado)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600 mb-1">Saldo Pendiente</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalAdeudado)}
            </p>
          </div>
        </div>
        {stats.totalAdeudado > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              💡 <strong>Recordatorio:</strong> Tienes un saldo pendiente de{' '}
              {formatCurrency(stats.totalAdeudado)}. Contacta con tu ejecutivo para realizar abonos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
