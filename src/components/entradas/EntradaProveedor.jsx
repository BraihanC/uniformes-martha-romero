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
  writeBatch
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
      const batch = writeBatch(db);

      // 1. Actualizar el stockTotal del producto
      const productRef = doc(db, 'products', selectedProduct.id);
      batch.update(productRef, {
        stockTotal: increment(numCantidad),
        updatedAt: serverTimestamp()
      });

      // 2. Crear registro de auditoría en stockEntries
      const entryRef = doc(collection(db, 'stockEntries'));
      batch.set(entryRef, {
        tipoEntrada: 'proveedor',
        productId: selectedProduct.id,
        referencia: selectedProduct.referencia,
        nombre: selectedProduct.nombre,
        talla: selectedProduct.talla || 'Única',
        cantidad: numCantidad,
        costoUnitario: costoCompra,
        costoTotal: costoCompra * numCantidad,
        proveedorId: proveedorId,
        facturaProveedor: facturaProveedor.trim() || '',
        userId: currentUser.uid,
        notas: notas.trim() || '',
        createdAt: serverTimestamp()
      });

      // 3. Registrar transacción de egreso (costo de compra)
      const costoTotal = costoCompra * numCantidad;
      if (costoTotal > 0) {
        const proveedorSeleccionado = proveedores.find(p => p.id === proveedorId);
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'entrada_proveedor',
          monto: -costoTotal, // Negativo porque es un egreso/costo
          metodoPago: 'Pendiente', // Se registrará cuando se pague
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

      // 4. Commit atómico
      await batch.commit();

      alert('¡Compra registrada y stock actualizado!');

      // Limpiar formulario y selección
      handleCancel();

      // Recargar productos para ver stock actualizado
      fetchAllProducts();
    } catch (error) {
      console.error('Error al guardar compra:', error);
      alert('Error al guardar la compra. Intenta de nuevo.');
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
    </div>
  );
};

export default EntradaProveedor;
