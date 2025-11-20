import { useState, useEffect } from 'react';
import { db, functions } from '../../services/firebase'; // Ajustado a ../../
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Search, Printer, FileText, Edit2, X } from 'lucide-react';

// (Copia de la función de POS.jsx)
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const BuscadorFacturas = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [todasFacturas, setTodasFacturas] = useState([]);
  const [facturasEncontradas, setFacturasEncontradas] = useState([]);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [companyConfig, setCompanyConfig] = useState(null);

  // Estados para filtros
  const [filterMetodoPago, setFilterMetodoPago] = useState('');
  const [filterFechaInicio, setFilterFechaInicio] = useState('');
  const [filterFechaFin, setFilterFechaFin] = useState('');

  // Estados para email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Estados para corrección de facturas
  const [showCorreccionModal, setShowCorreccionModal] = useState(false);
  const [itemIndexToCorrect, setItemIndexToCorrect] = useState(null);
  const [productos, setProductos] = useState([]);
  const [searchProductoCorreccion, setSearchProductoCorreccion] = useState('');
  const [productoNuevoSeleccionado, setProductoNuevoSeleccionado] = useState(null);
  const [notasCorreccion, setNotasCorreccion] = useState('');
  const [corrigiendo, setCorrigiendo] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const facturasPorPagina = 10;

  // Cargar config de la empresa y todas las facturas
  useEffect(() => {
    const fetchCompanyConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'company');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompanyConfig(docSnap.data());
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };

    const fetchAllFacturas = async () => {
      setBuscando(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'sales'));
        const facturas = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Ordenar por número de factura descendente
        facturas.sort((a, b) => (b.numeroFactura || 0) - (a.numeroFactura || 0));
        setTodasFacturas(facturas);
        setFacturasEncontradas(facturas);
      } catch (error) {
        console.error('Error al cargar facturas:', error);
      } finally {
        setBuscando(false);
      }
    };

    const fetchProductos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProductos(productosData);
      } catch (error) {
        console.error('Error al cargar productos:', error);
      }
    };

    fetchCompanyConfig();
    fetchAllFacturas();
    fetchProductos();
  }, []);

  // Filtrar facturas por búsqueda y filtros
  const facturasFiltradas = todasFacturas.filter(factura => {
    // Filtro por búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchNumero = String(factura.numeroFactura || '').includes(searchTerm);
      const matchNombre = (factura.clienteNombre || '').toLowerCase().includes(searchLower);
      const matchDocumento = (factura.clienteDocumento || '').includes(searchTerm);

      if (!matchNumero && !matchNombre && !matchDocumento) {
        return false;
      }
    }

    // Filtro por método de pago
    if (filterMetodoPago && factura.metodoPago !== filterMetodoPago) {
      return false;
    }

    // Filtro por rango de fechas
    if (filterFechaInicio || filterFechaFin) {
      const facturaFecha = factura.createdAt?.toDate?.();
      if (facturaFecha) {
        const facturaDate = new Date(facturaFecha.toDateString()); // Solo fecha sin hora

        if (filterFechaInicio) {
          const fechaInicio = new Date(filterFechaInicio);
          if (facturaDate < fechaInicio) {
            return false;
          }
        }

        if (filterFechaFin) {
          const fechaFin = new Date(filterFechaFin);
          if (facturaDate > fechaFin) {
            return false;
          }
        }
      }
    }

    return true;
  });

  // Calcular paginación
  const totalPaginas = Math.ceil(facturasFiltradas.length / facturasPorPagina);
  const indiceInicio = (paginaActual - 1) * facturasPorPagina;
  const indiceFin = indiceInicio + facturasPorPagina;
  const facturasPaginadas = facturasFiltradas.slice(indiceInicio, indiceFin);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm, filterMetodoPago, filterFechaInicio, filterFechaFin]);

  /**
   * Prepara la factura para el modal de impresión
   */
  const handleVerFactura = (factura) => {
    // La data de la factura necesita un campo 'fecha' legible
    const fechaLegible = factura.createdAt?.toDate?.()
      ? factura.createdAt.toDate().toLocaleDateString('es-CO')
      : new Date().toLocaleDateString('es-CO');

    setFacturaSeleccionada({
      ...factura,
      fecha: fechaLegible,
    });
  };

  /**
   * Cierra el modal de impresión
   */
  const handleClosePrintModal = () => {
    setFacturaSeleccionada(null);
  };

  /**
   * Llama a la impresión del navegador
   */
  const handlePrint = () => {
    window.print();
  };

  /**
   * Abre el modal de email y busca el email del cliente
   */
  const handleOpenEmailModal = async () => {
    setEmailRecipient('');

    // Buscar el email del cliente en la base de datos
    if (facturaSeleccionada?.clienteId) {
      try {
        const clienteDoc = await getDoc(doc(db, 'clients', facturaSeleccionada.clienteId));
        if (clienteDoc.exists()) {
          const clienteData = clienteDoc.data();
          if (clienteData.email) {
            setEmailRecipient(clienteData.email);
          }
        }
      } catch (error) {
        console.error('Error al buscar email del cliente:', error);
      }
    }

    setShowEmailModal(true);
  };

  /**
   * Envía el correo con la factura y actualiza el email del cliente si es necesario
   */
  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Por favor ingrese un correo electrónico');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRecipient)) {
      alert('Por favor ingrese un correo electrónico válido');
      return;
    }

    setSendingEmail(true);
    try {
      const sendEmailReceipt = httpsCallable(functions, 'sendEmailReceipt');
      const result = await sendEmailReceipt({
        saleId: facturaSeleccionada.id,
        toEmail: emailRecipient.trim()
      });

      // Actualizar el email del cliente en la base de datos si se ingresó manualmente
      if (facturaSeleccionada?.clienteId) {
        try {
          const clienteDoc = await getDoc(doc(db, 'clients', facturaSeleccionada.clienteId));
          if (clienteDoc.exists()) {
            const clienteData = clienteDoc.data();
            // Solo actualizar si el email es diferente o no existe
            if (clienteData.email !== emailRecipient.trim()) {
              const { updateDoc } = await import('firebase/firestore');
              await updateDoc(doc(db, 'clients', facturaSeleccionada.clienteId), {
                email: emailRecipient.trim()
              });
            }
          }
        } catch (error) {
          console.error('Error al actualizar email del cliente:', error);
          // No mostramos error al usuario, el correo sí se envió
        }
      }

      alert('✅ Correo enviado exitosamente a ' + emailRecipient);
      setShowEmailModal(false);
    } catch (error) {
      console.error('Error al enviar correo:', error);
      alert('❌ Error al enviar el correo: ' + (error.message || 'Error desconocido'));
    } finally {
      setSendingEmail(false);
    }
  };

  /**
   * Abre el modal para corregir un producto específico de la factura
   */
  const handleOpenCorreccionModal = (itemIndex) => {
    setItemIndexToCorrect(itemIndex);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNotasCorreccion('');
    setShowCorreccionModal(true);
  };

  /**
   * Cierra el modal de corrección
   */
  const handleCloseCorreccionModal = () => {
    setShowCorreccionModal(false);
    setItemIndexToCorrect(null);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNotasCorreccion('');
  };

  /**
   * Corrige la factura: cambia un producto por otro y ajusta inventario/transacción
   */
  const handleCorregirFactura = async () => {
    if (!productoNuevoSeleccionado) {
      alert('Selecciona el nuevo producto');
      return;
    }

    if (!notasCorreccion.trim()) {
      alert('Ingresa una nota explicando la corrección');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ CORREGIR FACTURA\n\n` +
      `Factura #${facturaSeleccionada.numeroFactura}\n\n` +
      `Producto actual: ${facturaSeleccionada.items[itemIndexToCorrect].nombre}\n` +
      `Nuevo producto: ${productoNuevoSeleccionado.nombre}\n\n` +
      `Esta acción:\n` +
      `• Modificará la factura original\n` +
      `• Ajustará el inventario\n` +
      `• Actualizará el valor si es diferente\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setCorrigiendo(true);
    try {
      const batch = writeBatch(db);
      const facturaRef = doc(db, 'sales', facturaSeleccionada.id);

      // Producto actual (el que está mal)
      const productoActual = facturaSeleccionada.items[itemIndexToCorrect];
      const productoActualId = productoActual.productoId;
      const cantidadActual = productoActual.cantidad;

      // Producto nuevo (el correcto)
      const productoNuevoId = productoNuevoSeleccionado.id;
      const precioNuevo = productoNuevoSeleccionado.precio || 0;
      const subtotalNuevo = precioNuevo * cantidadActual;

      // Calcular diferencia de precio
      const diferenciaSubtotal = subtotalNuevo - productoActual.subtotal;

      // 1. Actualizar el producto en la factura
      const itemsActualizados = [...facturaSeleccionada.items];
      itemsActualizados[itemIndexToCorrect] = {
        productoId: productoNuevoId,
        nombre: productoNuevoSeleccionado.nombre,
        referencia: productoNuevoSeleccionado.referencia || '',
        talla: productoNuevoSeleccionado.talla || '',
        cantidad: cantidadActual,
        precioUnitario: precioNuevo,
        subtotal: subtotalNuevo
      };

      // Calcular nuevos totales de la factura
      const nuevoSubtotal = itemsActualizados.reduce((sum, item) => sum + item.subtotal, 0);
      const nuevoTotalPagado = nuevoSubtotal - (facturaSeleccionada.descuentoTotal || 0);

      // 2. Actualizar la factura
      batch.update(facturaRef, {
        items: itemsActualizados,
        subtotal: nuevoSubtotal,
        totalPagado: nuevoTotalPagado,
        correccion: {
          fecha: serverTimestamp(),
          productoAnterior: productoActual.nombre,
          productoNuevo: productoNuevoSeleccionado.nombre,
          notas: notasCorreccion,
          diferenciaValor: diferenciaSubtotal
        },
        updatedAt: serverTimestamp()
      });

      // 3. Ajustar inventario del producto incorrecto (devolver stock)
      const productoIncorrectoRef = doc(db, 'products', productoActualId);
      batch.update(productoIncorrectoRef, {
        stockTotal: increment(cantidadActual) // Devolver el stock
      });

      // 4. Ajustar inventario del producto correcto (descontar stock)
      const productoCorrectoRef = doc(db, 'products', productoNuevoId);
      batch.update(productoCorrectoRef, {
        stockTotal: increment(-cantidadActual) // Descontar el stock
      });

      // 5. Buscar y actualizar la transacción asociada
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('ventaId', '==', facturaSeleccionada.id)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      transactionsSnapshot.docs.forEach(transactionDoc => {
        batch.update(transactionDoc.ref, {
          monto: nuevoTotalPagado,
          descripcion: `Venta #${facturaSeleccionada.numeroFactura} (Corregida)`,
          correccion: {
            fecha: serverTimestamp(),
            notas: notasCorreccion,
            diferenciaMonto: diferenciaSubtotal
          }
        });
      });

      await batch.commit();

      alert(
        `✅ Factura corregida exitosamente\n\n` +
        `Diferencia de valor: ${diferenciaSubtotal >= 0 ? '+' : ''}$${diferenciaSubtotal.toLocaleString()}\n` +
        `Inventario actualizado correctamente`
      );

      // Refrescar facturas
      const querySnapshot = await getDocs(collection(db, 'sales'));
      const facturas = querySnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      facturas.sort((a, b) => (b.numeroFactura || 0) - (a.numeroFactura || 0));
      setTodasFacturas(facturas);

      // Actualizar factura seleccionada
      const facturaActualizada = facturas.find(f => f.id === facturaSeleccionada.id);
      if (facturaActualizada) {
        const fechaLegible = facturaActualizada.createdAt?.toDate?.()
          ? facturaActualizada.createdAt.toDate().toLocaleDateString('es-CO')
          : new Date().toLocaleDateString('es-CO');
        setFacturaSeleccionada({
          ...facturaActualizada,
          fecha: fechaLegible
        });
      }

      handleCloseCorreccionModal();

    } catch (error) {
      console.error('Error al corregir factura:', error);
      alert('❌ Error al corregir factura: ' + error.message);
    } finally {
      setCorrigiendo(false);
    }
  };

  return (
    <div>
      {/* --- Barra de Búsqueda y Filtros --- */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Buscar y Filtrar Facturas</h2>

        {/* Barra de búsqueda */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por número de factura, cliente o documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm sm:text-base"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filtro por método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <select
              value={filterMetodoPago}
              onChange={(e) => setFilterMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            >
              <option value="">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Filtro por fecha inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={filterFechaInicio}
              onChange={(e) => setFilterFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            />
          </div>

          {/* Filtro por fecha fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={filterFechaFin}
              onChange={(e) => setFilterFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            />
          </div>
        </div>

        {/* Botón para limpiar filtros */}
        {(searchTerm || filterMetodoPago || filterFechaInicio || filterFechaFin) && (
          <div className="mt-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterMetodoPago('');
                setFilterFechaInicio('');
                setFilterFechaFin('');
              }}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Limpiar Filtros
            </button>
          </div>
        )}
      </div>

      {/* --- Resultados --- */}
      {buscando ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          Cargando facturas...
        </div>
      ) : facturasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          {searchTerm || filterMetodoPago || filterFechaInicio || filterFechaFin ? (
            'No se encontraron facturas con los filtros aplicados.'
          ) : (
            'No hay facturas registradas.'
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Resumen de resultados */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-700">
              Se encontraron <span className="font-semibold text-gray-900">{facturasFiltradas.length}</span> facturas
              {(searchTerm || filterMetodoPago || filterFechaInicio || filterFechaFin) && ' con los filtros aplicados'}
            </p>
          </div>

          {/* Vista de Tarjetas - Solo Móvil */}
          <div className="md:hidden divide-y divide-gray-200">
            {facturasPaginadas.map(factura => (
              <div key={factura.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-gray-800 text-base">Factura #{factura.numeroFactura}</p>
                    <p className="text-sm text-gray-700">{factura.clienteNombre}</p>
                    {factura.clienteDocumento && (
                      <p className="text-xs text-gray-500">Doc: {factura.clienteDocumento}</p>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 text-lg">
                    {formatCurrency(factura.totalPagado || 0)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  {factura.createdAt?.toDate?.().toLocaleDateString('es-CO') || 'N/A'}
                </p>
                <button
                  onClick={() => handleVerFactura(factura)}
                  className="w-full px-4 py-2 text-white text-sm rounded-lg hover:opacity-90 flex items-center justify-center gap-2"
                  style={{backgroundColor: '#EA5C2E'}}
                >
                  <FileText size={16} />
                  Ver / Imprimir
                </button>
              </div>
            ))}
          </div>

          {/* Vista de Tabla - Solo Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura N°</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {facturasPaginadas.map(factura => (
                  <tr key={factura.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">#{factura.numeroFactura}</td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-gray-800">{factura.clienteNombre}</p>
                      {factura.clienteDocumento && (
                        <p className="text-xs text-gray-500">Doc: {factura.clienteDocumento}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {factura.createdAt?.toDate?.().toLocaleDateString('es-CO') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                      {formatCurrency(factura.totalPagado || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleVerFactura(factura)}
                        className="px-3 py-1 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 flex items-center gap-1 mx-auto"
                        style={{backgroundColor: '#EA5C2E'}}
                      >
                        <FileText size={14} />
                        Ver / Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="px-4 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Mostrando {indiceInicio + 1} - {Math.min(indiceFin, facturasFiltradas.length)} de {facturasFiltradas.length} facturas
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                  disabled={paginaActual === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-600">
                  Pág. {paginaActual} de {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaActual === totalPaginas}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL DE IMPRESIÓN (Copia de POS.jsx) --- */}
      {facturaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full" style={{ maxWidth: '400px' }}>

            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Factura #{facturaSeleccionada.numeroFactura}</h2>
              <button
                onClick={handleClosePrintModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Receipt Preview (80mm width ≈ 300px) */}
            <div id="receipt-print" className="border p-4 bg-white" style={{ maxWidth: '300px', margin: '0 auto' }}>

              {/* Company Info */}
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">{companyConfig?.nombre || 'MARTHA ROMERO'}</h3>
                {companyConfig?.nit && <p className="text-xs">NIT: {companyConfig.nit}</p>}
                {companyConfig?.direccion && <p className="text-xs">{companyConfig.direccion}</p>}
                {companyConfig?.telefono && <p className="text-xs">Tel: {companyConfig.telefono}</p>}
                <p className="font-bold text-sm mt-2" style={{ letterSpacing: '1px' }}>FACTURA DE VENTA</p>
              </div>

              {/* Order Info */}
              <div className="border-t border-b border-dashed py-2 mb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Factura N°:</span>
                  <span>{String(facturaSeleccionada.numeroFactura).padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Fecha:</span>
                  <span>{facturaSeleccionada.fecha}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cliente:</span>
                  <span className="text-right">{facturaSeleccionada.clienteNombre}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border-b border-dashed py-2 mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Producto</th>
                      <th className="text-center">Cant</th>
                      <th className="text-right">Total</th>
                      <th className="text-center no-print">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturaSeleccionada.items.map((item, index) => (
                      <tr key={index}>
                        <td className="py-1">
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-gray-600 text-[10px]">
                            {item.talla && `Talla: ${item.talla} | `}
                            ${(item.precioUnitario || 0).toLocaleString('es-CO')}
                          </div>
                        </td>
                        <td className="text-center">{item.cantidad}</td>
                        <td className="text-right">${(item.subtotal || 0).toLocaleString('es-CO')}</td>
                        <td className="text-center no-print">
                          <button
                            onClick={() => handleOpenCorreccionModal(index)}
                            className="px-2 py-1 bg-blue-500 text-white text-[10px] rounded hover:bg-blue-600"
                            title="Corregir producto"
                          >
                            <Edit2 size={12} className="inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(facturaSeleccionada.subtotal || 0)}</span>
                </div>
                {facturaSeleccionada.descuentoTotal > 0 && (
                   <div className="flex justify-between text-red-600">
                    <span>Descuento Total:</span>
                    <span>-{formatCurrency(facturaSeleccionada.descuentoTotal)}</span>
                  </div>
                )}
                {facturaSeleccionada.ivaAplicado && (
                   <div className="flex justify-between">
                    <span>IVA ({facturaSeleccionada.ivaPorcentaje}%):</span>
                    <span>{formatCurrency(facturaSeleccionada.iva || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>TOTAL PAGADO:</span>
                  <span>{formatCurrency(facturaSeleccionada.totalPagado || 0)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-4 text-xs border-t pt-2">
                <p>Método de Pago: {facturaSeleccionada.metodoPago}</p>
                <p>¡Gracias por su compra!</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{backgroundColor: '#EA5C2E'}}
                >
                  <Printer size={16} className="inline-block mr-1" />
                  Imprimir
                </button>
                <button
                  onClick={handleOpenEmailModal}
                  className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{backgroundColor: '#D50565'}}
                >
                  📧 Enviar por Correo
                </button>
              </div>
              <button
                onClick={handleClosePrintModal}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Enviar Factura por Correo</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico del Cliente
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                disabled={sendingEmail}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: '#D50565'}}
              >
                {sendingEmail ? '📤 Enviando...' : '📧 Enviar'}
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CORRECCIÓN */}
      {showCorreccionModal && itemIndexToCorrect !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Corregir Producto en Factura</h2>
              <button
                onClick={handleCloseCorreccionModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                <X size={24} />
              </button>
            </div>

            {/* Producto actual */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-800 mb-2">Producto Incorrecto:</h3>
              <p className="text-gray-800">
                <strong>{facturaSeleccionada.items[itemIndexToCorrect].nombre}</strong>
                {facturaSeleccionada.items[itemIndexToCorrect].talla &&
                  ` - Talla: ${facturaSeleccionada.items[itemIndexToCorrect].talla}`
                }
              </p>
              <p className="text-sm text-gray-600">
                Precio: ${facturaSeleccionada.items[itemIndexToCorrect].precioUnitario?.toLocaleString()} × {facturaSeleccionada.items[itemIndexToCorrect].cantidad} = ${facturaSeleccionada.items[itemIndexToCorrect].subtotal?.toLocaleString()}
              </p>
            </div>

            {/* Buscador de producto nuevo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Producto Correcto:
              </label>
              <input
                type="text"
                value={searchProductoCorreccion}
                onChange={(e) => setSearchProductoCorreccion(e.target.value)}
                placeholder="Buscar por nombre o referencia..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Lista de productos */}
            <div className="mb-4 max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
              {productos
                .filter(p => {
                  if (!searchProductoCorreccion.trim()) return true;
                  const search = searchProductoCorreccion.toLowerCase();
                  return (
                    p.nombre?.toLowerCase().includes(search) ||
                    p.referencia?.toLowerCase().includes(search)
                  );
                })
                .slice(0, 20)
                .map(producto => (
                  <div
                    key={producto.id}
                    onClick={() => setProductoNuevoSeleccionado(producto)}
                    className={`p-3 cursor-pointer border-b border-gray-200 hover:bg-blue-50 ${
                      productoNuevoSeleccionado?.id === producto.id ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{producto.nombre}</p>
                        <p className="text-sm text-gray-600">
                          {producto.referencia && `Ref: ${producto.referencia} | `}
                          {producto.talla && `Talla: ${producto.talla} | `}
                          Precio: ${producto.precio?.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {producto.stockTotal || 0}</p>
                      </div>
                      {productoNuevoSeleccionado?.id === producto.id && (
                        <span className="text-blue-600 font-bold">✓</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Producto seleccionado */}
            {productoNuevoSeleccionado && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-green-800 mb-2">Producto Correcto Seleccionado:</h3>
                <p className="text-gray-800">
                  <strong>{productoNuevoSeleccionado.nombre}</strong>
                  {productoNuevoSeleccionado.talla && ` - Talla: ${productoNuevoSeleccionado.talla}`}
                </p>
                <p className="text-sm text-gray-600">
                  Precio: ${productoNuevoSeleccionado.precio?.toLocaleString()} × {facturaSeleccionada.items[itemIndexToCorrect].cantidad} = ${(productoNuevoSeleccionado.precio * facturaSeleccionada.items[itemIndexToCorrect].cantidad)?.toLocaleString()}
                </p>
                <p className="text-sm font-semibold mt-2">
                  Diferencia: {
                    ((productoNuevoSeleccionado.precio * facturaSeleccionada.items[itemIndexToCorrect].cantidad) - facturaSeleccionada.items[itemIndexToCorrect].subtotal) >= 0 ? '+' : ''
                  }${
                    ((productoNuevoSeleccionado.precio * facturaSeleccionada.items[itemIndexToCorrect].cantidad) - facturaSeleccionada.items[itemIndexToCorrect].subtotal).toLocaleString()
                  }
                </p>
              </div>
            )}

            {/* Notas de corrección */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de Corrección (obligatorio):
              </label>
              <textarea
                value={notasCorreccion}
                onChange={(e) => setNotasCorreccion(e.target.value)}
                placeholder="Ej: La cajera se confundió y registró el producto equivocado..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleCorregirFactura}
                disabled={corrigiendo || !productoNuevoSeleccionado || !notasCorreccion.trim()}
                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: '#D50565'}}
              >
                {corrigiendo ? '⏳ Corrigiendo...' : '✓ Corregir Factura'}
              </button>
              <button
                onClick={handleCloseCorreccionModal}
                disabled={corrigiendo}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Estilos de Impresión (Optimizado para impresoras térmicas) --- */}
      <style>{`
        @media print {
          /* Ocultar columna de acciones en impresión */
          .no-print {
            display: none !important;
          }

          /* Configuración de página para impresora térmica */
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html, body {
            width: 80mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          /* Ocultar todo el contenido excepto el ticket */
          body * {
            visibility: hidden !important;
          }

          /* Mostrar solo el recibo y sus hijos */
          #receipt-print,
          #receipt-print * {
            visibility: visible !important;
          }

          /* Posicionar el recibo */
          #receipt-print {
            position: absolute !important;
            left: 4mm !important;
            top: 0 !important;
            width: 72mm !important;
            margin: 0 !important;
            padding: 2mm 4mm !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            font-size: 11pt !important;
            line-height: 1.4 !important;
            color: black !important;
          }

          /* Asegurar que todo el contenido sea visible */
          #receipt-print * {
            max-width: 100% !important;
            color: black !important;
          }

          /* Optimizar colores para impresión */
          #receipt-print {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Asegurar que las tablas se vean bien */
          #receipt-print table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          #receipt-print table td,
          #receipt-print table th {
            padding: 1mm 0 !important;
            font-size: 10pt !important;
          }

          /* Líneas divisoras */
          #receipt-print .border-dashed {
            border-style: dashed !important;
            border-color: #000 !important;
          }

          #receipt-print .border-t {
            border-top-width: 1px !important;
          }

          #receipt-print .border-b {
            border-bottom-width: 1px !important;
          }

          /* Evitar saltos de página */
          #receipt-print {
            page-break-inside: avoid !important;
          }

          #receipt-print table {
            page-break-inside: auto !important;
          }

          #receipt-print tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BuscadorFacturas;
