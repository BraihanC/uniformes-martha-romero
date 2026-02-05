import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Search, AlertTriangle, CheckCircle, Package, TrendingUp, RefreshCw } from 'lucide-react';

const DiagnosticoPedidosB2B = () => {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [expandedPedido, setExpandedPedido] = useState(null);

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const pedidosSnapshot = await getDocs(
        query(collection(db, 'pedidos_b2b'), orderBy('numeroPedido', 'desc'))
      );

      const pedidosData = pedidosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      alert('Error al cargar los pedidos B2B');
    } finally {
      setLoading(false);
    }
  };

  const diagnosticarPedido = (pedido) => {
    setPedidoSeleccionado(pedido);

    const problemas = {
      sobrecumplimiento: [],
      discrepancias: [],
      sinAlistar: [],
      completos: []
    };

    let hayProblemas = false;

    pedido.productos?.forEach((producto, idx) => {
      const cantidadPedida = producto.cantidad || 0;
      const cantidadAlistada = producto.cantidadAlistada || 0;
      const cantidadEnviada = producto.cantidadEnviada || 0;
      const cantidadRecibida = producto.cantidadRecibida || 0;
      const pendiente = Math.max(0, cantidadPedida - cantidadAlistada);
      const sobrecumplimiento = Math.max(0, cantidadAlistada - cantidadPedida);
      const hayDiscrepancia = cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada;

      const productoInfo = {
        idx,
        descripcion: producto.descripcion,
        talla: producto.talla,
        codigo: producto.codigo,
        productoId: producto.productoId,
        cantidadPedida,
        cantidadAlistada,
        cantidadEnviada,
        cantidadRecibida,
        pendiente,
        sobrecumplimiento,
        estadoProduccion: producto.estadoProduccion,
        observacionesRecepcion: producto.observacionesRecepcion
      };

      if (sobrecumplimiento > 0) {
        problemas.sobrecumplimiento.push(productoInfo);
        hayProblemas = true;
      }

      if (hayDiscrepancia) {
        problemas.discrepancias.push({
          ...productoInfo,
          faltante: cantidadEnviada - cantidadRecibida
        });
        hayProblemas = true;
      }

      if (pendiente > 0 && cantidadAlistada === 0) {
        problemas.sinAlistar.push(productoInfo);
      }

      if (cantidadAlistada >= cantidadPedida && !sobrecumplimiento) {
        problemas.completos.push(productoInfo);
      }
    });

    setDiagnostico({
      pedido,
      problemas,
      hayProblemas,
      totalExceso: problemas.sobrecumplimiento.reduce((sum, p) => sum + p.sobrecumplimiento, 0),
      totalFaltante: problemas.discrepancias.reduce((sum, p) => sum + p.faltante, 0)
    });
  };

  const corregirSobrecumplimiento = async () => {
    if (!diagnostico || diagnostico.problemas.sobrecumplimiento.length === 0) {
      return;
    }

    const confirmar = window.confirm(
      `⚠️ CORRECCIÓN DE SOBRECUMPLIMIENTOS\n\n` +
      `Se corregirán ${diagnostico.problemas.sobrecumplimiento.length} productos con sobrecumplimiento.\n\n` +
      `Total de unidades erróneas: ${diagnostico.totalExceso}\n\n` +
      `Esto actualizará:\n` +
      `• Las cantidades alistadas en el pedido B2B (solo datos del pedido)\n` +
      `• El estado de producción de cada producto\n\n` +
      `IMPORTANTE: NO se modificará el inventario porque estos fueron\n` +
      `errores de doble clic, no alistamientos físicos reales.\n\n` +
      `¿Deseas continuar?`
    );

    if (!confirmar) return;

    setCorrigiendo(true);
    try {
      const pedidoRef = doc(db, 'pedidos_b2b', diagnostico.pedido.id);

      // Actualizar productos en el pedido
      const productosActualizados = diagnostico.pedido.productos.map((p, idx) => {
        const sobrecumplimiento = diagnostico.problemas.sobrecumplimiento.find(s => s.idx === idx);

        if (sobrecumplimiento) {
          // Corregir a la cantidad pedida exacta
          return {
            ...p,
            cantidadAlistada: p.cantidad,
            estadoProduccion: p.cantidad === (p.cantidadEnviada || 0) ? 'alistado' : 'en_produccion'
          };
        }
        return p;
      });

      // Actualizar solo el pedido B2B, NO el inventario
      await updateDoc(pedidoRef, {
        productos: productosActualizados,
        updatedAt: serverTimestamp()
      });

      alert(
        `✅ CORRECCIÓN COMPLETADA\n\n` +
        `• Productos corregidos: ${diagnostico.problemas.sobrecumplimiento.length}\n` +
        `• Cantidades alistadas ajustadas en el pedido\n` +
        `• Inventario NO modificado (errores de doble clic)`
      );

      // Recargar datos
      await fetchPedidos();
      setPedidoSeleccionado(null);
      setDiagnostico(null);

    } catch (error) {
      console.error('Error al corregir sobrecumplimiento:', error);
      alert('Error al corregir sobrecumplimiento: ' + error.message);
    } finally {
      setCorrigiendo(false);
    }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    if (!searchTerm.trim()) return true;
    const busqueda = searchTerm.toLowerCase();
    return (
      String(p.numeroPedido).includes(busqueda) ||
      (p.clienteNombre || '').toLowerCase().includes(busqueda) ||
      (p.codigoColegio || '').toLowerCase().includes(busqueda)
    );
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-pink-600 mr-2" size={24} />
        <span className="text-gray-600">Cargando pedidos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Diagnóstico de Pedidos B2B</h2>
        <p className="text-gray-600 mt-1">
          Detecta sobrecumplimientos, discrepancias y problemas en los pedidos B2B
        </p>
      </div>

      {/* Vista de diagnóstico detallado */}
      {diagnostico ? (
        <div className="space-y-6">
          {/* Botón volver */}
          <button
            onClick={() => {
              setPedidoSeleccionado(null);
              setDiagnostico(null);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            ← Volver a lista de pedidos
          </button>

          {/* Info del pedido */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Pedido #{String(diagnostico.pedido.numeroPedido || 0).padStart(4, '0')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-2 font-medium">{diagnostico.pedido.clienteNombre}</span>
              </div>
              <div>
                <span className="text-gray-600">Colegio:</span>
                <span className="ml-2 font-medium">{diagnostico.pedido.codigoColegio}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>
                <span className="ml-2 font-medium">{diagnostico.pedido.estado}</span>
              </div>
            </div>
          </div>

          {/* Resumen de problemas */}
          {diagnostico.hayProblemas ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sobrecumplimientos */}
              {diagnostico.problemas.sobrecumplimiento.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-red-600" size={20} />
                    <h4 className="font-bold text-red-800">Sobrecumplimientos</h4>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {diagnostico.problemas.sobrecumplimiento.length}
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {diagnostico.totalExceso} unidades de más
                  </p>
                </div>
              )}

              {/* Discrepancias */}
              {diagnostico.problemas.discrepancias.length > 0 && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="text-yellow-600" size={20} />
                    <h4 className="font-bold text-yellow-800">Discrepancias</h4>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {diagnostico.problemas.discrepancias.length}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {diagnostico.totalFaltante} unidades faltantes
                  </p>
                </div>
              )}

              {/* Sin alistar */}
              {diagnostico.problemas.sinAlistar.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="text-orange-600" size={20} />
                    <h4 className="font-bold text-orange-800">Sin Alistar</h4>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">
                    {diagnostico.problemas.sinAlistar.length}
                  </p>
                  <p className="text-sm text-orange-700 mt-1">
                    Productos sin iniciar
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={32} />
              <div>
                <h4 className="font-bold text-green-800 text-lg">¡Todo en orden!</h4>
                <p className="text-green-700 text-sm">No se detectaron problemas en este pedido</p>
              </div>
            </div>
          )}

          {/* Detalle de sobrecumplimientos */}
          {diagnostico.problemas.sobrecumplimiento.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <TrendingUp className="text-red-600" size={20} />
                  Sobrecumplimientos Detectados
                </h4>
                <button
                  onClick={corregirSobrecumplimiento}
                  disabled={corrigiendo}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw size={16} className={corrigiendo ? 'animate-spin' : ''} />
                  {corrigiendo ? 'Corrigiendo...' : 'Corregir Sobrecumplimientos'}
                </button>
              </div>

              <div className="space-y-3">
                {diagnostico.problemas.sobrecumplimiento.map((producto, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{producto.descripcion}</p>
                        <p className="text-sm text-gray-600">
                          Talla: {producto.talla} • Código: {producto.codigo}
                        </p>
                      </div>
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        +{producto.sobrecumplimiento}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="text-gray-500">Pedidas</p>
                        <p className="font-bold text-gray-800">{producto.cantidadPedida}</p>
                      </div>
                      <div className="bg-red-100 rounded">
                        <p className="text-red-600">Alistadas</p>
                        <p className="font-bold text-red-700">{producto.cantidadAlistada}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Enviadas</p>
                        <p className="font-bold text-gray-800">{producto.cantidadEnviada}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Recibidas</p>
                        <p className="font-bold text-gray-800">{producto.cantidadRecibida}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>💡 Nota:</strong> Al corregir los sobrecumplimientos,
                  se ajustarán las cantidades alistadas en el pedido al valor pedido.
                  El inventario NO se modificará porque estos fueron errores de doble clic
                  en la interfaz, no alistamientos físicos reales.
                </p>
              </div>
            </div>
          )}

          {/* Detalle de discrepancias */}
          {diagnostico.problemas.discrepancias.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
                <AlertTriangle className="text-yellow-600" size={20} />
                Discrepancias en Recepción
              </h4>

              <div className="space-y-3">
                {diagnostico.problemas.discrepancias.map((producto, idx) => (
                  <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{producto.descripcion}</p>
                        <p className="text-sm text-gray-600">
                          Talla: {producto.talla} • Código: {producto.codigo}
                        </p>
                      </div>
                      <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                        -{producto.faltante}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
                      <div>
                        <p className="text-gray-500">Enviadas</p>
                        <p className="font-bold text-gray-800">{producto.cantidadEnviada}</p>
                      </div>
                      <div className="bg-yellow-100 rounded">
                        <p className="text-yellow-600">Recibidas</p>
                        <p className="font-bold text-yellow-700">{producto.cantidadRecibida}</p>
                      </div>
                      <div>
                        <p className="text-red-600">Faltante</p>
                        <p className="font-bold text-red-700">{producto.faltante}</p>
                      </div>
                    </div>
                    {producto.observacionesRecepcion && (
                      <div className="bg-yellow-100 rounded p-2 text-sm text-yellow-800">
                        <strong>Observación:</strong> {producto.observacionesRecepcion}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Información:</strong> Estas discrepancias ya están registradas en el sistema.
                  El sistema automáticamente creará pendientes adicionales para renviar estos productos.
                </p>
              </div>
            </div>
          )}

          {/* Productos sin alistar */}
          {diagnostico.problemas.sinAlistar.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4">
                <Package className="text-orange-600" size={20} />
                Productos Sin Alistar
              </h4>

              <div className="space-y-2">
                {diagnostico.problemas.sinAlistar.map((producto, idx) => (
                  <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{producto.descripcion}</p>
                      <p className="text-xs text-gray-600">
                        Talla: {producto.talla} • Código: {producto.codigo}
                      </p>
                    </div>
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {producto.pendiente} pendientes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Lista de pedidos */
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por número de pedido, cliente o colegio..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Lista de pedidos */}
          <div className="grid grid-cols-1 gap-4">
            {pedidosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No se encontraron pedidos B2B
              </div>
            ) : (
              pedidosFiltrados.map(pedido => {
                const totales = pedido.productos?.reduce((acc, p) => {
                  acc.pedidas += p.cantidad || 0;
                  acc.alistadas += p.cantidadAlistada || 0;
                  acc.enviadas += p.cantidadEnviada || 0;
                  acc.recibidas += p.cantidadRecibida || 0;
                  return acc;
                }, { pedidas: 0, alistadas: 0, enviadas: 0, recibidas: 0 }) || {};

                const tieneSobrecumplimiento = pedido.productos?.some(p =>
                  (p.cantidadAlistada || 0) > (p.cantidad || 0)
                );

                const tieneDiscrepancias = pedido.productos?.some(p =>
                  (p.cantidadRecibida || 0) > 0 && (p.cantidadRecibida || 0) < (p.cantidadEnviada || 0)
                );

                return (
                  <div
                    key={pedido.id}
                    className={`bg-white rounded-lg shadow-md p-4 border-2 ${
                      tieneSobrecumplimiento ? 'border-red-300' :
                      tieneDiscrepancias ? 'border-yellow-300' :
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">
                          Pedido #{String(pedido.numeroPedido || 0).padStart(4, '0')}
                        </h3>
                        <p className="text-sm text-gray-600">{pedido.clienteNombre}</p>
                        <p className="text-xs text-gray-500">{pedido.codigoColegio}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {tieneSobrecumplimiento && (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                            Sobrecumplimiento
                          </span>
                        )}
                        {tieneDiscrepancias && (
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">
                            Discrepancias
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3 text-center text-sm">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500">Pedidas</p>
                        <p className="font-bold text-gray-800">{totales.pedidas || 0}</p>
                      </div>
                      <div className="bg-blue-50 rounded p-2">
                        <p className="text-xs text-blue-600">Alistadas</p>
                        <p className="font-bold text-blue-700">{totales.alistadas || 0}</p>
                      </div>
                      <div className="bg-purple-50 rounded p-2">
                        <p className="text-xs text-purple-600">Enviadas</p>
                        <p className="font-bold text-purple-700">{totales.enviadas || 0}</p>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <p className="text-xs text-green-600">Recibidas</p>
                        <p className="font-bold text-green-700">{totales.recibidas || 0}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => diagnosticarPedido(pedido)}
                      className="w-full px-4 py-2 bg-pink-600 text-white font-medium rounded-lg hover:bg-pink-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Search size={16} />
                      Diagnosticar Pedido
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticoPedidosB2B;
