import { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [colegios, setColegios] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColegio, setFilterColegio] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStock, setFilterStock] = useState(''); // todos, bajo, agotado

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 10;

  // Estado del formulario
  const [formData, setFormData] = useState({
    referencia: '',
    nombre: '',
    colegio: '',
    talla: '',
    tipo: 'diario',
    precio: 0,
    precioB2B: 0,
    stockTotal: 0,
    esB2B: false
  });

  // Cargar productos y colegios al montar el componente
  useEffect(() => {
    fetchProducts();
    fetchColegios();
  }, []);

  // Calcular stock disponible (nunca muestra negativos)
  // Solo resta stockReservadoPedidos (pedidos listos para entrega) y stockReservadoApartados
  // NO resta totalPrendasPedidas porque son prendas que aún no existen físicamente
  const calcularStockDisponible = (product) => {
    const disponible = (product.stockTotal || 0) - (product.stockReservadoPedidos || 0) - (product.stockReservadoApartados || 0);
    return Math.max(0, disponible); // Si es negativo, muestra 0
  };

  // Función para ordenar productos por talla
  const sortByTalla = (products) => {
    // Orden de tallas personalizado
    const tallaOrder = {
      // Tallas numéricas
      '4': 1, '6': 2, '8': 3, '10': 4, '12': 5, '14': 6, '16': 7,
      // Rangos de medias
      '4-6': 1.5, '6-8': 2.5, '8-10': 3.5, '10-12': 4.5, '12-14': 5.5,
      // Tallas con letras
      'XS': 8, 'S': 9, 'M': 10, 'L': 11, 'XL': 12, 'XXL': 13,
      // Tallas genéricas
      'PEQUEÑA': 14, 'MEDIANA': 15, 'GRANDE': 16
    };

    return [...products].sort((a, b) => {
      const tallaA = (a.talla || '').toUpperCase().trim();
      const tallaB = (b.talla || '').toUpperCase().trim();

      const orderA = tallaOrder[tallaA] || 999;
      const orderB = tallaOrder[tallaB] || 999;

      // Si ambos tienen orden definido, compararlos
      if (orderA !== 999 && orderB !== 999) {
        return orderA - orderB;
      }

      // Si uno tiene orden y el otro no, el que tiene orden va primero
      if (orderA !== 999) return -1;
      if (orderB !== 999) return 1;

      // Si ninguno tiene orden, ordenar alfabéticamente
      return tallaA.localeCompare(tallaB);
    });
  };

  // Filtrar productos cuando cambian los filtros o la búsqueda
  useEffect(() => {
    let filtered = [...products];

    // Filtro por búsqueda (nombre o referencia)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.nombre?.toLowerCase().includes(search) ||
        product.referencia?.toLowerCase().includes(search)
      );
    }

    // Filtro por colegio
    if (filterColegio) {
      filtered = filtered.filter(product => product.colegio === filterColegio);
    }

    // Filtro por tipo (reconoce "dia"/"diario" y "dep"/"deportivo")
    if (filterTipo) {
      filtered = filtered.filter(product => {
        const productoTipo = product.tipo?.toLowerCase() || '';
        const filtroTipo = filterTipo.toLowerCase();

        // Si el filtro es "diario", acepta "diario" o "dia"
        if (filtroTipo === 'diario') {
          return productoTipo === 'diario' || productoTipo === 'dia';
        }
        // Si el filtro es "deportivo", acepta "deportivo" o "dep"
        if (filtroTipo === 'deportivo') {
          return productoTipo === 'deportivo' || productoTipo === 'dep';
        }
        return productoTipo === filtroTipo;
      });
    }

    // Filtro por stock
    if (filterStock === 'bajo') {
      filtered = filtered.filter(product => {
        const stockDisp = calcularStockDisponible(product);
        return stockDisp > 0 && stockDisp <= 5;
      });
    } else if (filterStock === 'agotado') {
      filtered = filtered.filter(product => calcularStockDisponible(product) <= 0);
    }

    // Ordenar por talla
    filtered = sortByTalla(filtered);

    setFilteredProducts(filtered);
    setPaginaActual(1); // Reiniciar a página 1 cuando se filtra
  }, [searchTerm, filterColegio, filterTipo, filterStock, products]);

  // Obtener todos los productos
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  // Obtener todos los colegios
  const fetchColegios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
    }
  };

  // Abrir modal para crear producto
  const handleOpenModal = () => {
    setEditingProduct(null);
    setFormData({
      referencia: '',
      nombre: '',
      colegio: '',
      talla: '',
      tipo: 'diario',
      precio: 0,
      precioB2B: 0,
      stockTotal: 0,
      esB2B: false
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar producto
  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      referencia: product.referencia,
      nombre: product.nombre,
      colegio: product.colegio,
      talla: product.talla,
      tipo: product.tipo,
      precio: product.precio,
      precioB2B: product.precioB2B || 0,
      stockTotal: product.stockTotal,
      esB2B: product.esB2B || false
    });
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      referencia: '',
      nombre: '',
      colegio: '',
      talla: '',
      tipo: 'diario',
      precio: 0,
      precioB2B: 0,
      stockTotal: 0,
      esB2B: false
    });
  };

  // Verificar si la referencia ya existe (solo al crear)
  const checkReferenciaExists = async (referencia) => {
    const q = query(collection(db, 'products'), where('referencia', '==', referencia));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  // Guardar producto (crear o actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.referencia.trim() || !formData.nombre.trim() || !formData.colegio.trim() || !formData.talla.trim()) {
      alert('Por favor, completa todos los campos requeridos.');
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        // Actualizar producto existente
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, {
          referencia: formData.referencia.trim(),
          nombre: formData.nombre.trim(),
          colegio: formData.colegio,
          talla: formData.talla.trim(),
          tipo: formData.tipo,
          precio: Number(formData.precio),
          precioB2B: Number(formData.precioB2B) || 0,
          stockTotal: Number(formData.stockTotal),
          esB2B: formData.esB2B,
          updatedAt: serverTimestamp()
        });
        alert('Producto actualizado correctamente.');
      } else {
        // Verificar si la referencia ya existe
        const exists = await checkReferenciaExists(formData.referencia.trim());
        if (exists) {
          alert('Ya existe un producto con esta referencia. Por favor, usa una referencia única.');
          setLoading(false);
          return;
        }

        // Crear nuevo producto
        await addDoc(collection(db, 'products'), {
          referencia: formData.referencia.trim(),
          nombre: formData.nombre.trim(),
          colegio: formData.colegio,
          talla: formData.talla.trim(),
          tipo: formData.tipo,
          precio: Number(formData.precio),
          precioB2B: Number(formData.precioB2B) || 0,
          stockTotal: Number(formData.stockTotal),
          esB2B: formData.esB2B,
          totalPrendasPedidas: 0,
          stockReservadoPedidos: 0,
          stockReservadoApartados: 0,
          createdAt: serverTimestamp()
        });
        alert('Producto guardado correctamente.');
      }

      handleCloseModal();
      fetchProducts();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('Error al guardar el producto.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar producto
  const handleDelete = async (id, nombre) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar el producto "${nombre}"?`
    );

    if (!confirmDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'products', id));
      alert('Producto eliminado correctamente.');
      fetchProducts();
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      alert('Error al eliminar el producto.');
    } finally {
      setLoading(false);
    }
  };

  // Activar input de archivo
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Importación masiva desde Excel
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensión
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      alert('Por favor, selecciona un archivo .xlsx o .csv');
      return;
    }

    setLoading(true);

    try {
      // Leer el archivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('El archivo está vacío o no tiene el formato correcto.');
        setLoading(false);
        return;
      }

      // VALIDACIÓN PREVIA 1: Obtener todas las referencias existentes
      const existingProductsSnapshot = await getDocs(collection(db, 'products'));
      const referenciasSet = new Set();
      existingProductsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.referencia) {
          referenciasSet.add(String(data.referencia));
        }
      });

      // VALIDACIÓN PREVIA 2: Obtener todos los códigos de colegio existentes
      const existingColegiosSnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosSet = new Set();
      existingColegiosSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.codigo) {
          colegiosSet.add(String(data.codigo));
        }
      });

      // Preparar batch y contadores
      const batch = writeBatch(db);
      let nuevosProductos = 0;
      let omitidosPorDuplicado = 0;
      let omitidosPorColegio = 0;

      // Procesar cada fila del Excel
      jsonData.forEach((row) => {
        const referencia = String(row.REFERENCIA || '').trim();
        const codigoColegio = String(row.CODIGO_COLEGIO || '').trim();

        // Validar que tenga al menos referencia y nombre
        if (!referencia || !row.NOMBRE) {
          omitidosPorDuplicado++;
          return;
        }

        // VALIDACIÓN 1: Verificar si la referencia ya existe
        if (referenciasSet.has(referencia)) {
          omitidosPorDuplicado++;
          return;
        }

        // VALIDACIÓN 2: Verificar si el código de colegio existe
        if (!colegiosSet.has(codigoColegio)) {
          omitidosPorColegio++;
          return;
        }

        // Añadir al Set para evitar duplicados en el mismo archivo
        referenciasSet.add(referencia);

        // Crear el nuevo producto
        const newProductRef = doc(collection(db, 'products'));
        batch.set(newProductRef, {
          referencia: referencia,
          nombre: String(row.NOMBRE || '').trim(),
          colegio: codigoColegio, // Guardamos el CÓDIGO del colegio
          talla: String(row.TALLA || '').trim(),
          tipo: String(row.TIPO || 'diario').toLowerCase(),
          precio: Number(row.PRECIO || 0),
          stockTotal: Number(row.STOCK_TOTAL || 0),
          stockReservadoPedidos: 0,
          stockReservadoApartados: 0,
          esB2B: row.ES_B2B === 'SI' || row.ES_B2B === 'si' || row.ES_B2B === true || row.ES_B2B === 1,
          createdAt: serverTimestamp()
        });

        nuevosProductos++;
      });

      // Ejecutar el batch
      if (nuevosProductos > 0) {
        await batch.commit();
      }

      // Recargar la lista de productos
      await fetchProducts();

      // Mostrar resultado detallado
      alert(
        `Importación completada:\n` +
        `- Nuevos productos añadidos: ${nuevosProductos}\n` +
        `- Omitidos por REFERENCIA duplicada: ${omitidosPorDuplicado}\n` +
        `- Omitidos por CÓDIGO de colegio no válido: ${omitidosPorColegio}`
      );

      // Limpiar el input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error al importar inventario:', error);
      alert('Error al importar el archivo. Verifica el formato y los datos.');
    } finally {
      setLoading(false);
    }
  };

  // Formatear precio como moneda
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <div className="max-w-7xl">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Inventario</h1>
          <p className="text-gray-600 mt-1">Gestión de productos y stock</p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleImportClick}
              disabled={loading}
              style={{ backgroundColor: '#EA5C2E' }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Importar Inventario</span>
              <span className="sm:hidden">Importar</span>
            </button>
            <button
              onClick={handleOpenModal}
              style={{ backgroundColor: '#D50565' }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <span className="hidden sm:inline">+ Añadir Nuevo Producto</span>
              <span className="sm:hidden">+ Añadir</span>
            </button>
          </div>
        )}
      </div>

      {/* Input file oculto para importar Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Búsqueda */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o referencia..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
            />
          </div>

          {/* Filtro por Colegio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colegio
            </label>
            <select
              value={filterColegio}
              onChange={(e) => setFilterColegio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
            >
              <option value="">Todos</option>
              {colegios.map(colegio => (
                <option key={colegio.id} value={colegio.codigo}>
                  {colegio.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
            >
              <option value="">Todos</option>
              <option value="diario">Diario</option>
              <option value="deportivo">Deportivo</option>
            </select>
          </div>

          {/* Filtro por Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock
            </label>
            <select
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
            >
              <option value="">Todos</option>
              <option value="bajo">Stock Bajo (≤5)</option>
              <option value="agotado">Agotado (0)</option>
            </select>
          </div>
        </div>

        {/* Botón para limpiar filtros */}
        {(searchTerm || filterColegio || filterTipo || filterStock) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterColegio('');
                setFilterTipo('');
                setFilterStock('');
              }}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Limpiar Filtros
            </button>
          </div>
        )}

        {/* Contador de resultados */}
        <div className="mt-3 text-sm text-gray-600">
          Mostrando <span className="font-semibold">{filteredProducts.length}</span> de{' '}
          <span className="font-semibold">{products.length}</span> productos
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Cargando inventario...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {products.length === 0
              ? 'No hay productos en el inventario. Añade uno nuevo usando el botón de arriba.'
              : 'No se encontraron productos con los filtros seleccionados.'}
          </div>
        ) : (
          <>
            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden space-y-4">
              {(() => {
                const indiceInicio = (paginaActual - 1) * productosPorPagina;
                const indiceFin = indiceInicio + productosPorPagina;
                const productosPaginados = filteredProducts.slice(indiceInicio, indiceFin);

                return productosPaginados.map((product) => {
                  const stockDisponible = calcularStockDisponible(product);
                  return (
                    <div key={product.id} className="bg-white border rounded-lg p-4 shadow-sm">
                      {/* Header de la tarjeta */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{product.nombre}</h3>
                          <p className="text-sm text-gray-500 font-mono">Ref: {product.referencia}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          product.tipo === 'diario' || product.tipo === 'dia'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {product.tipo}
                        </span>
                      </div>

                      {/* Información del producto */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Colegio:</span>
                          <p className="font-medium text-gray-900">{product.colegio}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Talla:</span>
                          <p className="font-medium text-gray-900">{product.talla}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Precio:</span>
                          <p className="font-semibold text-gray-900">{formatPrice(product.precio)}</p>
                        </div>
                      </div>

                      {/* Stock */}
                      <div className="grid grid-cols-4 gap-2 text-xs mb-3 p-2 bg-gray-50 rounded">
                        <div className="text-center">
                          <p className="text-gray-500 mb-1">Disponible</p>
                          <p className={`font-bold ${
                            stockDisponible <= 0 ? 'text-red-600' :
                            stockDisponible <= 5 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {stockDisponible}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 mb-1">Total Pedidas</p>
                          <p className="font-medium text-blue-600">{product.totalPrendasPedidas || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 mb-1">Res. Pedidos</p>
                          <p className="font-medium text-gray-700">{product.stockReservadoPedidos || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 mb-1">Res. Apartados</p>
                          <p className="font-medium text-gray-700">{product.stockReservadoApartados || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 mb-1">Stock Total</p>
                          <p className="font-bold text-gray-900">{product.stockTotal}</p>
                        </div>
                      </div>

                      {/* Botones de acción - Solo Admin */}
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            disabled={loading}
                            className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(product.id, product.nombre)}
                            disabled={loading}
                            className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referencia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Colegio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Talla
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio B2B
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Disp.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pedidas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Res. Pedidos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Res. Apartados
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      B2B
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Lógica de paginación
                    const indiceInicio = (paginaActual - 1) * productosPorPagina;
                    const indiceFin = indiceInicio + productosPorPagina;
                    const productosPaginados = filteredProducts.slice(indiceInicio, indiceFin);

                    return productosPaginados.map((product) => {
                      const stockDisponible = calcularStockDisponible(product);
                      return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        {product.referencia}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {product.nombre}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {product.colegio}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {product.talla}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          product.tipo === 'diario' || product.tipo === 'dia'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {product.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatPrice(product.precio)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {product.precioB2B ? (
                          <span className="text-pink-600 font-medium">
                            {formatPrice(product.precioB2B)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${
                          stockDisponible <= 0 ? 'text-red-600' :
                          stockDisponible <= 5 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {stockDisponible}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {product.totalPrendasPedidas || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {product.stockReservadoPedidos || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {product.stockReservadoApartados || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {product.stockTotal}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                        {product.esB2B ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 border border-pink-200">
                            ✓ B2B
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(product.id, product.nombre)}
                            disabled={loading}
                            className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </td>
                      )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Controles de Paginación */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-700">
                Página <span className="font-medium">{paginaActual}</span> de{' '}
                <span className="font-medium">{Math.ceil(filteredProducts.length / productosPorPagina)}</span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setPaginaActual(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  className="px-3 sm:px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-200"
                >
                  <span className="hidden sm:inline">Anterior</span>
                  <span className="sm:hidden">&larr;</span>
                </button>
                <button
                  onClick={() => setPaginaActual(paginaActual + 1)}
                  disabled={paginaActual >= Math.ceil(filteredProducts.length / productosPorPagina)}
                  className="px-3 sm:px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-200"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <span className="sm:hidden">&rarr;</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                {editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Referencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referencia (SKU) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.referencia}
                    onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                    placeholder="Ej: 10201"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Chaqueta Deportiva"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Colegio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colegio <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.colegio}
                    onChange={(e) => setFormData({ ...formData, colegio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  >
                    <option value="">Seleccionar colegio</option>
                    {colegios.map((colegio) => (
                      <option key={colegio.id} value={colegio.codigo}>
                        {colegio.nombre} ({colegio.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Talla */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Talla <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.talla}
                    onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                    placeholder="Ej: 4, M, UNICA"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  >
                    <option value="diario">Diario</option>
                    <option value="deportivo">Deportivo</option>
                  </select>
                </div>

                {/* Precio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Regular <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    placeholder="Ej: 50000"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Precio para POS, Pedidos y Apartados
                  </p>
                </div>

                {/* Precio B2B */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio B2B
                  </label>
                  <input
                    type="number"
                    value={formData.precioB2B}
                    onChange={(e) => setFormData({ ...formData, precioB2B: e.target.value })}
                    placeholder="Ej: 45000"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Precio para Portal Corporativo (opcional)
                  </p>
                </div>

                {/* Stock Total */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.stockTotal}
                    onChange={(e) => setFormData({ ...formData, stockTotal: e.target.value })}
                    placeholder="Ej: 100"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Producto B2B */}
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.esB2B}
                      onChange={(e) => setFormData({ ...formData, esB2B: e.target.checked })}
                      className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-2 focus:ring-pink-500"
                      disabled={loading}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Producto B2B (Visible en Portal Corporativo)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Marca esta opción si el producto estará disponible para pedidos B2B de clientes corporativos
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Guardar Producto'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
