import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const EntradaProveedor = () => {
  const { currentUser } = useAuth();

  // Estados principales
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados del formulario
  const [cantidad, setCantidad] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [facturaProveedor, setFacturaProveedor] = useState('');
  const [notas, setNotas] = useState('');

  // Lista de proveedores y productos
  const [proveedores, setProveedores] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  // Estados para reporte de asignaciones
  const [showReporteAsignaciones, setShowReporteAsignaciones] = useState(false);
  const [reporteData, setReporteData] = useState(null);

  // Cargar proveedores y productos al iniciar
  useEffect(() => {
    fetchProveedores();
    fetchAllProducts();
  }, []);

  const fetchProveedores = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'proveedores'));
      const proveedoresData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProveedores(proveedoresData);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      alert('Error al cargar los proveedores.');
    }
  };

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar productos en tiempo real
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const searchLower = searchTerm.toLowerCase();
    const filtered = allProducts.filter(product => {
      const nombreMatch = product.nombre?.toLowerCase().includes(searchLower);
      const referenciaMatch = product.referencia?.toLowerCase().includes(searchLower);
      return nombreMatch || referenciaMatch;
    });
    setSearchResults(filtered);
  }, [searchTerm, allProducts]);

  // Seleccionar un producto de los resultados
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchResults([]);
    setSearchTerm('');
    // Limpiar formulario
    setCantidad('');
    setProveedorId('');
    setFacturaProveedor('');
    setNotas('');
  };

  // Guardar entrada de stock (Compra - Costo Automático)
  const handleSaveCompra = async (e) => {
    e.preventDefault();

    // Validaciones
    const numCantidad = Number(cantidad);

    if (!numCantidad || numCantidad <= 0) {
      alert('Por favor, ingresa una cantidad válida.');
      return;
    }
    if (!proveedorId) {
      alert('Por favor, selecciona un proveedor.');
      return;
    }

    // Obtener el costo de compra del producto (configurado en Gestión de Costos)
    const costoCompra = selectedProduct.costoCompra || 0;

    setLoading(true);
    try {
      // PASO 1: Buscar pedidos pendientes del mismo producto (referencia + talla)
      const pedidosQuery = query(
        collection(db, 'pedidos'),
        orderBy('createdAt', 'asc') // Del más antiguo al más reciente
      );
      const pedidosSnapshot = await getDocs(pedidosQuery);

      const pedidosPendientes = [];
      for (const pedidoDoc of pedidosSnapshot.docs) {
        const pedidoData = pedidoDoc.data();

        // Buscar items que coincidan con el producto y estén en producción
        const itemsPendientes = pedidoData.items
          .map((item, index) => ({ ...item, index }))
          .filter(item =>
            item.referencia === selectedProduct.referencia &&
            item.talla === selectedProduct.talla &&
            item.estadoItem === 'En Producción'
          );

        if (itemsPendientes.length > 0) {
          pedidosPendientes.push({
            id: pedidoDoc.id,
            numeroPedido: pedidoData.numeroPedido,
            clienteNombre: pedidoData.clienteNombre,
            createdAt: pedidoData.createdAt,
            items: pedidoData.items,
            itemsPendientes: itemsPendientes
          });
        }
      }

      // PASO 2: Asignar prendas a pedidos (del más antiguo al más reciente)
      let cantidadRestante = numCantidad;
      let cantidadAsignada = 0;
      const asignaciones = [];

      for (const pedido of pedidosPendientes) {
        if (cantidadRestante <= 0) break;

        for (const itemPendiente of pedido.itemsPendientes) {
          if (cantidadRestante <= 0) break;

          const cantidadNecesaria = itemPendiente.cantidad;
          const cantidadAAsignar = Math.min(cantidadNecesaria, cantidadRestante);

          asignaciones.push({
            pedidoId: pedido.id,
            numeroPedido: pedido.numeroPedido,
            clienteNombre: pedido.clienteNombre,
            itemIndex: itemPendiente.index,
            cantidadAsignada: cantidadAAsignar,
            cantidadNecesaria: cantidadNecesaria,
            esCompleto: cantidadAAsignar === cantidadNecesaria
          });

          cantidadRestante -= cantidadAAsignar;
          cantidadAsignada += cantidadAAsignar;
        }
      }

      const cantidadDisponible = cantidadRestante;

      // PASO 3: Mostrar resumen y confirmar
      let resumenMensaje = `📦 ENTRADA DE PROVEEDOR - RESUMEN\n\n`;
      resumenMensaje += `Producto: ${selectedProduct.nombre}\n`;
      resumenMensaje += `Referencia: ${selectedProduct.referencia}\n`;
      resumenMensaje += `Talla: ${selectedProduct.talla}\n`;
      resumenMensaje += `Cantidad entrante: ${numCantidad}\n\n`;

      if (asignaciones.length > 0) {
        resumenMensaje += `✅ PRENDAS ASIGNADAS A PEDIDOS (${cantidadAsignada}):\n\n`;
        asignaciones.forEach((asig, idx) => {
          resumenMensaje += `${idx + 1}. Pedido #${String(asig.numeroPedido).padStart(4, '0')} - ${asig.clienteNombre}\n`;
          resumenMensaje += `   → ${asig.cantidadAsignada} de ${asig.cantidadNecesaria} prendas`;
          if (!asig.esCompleto) {
            resumenMensaje += ` (quedan ${asig.cantidadNecesaria - asig.cantidadAsignada} pendientes)`;
          }
          resumenMensaje += `\n\n`;
        });
      } else {
        resumenMensaje += `ℹ️ No hay pedidos pendientes para este producto.\n\n`;
      }

      resumenMensaje += `📊 STOCK DISPONIBLE PARA VENTA: ${cantidadDisponible}\n\n`;
      resumenMensaje += `¿Confirmas esta entrada?`;

      const confirmar = window.confirm(resumenMensaje);
      if (!confirmar) {
        setLoading(false);
        return;
      }

      // PASO 4: Ejecutar todas las actualizaciones en batch
      const batch = writeBatch(db);

      // 4.1. Actualizar stockTotal y stockReservadoPedidos del producto
      const productRef = doc(db, 'products', selectedProduct.id);
      batch.update(productRef, {
        stockTotal: increment(numCantidad),
        stockReservadoPedidos: increment(cantidadAsignada),
        updatedAt: serverTimestamp()
      });

      // 4.2. Actualizar pedidos con items asignados
      for (const asig of asignaciones) {
        const pedidoRef = doc(db, 'pedidos', asig.pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);
        const pedidoData = pedidoSnap.data();

        const updatedItems = [...pedidoData.items];
        const item = updatedItems[asig.itemIndex];

        // Si se asignó completo, cambiar estado a "Listo para Entrega"
        if (asig.esCompleto) {
          updatedItems[asig.itemIndex] = {
            ...item,
            estadoItem: 'Listo para Entrega'
          };
        }

        batch.update(pedidoRef, {
          items: updatedItems,
          updatedAt: serverTimestamp()
        });
      }

      // 4.3. Crear registro de auditoría en stockEntries
      const entryRef = doc(collection(db, 'stockEntries'));
      batch.set(entryRef, {
        tipoEntrada: 'proveedor',
        productId: selectedProduct.id,
        referencia: selectedProduct.referencia,
        nombre: selectedProduct.nombre,
        talla: selectedProduct.talla || 'Única',
        cantidad: numCantidad,
        cantidadAsignada: cantidadAsignada,
        cantidadDisponible: cantidadDisponible,
        asignaciones: asignaciones.map(a => ({
          pedidoId: a.pedidoId,
          numeroPedido: a.numeroPedido,
          clienteNombre: a.clienteNombre,
          cantidad: a.cantidadAsignada
        })),
        costoUnitario: costoCompra,
        costoTotal: costoCompra * numCantidad,
        proveedorId: proveedorId,
        facturaProveedor: facturaProveedor.trim() || '',
        userId: currentUser.uid,
        notas: notas.trim() || '',
        fechaEntrada: serverTimestamp(), // Fecha de entrada
        createdAt: serverTimestamp()
      });

      // 4.4. Registrar transacción de egreso (costo de compra)
      const costoTotal = costoCompra * numCantidad;
      if (costoTotal > 0) {
        const proveedorSeleccionado = proveedores.find(p => p.id === proveedorId);
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'entrada_proveedor',
          monto: -costoTotal,
          metodoPago: 'Pendiente',
          entradaId: entryRef.id,
          descripcion: `Compra a proveedor: ${selectedProduct.nombre} (${numCantidad} uds) - ${proveedorSeleccionado?.nombre || 'Proveedor'}${facturaProveedor ? ` - Factura: ${facturaProveedor}` : ''}`,
          productId: selectedProduct.id,
          productoNombre: selectedProduct.nombre,
          proveedorId: proveedorId,
          proveedorNombre: proveedorSeleccionado?.nombre || '',
          facturaProveedor: facturaProveedor.trim() || '',
          cantidad: numCantidad,
          costoUnitario: costoCompra,
          userId: currentUser.uid,
          fecha: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      // 4.5. Commit atómico
      await batch.commit();

      // Preparar datos del reporte para impresión
      const proveedorSeleccionado = proveedores.find(p => p.id === proveedorId);
      setReporteData({
        tipoEntrada: 'Proveedor',
        proveedorNombre: proveedorSeleccionado?.nombre || 'N/A',
        facturaProveedor: facturaProveedor.trim() || 'N/A',
        producto: selectedProduct.nombre,
        referencia: selectedProduct.referencia,
        talla: selectedProduct.talla,
        cantidadTotal: numCantidad,
        cantidadAsignada: cantidadAsignada,
        cantidadDisponible: cantidadDisponible,
        asignaciones: asignaciones,
        fecha: new Date().toLocaleString('es-CO')
      });

      // Mostrar modal de reporte
      setShowReporteAsignaciones(true);

      // Limpiar formulario y selección
      handleCancel();

      // Recargar productos para ver stock actualizado
      fetchAllProducts();
    } catch (error) {
      console.error('Error al guardar compra:', error);
      alert('Error al guardar la compra: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancelar selección
  const handleCancel = () => {
    setSelectedProduct(null);
    setCantidad('');
    setProveedorId('');
    setFacturaProveedor('');
    setNotas('');
    setSearchTerm('');
    setSearchResults([]);
  };

  // Calcular stock disponible
  const calcularStockTotal = (product) => {
    const stockTotal = product.stockTotal || 0;
    const stockReservadoPedidos = product.stockReservadoPedidos || 0;
    const stockReservadoApartados = product.stockReservadoApartados || 0;
    return stockTotal - stockReservadoPedidos - stockReservadoApartados;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Compra a Proveedor</h1>
      <p className="text-gray-600 mb-6">Registra la compra de productos terminados (ej. medias, corbatas).</p>

      {/* Sección de Búsqueda */}
      {!selectedProduct && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Buscar Producto a Comprar</h2>
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por referencia o nombre..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{product.nombre}</p>
                        <p className="text-sm text-gray-600">Ref: {product.referencia}</p>
                        <p className="text-sm text-gray-500">Talla: {product.talla || 'Única'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          Stock: {calcularStockTotal(product)}
                        </p>
                        <p className="text-sm text-gray-500">
                          ${product.precio?.toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulario de Entrada */}
      {selectedProduct && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{selectedProduct.nombre}</h2>
              <p className="text-sm text-gray-500">Ref: {selectedProduct.referencia}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Stock Disponible Actual</p>
              <p className="text-2xl font-bold text-gray-800">
                {calcularStockTotal(selectedProduct)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveCompra} className="space-y-4">
            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad Comprada <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                  disabled={loading}
                >
                  <option value="">Selecciona un proveedor...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (NIT: {p.nit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Factura Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Factura Proveedor (Opcional)
                </label>
                <input
                  type="text"
                  value={facturaProveedor}
                  onChange={(e) => setFacturaProveedor(e.target.value)}
                  placeholder="N° de factura o remisión"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas de Compra (Opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Pago a 30 días..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: '#EA5C2E' }}
                className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Guardar Compra'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Reporte de Asignaciones */}
      {showReporteAsignaciones && reporteData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div id="reporte-asignaciones-print">
              {/* Cabecera del reporte */}
              <div className="bg-primary text-white px-6 py-4 print:bg-white print:text-black print:border-b-2 print:border-primary">
                <h2 className="text-2xl font-bold">📦 REPORTE DE ASIGNACIÓN DE PRENDAS</h2>
                <p className="text-sm mt-1">Entrada de {reporteData.tipoEntrada} - {reporteData.fecha}</p>
              </div>

              {/* Información del producto */}
              <div className="p-6 border-b border-gray-200 print:border-black">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Producto Recibido</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Producto:</p>
                    <p className="font-medium">{reporteData.producto}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Referencia:</p>
                    <p className="font-medium">{reporteData.referencia}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Talla:</p>
                    <p className="font-medium">{reporteData.talla}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{reporteData.tipoEntrada}:</p>
                    <p className="font-medium">{reporteData.proveedorNombre}</p>
                  </div>
                  {reporteData.facturaProveedor !== 'N/A' && (
                    <div>
                      <p className="text-sm text-gray-600">Factura:</p>
                      <p className="font-medium">{reporteData.facturaProveedor}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Cantidad Total:</p>
                    <p className="font-bold text-xl text-primary">{reporteData.cantidadTotal}</p>
                  </div>
                </div>
              </div>

              {/* Asignaciones a pedidos */}
              {reporteData.asignaciones.length > 0 && (
                <div className="p-6 border-b border-gray-200 print:border-black">
                  <h3 className="text-lg font-semibold mb-3 text-green-700">
                    ✅ Prendas Asignadas a Pedidos ({reporteData.cantidadAsignada})
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 print:mb-6">
                    <strong>INSTRUCCIONES PARA BODEGA:</strong> Busque la bolsa del cliente. Si ya existe, agregue estas prendas. Si no existe, cree una nueva bolsa y sepárela para no venderla.
                  </p>

                  <div className="space-y-4">
                    {reporteData.asignaciones.map((asig, idx) => (
                      <div
                        key={idx}
                        className="border-2 border-green-200 rounded-lg p-4 bg-green-50 print:border-black print:bg-white print:page-break-inside-avoid"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-lg">
                              Pedido #{String(asig.numeroPedido).padStart(4, '0')}
                            </p>
                            <p className="text-gray-700">Cliente: {asig.clienteNombre}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-700">
                              {asig.cantidadAsignada}
                            </p>
                            <p className="text-sm text-gray-600">
                              de {asig.cantidadNecesaria} prendas
                            </p>
                          </div>
                        </div>

                        {!asig.esCompleto && (
                          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded print:border-black">
                            <p className="text-sm text-yellow-800 print:text-black">
                              ⚠️ <strong>PEDIDO PARCIAL:</strong> Quedan {asig.cantidadNecesaria - asig.cantidadAsignada} prendas pendientes para este pedido
                            </p>
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-green-200 print:border-black">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="w-4 h-4" />
                            <span>Prendas empacadas en bolsa del cliente</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock disponible */}
              {reporteData.cantidadDisponible > 0 && (
                <div className="p-6 border-b border-gray-200 print:border-black">
                  <h3 className="text-lg font-semibold mb-3 text-blue-700">
                    📊 Stock Disponible para Venta
                  </h3>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 print:border-black print:bg-white">
                    <div className="flex justify-between items-center">
                      <p className="text-gray-700">Prendas que quedaron disponibles para venta:</p>
                      <p className="text-3xl font-bold text-blue-700">{reporteData.cantidadDisponible}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200 print:border-black">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="w-4 h-4" />
                        <span>Stock agregado al inventario general</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {reporteData.asignaciones.length === 0 && (
                <div className="p-6">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center print:border-black print:bg-white">
                    <p className="text-lg text-blue-700 mb-2">ℹ️ No hay pedidos pendientes</p>
                    <p className="text-gray-600">Todas las {reporteData.cantidadTotal} prendas están disponibles para venta</p>
                  </div>
                </div>
              )}

              {/* Pie de página */}
              <div className="p-6 bg-gray-50 print:bg-white">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Recibido por:</p>
                    <div className="border-b border-gray-400 mt-2 pb-1">_____________________</div>
                  </div>
                  <div>
                    <p className="text-gray-600">Firma:</p>
                    <div className="border-b border-gray-400 mt-2 pb-1">_____________________</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción (no se imprimen) */}
            <div className="px-6 py-4 bg-gray-100 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#D50565' }}
                className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                🖨️ Imprimir Reporte
              </button>
              <button
                onClick={() => setShowReporteAsignaciones(false)}
                className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntradaProveedor;
