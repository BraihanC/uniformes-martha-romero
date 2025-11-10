import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

const CuentasPorPagar = () => {
  const [satelites, setSatelites] = useState([]);
  const [cuentasPorSatelite, setCuentasPorSatelite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSatelite, setExpandedSatelite] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

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

      // 2. Obtener todas las entradas de satélite NO PAGADAS
      const q = query(
        collection(db, 'stockEntries'),
        where('tipoEntrada', '==', 'satelite'),
        where('pagado', '==', false)
      );
      const entradasSnapshot = await getDocs(q);
      const entradas = entradasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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
    const confirmacion = window.confirm(
      '¿Estás seguro de marcar estas entradas como pagadas? Esta acción no se puede deshacer.'
    );

    if (!confirmacion) return;

    setProcessingPayment(true);
    try {
      const batch = writeBatch(db);

      // Marcar todas las entradas de este satélite como pagadas
      entradaIds.forEach(entradaId => {
        const entradaRef = doc(db, 'stockEntries', entradaId);
        batch.update(entradaRef, {
          pagado: true,
          fechaPago: serverTimestamp()
        });
      });

      await batch.commit();

      alert('¡Entradas marcadas como pagadas exitosamente!');

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
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan="5" className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
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
