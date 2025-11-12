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

const EntradaSatelite = () => {
  const { currentUser } = useAuth();

  // Estados principales
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados del formulario
  const [cantidad, setCantidad] = useState('');
  const [sateliteId, setSateliteId] = useState('');
  const [notas, setNotas] = useState('');

  // Lista de satélites y productos
  const [satelites, setSatelites] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  // Cargar satélites y productos al iniciar
  useEffect(() => {
    fetchSatelites();
    fetchAllProducts();
  }, []);

  const fetchSatelites = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'satelites'));
      const satelitesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSatelites(satelitesData);
    } catch (error) {
      console.error('Error al cargar satélites:', error);
      alert('Error al cargar los satélites.');
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

  // Filtrar productos en tiempo real cuando cambia el término de búsqueda
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
    setSateliteId('');
    setNotas('');
  };

  // Guardar entrada de stock (Versión Atómica con Costo Automático)
  const handleSaveEntrada = async (e) => {
    e.preventDefault();

    // Validaciones
    const numCantidad = Number(cantidad);

    if (!numCantidad || numCantidad <= 0) {
      alert('Por favor, ingresa una cantidad válida mayor a 0.');
      return;
    }
    if (!sateliteId) {
      alert('Por favor, selecciona un satélite.');
      return;
    }

    // Obtener el costo del satélite del producto (configurado en Gestión de Costos)
    const costoSatelite = selectedProduct.costoSatelite || 0;

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
        tipoEntrada: 'satelite',
        productId: selectedProduct.id,
        referencia: selectedProduct.referencia,
        nombre: selectedProduct.nombre,
        talla: selectedProduct.talla || 'Única',
        cantidad: numCantidad,
        costoUnitario: costoSatelite,
        costoTotal: costoSatelite * numCantidad,
        sateliteId: sateliteId,
        userId: currentUser.uid,
        notas: notas.trim() || '',
        pagado: false, // Para tracking de cuentas por pagar
        createdAt: serverTimestamp()
      });

      // 3. Registrar transacción de egreso (costo de entrada)
      const costoTotal = costoSatelite * numCantidad;
      if (costoTotal > 0) {
        const sateliteSeleccionado = satelites.find(s => s.id === sateliteId);
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'entrada_satelite',
          monto: -costoTotal, // Negativo porque es un egreso/costo
          metodoPago: 'Pendiente', // Se registrará cuando se pague
          entradaId: entryRef.id,
          descripcion: `Entrada de satélite: ${selectedProduct.nombre} (${numCantidad} uds) - ${sateliteSeleccionado?.nombre || 'Satélite'}`,
          productId: selectedProduct.id,
          productoNombre: selectedProduct.nombre,
          sateliteId: sateliteId,
          sateliteNombre: sateliteSeleccionado?.nombre || '',
          cantidad: numCantidad,
          costoUnitario: costoSatelite,
          userId: currentUser.uid,
          fecha: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      // 4. Commit atómico
      await batch.commit();

      alert('¡Stock actualizado correctamente!');

      // Limpiar formulario y selección
      handleCancel();

      // Recargar productos para ver stock actualizado
      fetchAllProducts();
    } catch (error) {
      console.error('Error al guardar entrada:', error);
      alert('Error al guardar la entrada. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar selección
  const handleCancel = () => {
    setSelectedProduct(null);
    setCantidad('');
    setSateliteId('');
    setNotas('');
    setSearchTerm('');
    setSearchResults([]);
  };

  // Calcular stock total actual
  const calcularStockTotal = (product) => {
    // BUGFIX: El stock reservado debe restarse
    const stockTotal = product.stockTotal || 0;
    const stockReservadoPedidos = product.stockReservadoPedidos || 0;
    const stockReservadoApartados = product.stockReservadoApartados || 0;
    return stockTotal - stockReservadoPedidos - stockReservadoApartados;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Entrada de Satélite (Producción)</h1>
      <p className="text-gray-600 mb-6">Añade stock terminado proveniente de un taller satélite.</p>

      {/* Sección de Búsqueda */}
      {!selectedProduct && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Buscar Producto a Ingresar</h2>

          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por referencia o nombre..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              La búsqueda se realiza automáticamente mientras escribes
            </p>
          </div>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  {searchResults.length} producto(s) encontrado(s)
                </p>
              </div>
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
                        {product.talla && (
                          <p className="text-sm text-gray-500">Talla: {product.talla}</p>
                        )}
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

      {/* Formulario de Entrada (visible solo si hay producto seleccionado) */}
      {selectedProduct && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Producto Seleccionado</h2>
              <p className="text-gray-600 mt-1">{selectedProduct.nombre}</p>
              <p className="text-sm text-gray-500">Ref: {selectedProduct.referencia}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Stock Disponible Actual</p>
              <p className="text-2xl font-bold text-gray-800">
                {calcularStockTotal(selectedProduct)}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveEntrada} className="space-y-4">
            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad a Añadir <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej: 50"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                disabled={loading}
              />
            </div>

            {/* Satélite */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Satélite (Origen) <span className="text-red-500">*</span>
              </label>
              <select
                value={sateliteId}
                onChange={(e) => setSateliteId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="">Selecciona un satélite...</option>
                {satelites.map((satelite) => (
                  <option key={satelite.id} value={satelite.id}>
                    {satelite.nombre} ({satelite.codigo})
                  </option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas de Entrada (Opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Lote de producción #456..."
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
                {loading ? 'Guardando...' : 'Guardar Entrada'}
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

export default EntradaSatelite;
