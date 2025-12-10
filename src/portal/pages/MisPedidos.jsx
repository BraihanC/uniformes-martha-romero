import { useState, useEffect } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Package, Calendar, DollarSign, FileText, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';

const MisPedidos = () => {
  const { clienteCorporativo } = usePortalAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPedido, setExpandedPedido] = useState(null);

  useEffect(() => {
    if (clienteCorporativo) {
      fetchPedidos();
    }
  }, [clienteCorporativo]);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const pedidosRef = collection(db, 'pedidos_b2b');
      const q = query(
        pedidosRef,
        where('clienteId', '==', clienteCorporativo.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      alert('Error al cargar pedidos: ' + error.message);
    } finally {
      setLoading(false);
    }
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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const calcularTotalAbonado = (abonos) => {
    if (!abonos || abonos.length === 0) return 0;
    return abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0);
  };

  const calcularEstadoPago = (total, abonos) => {
    const totalAbonado = calcularTotalAbonado(abonos);
    if (totalAbonado === 0) return 'Sin Pagar';
    if (totalAbonado >= total) return 'Pagado';
    return 'Pago Parcial';
  };

  const getEstadoPagoBadgeColor = (estadoPago) => {
    switch (estadoPago) {
      case 'Pagado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pago Parcial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Sin Pagar':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const togglePedido = (pedidoId) => {
    setExpandedPedido(expandedPedido === pedidoId ? null : pedidoId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Package size={28} />
          Mis Pedidos
        </h1>
        <p className="text-gray-600">
          {clienteCorporativo?.nombre}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {pedidos.length} {pedidos.length === 1 ? 'pedido realizado' : 'pedidos realizados'}
        </p>
      </div>

      {/* Lista de Pedidos */}
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No hay pedidos registrados
          </h3>
          <p className="text-gray-500">
            Cuando realices un pedido, aparecerá aquí
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {/* Header del Pedido */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => togglePedido(pedido.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-800">
                        Pedido #{pedido.id.slice(-6).toUpperCase()}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoBadgeColor(
                          pedido.estado
                        )}`}
                      >
                        {pedido.estado}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getEstadoPagoBadgeColor(
                          calcularEstadoPago(pedido.total, pedido.abonos)
                        )}`}
                      >
                        <CreditCard size={12} />
                        {calcularEstadoPago(pedido.total, pedido.abonos)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{formatDate(pedido.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package size={16} />
                        <span>
                          {pedido.productos?.length || 0}{' '}
                          {pedido.productos?.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} />
                        <span className="font-semibold" style={{ color: '#D50565' }}>
                          {formatCurrency(pedido.total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
                    {expandedPedido === pedido.id ? (
                      <ChevronUp size={24} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={24} className="text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Detalles del Pedido (Expandible) */}
              {expandedPedido === pedido.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  {/* Productos */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Package size={18} />
                      Productos
                    </h4>
                    <div className="space-y-2">
                      {pedido.productos?.map((producto, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">
                              {producto.descripcion}
                            </p>
                            <p className="text-sm text-gray-500">
                              Talla: {producto.talla} • Cantidad: {producto.cantidad}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">
                              {formatCurrency(producto.subtotal)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(producto.precioUnitario)} c/u
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historial de Abonos */}
                  {pedido.abonos && pedido.abonos.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <DollarSign size={18} />
                        Historial de Abonos
                      </h4>
                      <div className="space-y-2">
                        {pedido.abonos.map((abono, index) => (
                          <div
                            key={index}
                            className="bg-green-50 border border-green-200 p-3 rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-green-800">
                                  {formatCurrency(abono.monto)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {formatDate(abono.fecha)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">{abono.notas}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notas */}
                  {pedido.notas && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText size={18} />
                        Notas
                      </h4>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <p className="text-gray-700 whitespace-pre-wrap">{pedido.notas}</p>
                      </div>
                    </div>
                  )}

                  {/* Resumen Financiero */}
                  <div className="bg-white p-4 rounded-lg border-2" style={{ borderColor: '#D50565' }}>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Total del Pedido:</span>
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(pedido.total)}
                        </span>
                      </div>
                      {pedido.abonos && pedido.abonos.length > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Total Abonado:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(
                                pedido.abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-lg font-bold text-gray-800">Saldo Pendiente:</span>
                            <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                              {formatCurrency(
                                pedido.total - pedido.abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0)
                              )}
                            </span>
                          </div>
                        </>
                      )}
                      {(!pedido.abonos || pedido.abonos.length === 0) && (
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-lg font-bold text-gray-800">Saldo Pendiente:</span>
                          <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                            {formatCurrency(pedido.total)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MisPedidos;
