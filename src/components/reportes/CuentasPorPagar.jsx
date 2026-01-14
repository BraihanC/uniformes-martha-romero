import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';

const CuentasPorPagar = () => {
  const [satelites, setSatelites] = useState([]);
  const [cuentasPorSatelite, setCuentasPorSatelite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSatelite, setExpandedSatelite] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingAnulacion, setProcessingAnulacion] = useState(false);

  useEffect(() => {
    fetchCuentasPorPagar();
  }, []);

  const fetchCuentasPorPagar = async () => {
    setLoading(true);
    try {
      // 1. Obtener todos los satélites
      const satelitesSnapshot = await getDocs(collection(db, 'satelites'));
      const satelitesData = satelitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSatelites(satelitesData);

      // 2. Obtener todas las entradas de satélite NO PAGADAS y NO ANULADAS
      const q = query(
        collection(db, 'stockEntries'),
        where('tipoEntrada', '==', 'satelite'),
        where('pagado', '==', false)
      );
      const entradasSnapshot = await getDocs(q);
      const entradas = entradasSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(entrada => !entrada.anulada); // Excluir entradas anuladas

      // 3. Agrupar por satélite y calcular totales
      const cuentasMap = new Map();

      entradas.forEach(entrada => {
        const sateliteId = entrada.sateliteId;

        if (!cuentasMap.has(sateliteId)) {
          cuentasMap.set(sateliteId, {
            sateliteId: sateliteId,
            entradas: [],
            totalAdeudado: 0
          });
        }

        const cuenta = cuentasMap.get(sateliteId);
        cuenta.entradas.push(entrada);
        cuenta.totalAdeudado += entrada.costoTotal || 0;
      });

      // Ordenar entradas de cada satélite por fecha (más reciente primero)
      cuentasMap.forEach(cuenta => {
        cuenta.entradas.sort((a, b) => {
          const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return fechaB - fechaA; // Descendente (más reciente primero)
        });
      });

      // 4. Convertir a array y agregar información del satélite
      const cuentasArray = Array.from(cuentasMap.values()).map(cuenta => {
        const satelite = satelitesData.find(s => s.id === cuenta.sateliteId);
        return {
          ...cuenta,
          sateliteNombre: satelite?.nombre || 'Satélite desconocido',
          sateliteCodigo: satelite?.codigo || 'N/A'
        };
      });

      // 5. Ordenar por monto adeudado (mayor a menor)
      cuentasArray.sort((a, b) => b.totalAdeudado - a.totalAdeudado);

      setCuentasPorSatelite(cuentasArray);
    } catch (error) {
      console.error('Error al cargar cuentas por pagar:', error);
      alert('Error al cargar las cuentas por pagar.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandSatelite = (sateliteId) => {
    if (expandedSatelite === sateliteId) {
      setExpandedSatelite(null);
    } else {
      setExpandedSatelite(sateliteId);
    }
  };

  const handleMarcarComoPagado = async (sateliteId, entradaIds) => {
    // Preguntar método de pago
    const metodoPago = window.prompt(
      'Selecciona el método de pago:\n\n1 = Efectivo (afecta Caja)\n2 = Transferencia/Cheque (cuenta Martha Romero)\n\nIngresa el número (1 o 2):'
    );

    if (!metodoPago) return; // Cancelado

    let metodoPagoTexto;
    if (metodoPago === '1') {
      metodoPagoTexto = 'Efectivo';
    } else if (metodoPago === '2') {
      metodoPagoTexto = 'Transferencia';
    } else {
      alert('Opción inválida. Debe ser 1 o 2.');
      return;
    }

    const confirmacion = window.confirm(
      `¿Confirmas el pago por ${metodoPagoTexto}?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmacion) return;

    setProcessingPayment(true);
    try {
      const batch = writeBatch(db);

      // Para cada entrada, buscar su transacción asociada y actualizarla
      for (const entradaId of entradaIds) {
        // Actualizar entrada como pagada
        const entradaRef = doc(db, 'stockEntries', entradaId);
        batch.update(entradaRef, {
          pagado: true,
          fechaPago: serverTimestamp(),
          metodoPago: metodoPagoTexto
        });

        // Buscar y actualizar la transacción asociada
        const transQuery = query(
          collection(db, 'transactions'),
          where('entradaId', '==', entradaId),
          where('tipo', '==', 'entrada_satelite')
        );
        const transSnapshot = await getDocs(transQuery);

        if (!transSnapshot.empty) {
          // Actualizar la transacción de 'Pendiente' al método real
          transSnapshot.forEach(transDoc => {
            const transRef = doc(db, 'transactions', transDoc.id);
            batch.update(transRef, {
              metodoPago: metodoPagoTexto,
              fechaPago: serverTimestamp()
            });
          });
        }
      }

      await batch.commit();

      alert(`✅ ¡Entradas marcadas como pagadas por ${metodoPagoTexto}!`);

      // Recargar datos
      await fetchCuentasPorPagar();
      setExpandedSatelite(null);
    } catch (error) {
      console.error('Error al marcar como pagado:', error);
      alert('Error al procesar el pago. Intenta de nuevo.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAnularEntrada = async (entrada) => {
    // Construir mensaje de confirmación con detalles
    const detallesAnulacion = `
Esta acción ANULARÁ la entrada y revertirá los siguientes cambios:

📦 Producto: ${entrada.nombre}
📋 Referencia: ${entrada.referencia}
🔢 Cantidad a revertir: ${entrada.cantidad} unidades

📊 Cambios en Inventario:
   • STOCK TOTAL: -${entrada.cantidad} unidades
   ${entrada.cantidadAsignada > 0 ? `• RES. PEDIDOS: -${entrada.cantidadAsignada} unidades` : ''}

${entrada.asignaciones && entrada.asignaciones.length > 0 ? `📋 Pedidos Afectados:
${entrada.asignaciones.map(asig =>
  `   • Pedido #${asig.numeroPedido || asig.pedidoId.slice(-6)}: ${asig.cantidad} item(s) ${asig.clienteNombre ? `(${asig.clienteNombre})` : ''} volverán a "En Producción"`
).join('\n')}` : ''}

⚠️ Esta acción NO se puede deshacer.

¿Estás seguro de anular esta entrada?
    `.trim();

    const confirmacion = window.confirm(detallesAnulacion);
    if (!confirmacion) return;

    setProcessingAnulacion(true);
    try {
      const batch = writeBatch(db);

      // 1. Revertir cambios en el producto
      const productRef = doc(db, 'products', entrada.productId);
      const productUpdate = {
        stockTotal: increment(-entrada.cantidad),
        updatedAt: serverTimestamp()
      };

      // Si hubo asignaciones a pedidos, revertir stockReservadoPedidos
      if (entrada.cantidadAsignada > 0) {
        productUpdate.stockReservadoPedidos = increment(-entrada.cantidadAsignada);
      }

      batch.update(productRef, productUpdate);

      // 2. Revertir cambios en los pedidos (si hubo asignaciones)
      if (entrada.asignaciones && entrada.asignaciones.length > 0) {
        for (const asig of entrada.asignaciones) {
          // Solo procesar asignaciones completas (que cambiaron el estado)
          if (asig.esCompleto) {
            if (asig.tipo === 'pedido' || !asig.tipo) { // 'pedido' o sin tipo (legacy)
              // PEDIDO REGULAR (POS)
              const pedidoRef = doc(db, 'pedidos', asig.pedidoId);
              const pedidoSnap = await getDoc(pedidoRef);

              if (pedidoSnap.exists()) {
                const pedidoData = pedidoSnap.data();
                const itemsActualizados = [...pedidoData.items];

                // Cambiar el item de vuelta a "En Producción"
                if (itemsActualizados[asig.itemIndex]) {
                  itemsActualizados[asig.itemIndex] = {
                    ...itemsActualizados[asig.itemIndex],
                    estadoItem: 'En Producción'
                  };

                  batch.update(pedidoRef, {
                    items: itemsActualizados,
                    updatedAt: serverTimestamp()
                  });
                }
              }
            } else if (asig.tipo === 'pedido_b2b') {
              // PEDIDO B2B (PORTAL)
              const pedidoRef = doc(db, 'pedidos_b2b', asig.pedidoId);
              const pedidoSnap = await getDoc(pedidoRef);

              if (pedidoSnap.exists()) {
                const pedidoData = pedidoSnap.data();
                const productosActualizados = [...pedidoData.productos];

                // Revertir cantidad alistada y estado
                if (productosActualizados[asig.itemIndex]) {
                  const producto = productosActualizados[asig.itemIndex];
                  productosActualizados[asig.itemIndex] = {
                    ...producto,
                    cantidadAlistada: Math.max(0, (producto.cantidadAlistada || 0) - asig.cantidad),
                    estadoProduccion: 'en_produccion',
                    fechaAlistado: null
                  };

                  batch.update(pedidoRef, {
                    productos: productosActualizados,
                    updatedAt: serverTimestamp()
                  });
                }
              }
            }
          }
        }
      }

      // 3. Marcar la entrada como anulada
      const entradaRef = doc(db, 'stockEntries', entrada.id);
      batch.update(entradaRef, {
        anulada: true,
        fechaAnulacion: serverTimestamp(),
        motivoAnulacion: 'Entrada incorrecta - Producto equivocado'
      });

      // Ejecutar todas las operaciones
      await batch.commit();

      alert('✅ Entrada anulada exitosamente.\n\nLos cambios han sido revertidos:\n- Stock del producto actualizado\n- Items de pedidos devueltos a "En Producción"');

      // Recargar datos
      await fetchCuentasPorPagar();
    } catch (error) {
      console.error('Error al anular entrada:', error);
      alert('❌ Error al anular la entrada. Por favor, intenta de nuevo.\n\nDetalles: ' + error.message);
    } finally {
      setProcessingAnulacion(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const totalGeneral = cuentasPorSatelite.reduce((sum, cuenta) => sum + cuenta.totalAdeudado, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Cargando cuentas por pagar...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Cuentas por Pagar a Satélites</h2>
        <p className="text-gray-600 mt-1">Gestiona los pagos pendientes a talleres satélite.</p>
      </div>

      {/* Resumen General */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 mb-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-pink-100 text-sm">Total Adeudado a Satélites</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(totalGeneral)}</p>
          </div>
          <div className="text-right">
            <p className="text-pink-100 text-sm">Satélites con Saldo Pendiente</p>
            <p className="text-3xl font-bold mt-1">{cuentasPorSatelite.length}</p>
          </div>
        </div>
      </div>

      {/* Lista de Cuentas por Satélite */}
      {cuentasPorSatelite.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">¡No hay cuentas pendientes!</h3>
          <p className="text-gray-600">Todos los pagos a satélites están al día.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cuentasPorSatelite.map((cuenta) => (
            <div key={cuenta.sateliteId} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header - Resumen del Satélite */}
              <div
                onClick={() => toggleExpandSatelite(cuenta.sateliteId)}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {cuenta.sateliteNombre}
                  </h3>
                  <p className="text-sm text-gray-500">Código: {cuenta.sateliteCodigo}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Adeudado</p>
                    <p className="text-xl font-bold text-pink-600">
                      {formatCurrency(cuenta.totalAdeudado)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cuenta.entradas.length} entrada(s) pendiente(s)
                    </p>
                  </div>
                  {expandedSatelite === cuenta.sateliteId ? (
                    <ChevronUp className="text-gray-400" />
                  ) : (
                    <ChevronDown className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Detalle de Entradas (Expandible) */}
              {expandedSatelite === cuenta.sateliteId && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-3">Detalle de Entradas Pendientes</h4>

                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-lg overflow-hidden">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Referencia</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Cantidad</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Costo Unit.</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Total</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cuenta.entradas.map((entrada) => (
                          <tr key={entrada.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(entrada.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entrada.nombre}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {entrada.referencia}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {entrada.cantidad}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {formatCurrency(entrada.costoUnitario)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(entrada.costoTotal)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleAnularEntrada(entrada)}
                                disabled={processingAnulacion}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Anular esta entrada"
                              >
                                <XCircle size={14} />
                                Anular
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan="6" className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                            Total a Pagar:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-pink-600 text-right">
                            {formatCurrency(cuenta.totalAdeudado)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Botón para Marcar como Pagado */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleMarcarComoPagado(
                        cuenta.sateliteId,
                        cuenta.entradas.map(e => e.id)
                      )}
                      disabled={processingPayment}
                      style={{ backgroundColor: '#D50565' }}
                      className="px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      {processingPayment ? 'Procesando...' : 'Marcar como Pagado'}
                    </button>
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

export default CuentasPorPagar;
