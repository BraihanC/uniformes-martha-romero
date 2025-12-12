import { useState, useEffect, useRef } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  writeBatch,
  doc,
  query,
  orderBy,
  limit,
  getDoc,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const POS = () => {
  const { currentUser } = useAuth();
  const searchInputRef = useRef(null);

  // Data states
  const [colegios, setColegios] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);

  // Filter states
  const [selectedColegio, setSelectedColegio] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Cart states
  const [cartItems, setCartItems] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [aplicarIVA, setAplicarIVA] = useState(false);
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // General discount states
  const [descuentoGeneral, setDescuentoGeneral] = useState(0);
  const [tipoDescuentoGeneral, setTipoDescuentoGeneral] = useState('%'); // '%' or '$'

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [ventaData, setVentaData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // New client form
  const [newClientData, setNewClientData] = useState({
    nombreCompleto: '',
    tipoDocumento: 'Cédula de Ciudadanía',
    numeroDocumento: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    colegioId: ''
  });

  // Tipos de documento disponibles
  const tiposDocumento = [
    'Cédula de Ciudadanía',
    'NIT',
    'Cédula de Extranjería',
    'Tarjeta de Identidad'
  ];

  // Loading state
  const [loading, setLoading] = useState(true);

  // Mobile tab state (for responsive design)
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' or 'carrito'

  // ====== DATA LOADING ======
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load colegios
      const colegiosSnap = await getDocs(collection(db, 'colegios'));
      const colegiosData = colegiosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setColegios(colegiosData);

      // Load products
      const productsSnap = await getDocs(collection(db, 'products'));
      const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
      setFilteredProducts(productsData);

      // Load clients
      const clientsSnap = await getDocs(collection(db, 'clients'));
      const clientsData = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);

      // Load company config
      const companyDoc = await getDoc(doc(db, 'config', 'company'));
      if (companyDoc.exists()) {
        setCompanyConfig(companyDoc.data());
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar datos: ' + error.message);
      setLoading(false);
    }
  };

  // ====== FILTERING LOGIC ======
  useEffect(() => {
    filterProducts();
  }, [selectedColegio, selectedTipo, searchQuery, products]);

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

  const filterProducts = () => {
    let filtered = [...products];

    // Filter out B2B-only products (for corporate portal)
    filtered = filtered.filter(p => !p.esB2B);

    // Filter by colegio (using 'colegio' field which contains the colegio code)
    if (selectedColegio) {
      filtered = filtered.filter(p => p.colegio === selectedColegio);
    }

    // Filter by tipo (reconoce "dia"/"diario" y "dep"/"deportivo")
    if (selectedTipo !== 'Todos') {
      filtered = filtered.filter(p => {
        const productoTipo = p.tipo?.toLowerCase() || '';
        const filtroTipo = selectedTipo.toLowerCase();

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

    // Filter by search query (nombre or referencia)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.nombre?.toLowerCase().includes(query) ||
        p.referencia?.toLowerCase().includes(query)
      );
    }

    // Ordenar por talla
    filtered = sortByTalla(filtered);

    setFilteredProducts(filtered);
  };

  // ====== SCANNER LOGIC ======
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Look for exact match by referencia
      const product = products.find(p =>
        p.referencia?.toLowerCase() === searchQuery.toLowerCase().trim()
      );

      if (product) {
        handleAddToCart(product);
        setSearchQuery(''); // Clear search after adding
      }
    }
  };

  // ====== CART FUNCTIONS ======
  const calculateAvailableStock = (product) => {
    const stockTotal = product.stockTotal || 0;
    const stockReservadoPedidos = product.stockReservadoPedidos || 0;
    const stockReservadoApartados = product.stockReservadoApartados || 0;
    return stockTotal - stockReservadoPedidos - stockReservadoApartados;
  };

  const handleAddToCart = (product) => {
    const availableStock = calculateAvailableStock(product);

    if (availableStock <= 0) {
      alert('Producto sin stock disponible');
      return;
    }

    const existingItem = cartItems.find(item => item.product.id === product.id);

    if (existingItem) {
      // Check if we can add one more
      if (existingItem.cantidad >= availableStock) {
        alert('No hay suficiente stock disponible');
        return;
      }
      setCartItems(cartItems.map(item =>
        item.product.id === product.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, {
        product,
        cantidad: 1,
        descuento: 0,
        tipoDescuento: '%' // '%' or '$'
      }]);
    }

    // Return focus to search input
    searchInputRef.current?.focus();
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item.product.id !== productId));
  };

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(productId);
      return;
    }

    const item = cartItems.find(i => i.product.id === productId);
    const availableStock = calculateAvailableStock(item.product);

    if (newQuantity > availableStock) {
      alert('No hay suficiente stock disponible');
      return;
    }

    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, cantidad: newQuantity }
        : item
    ));
  };

  const handleDiscountChange = (productId, descuento) => {
    const discount = Math.max(0, parseFloat(descuento) || 0);
    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, descuento: discount }
        : item
    ));
  };

  const handleDiscountTypeChange = (productId, tipo) => {
    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, tipoDescuento: tipo, descuento: 0 }
        : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedClient(null);
    setClientSearchQuery('');
    setAplicarIVA(false);
    setMetodoPago('Efectivo');
    setDescuentoGeneral(0);
    setTipoDescuentoGeneral('%');

    // Return to catalog tab on mobile after clearing cart
    if (window.innerWidth < 1024) {
      setActiveTab('catalogo');
    }

    searchInputRef.current?.focus();
  };

  // ====== BILLING CALCULATIONS ======
  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      return sum + (item.product.precio * item.cantidad);
    }, 0);
  };

  // Calculate discount per item (considering type: % or $)
  const calculateItemDiscount = (item) => {
    const itemTotal = item.product.precio * item.cantidad;
    if (item.tipoDescuento === '%') {
      return itemTotal * (item.descuento / 100);
    } else {
      // Fixed $ amount, but cannot exceed item total
      return Math.min(item.descuento, itemTotal);
    }
  };

  const calculateTotalDiscountItems = () => {
    return cartItems.reduce((sum, item) => {
      return sum + calculateItemDiscount(item);
    }, 0);
  };

  // Calculate general discount (considering type: % or $)
  const calculateGeneralDiscount = () => {
    const subtotal = calculateSubtotal();
    if (tipoDescuentoGeneral === '%') {
      return subtotal * (descuentoGeneral / 100);
    } else {
      // Fixed $ amount, but cannot exceed subtotal
      return Math.min(descuentoGeneral, subtotal);
    }
  };

  const calculateIVA = () => {
    if (!aplicarIVA) return 0;
    const ivaRate = companyConfig?.iva || 19;
    const subtotalAfterDiscounts = calculateSubtotal() - calculateTotalDiscountItems() - calculateGeneralDiscount();
    return subtotalAfterDiscounts * (ivaRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateTotalDiscountItems() - calculateGeneralDiscount() + calculateIVA();
  };

  // ====== CLIENT SEARCH ======
  const filteredClients = clients.filter(client => {
    const query = clientSearchQuery.toLowerCase();
    return client.nombreCompleto?.toLowerCase().includes(query) ||
           client.numeroDocumento?.toLowerCase().includes(query);
  });

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearchQuery(client.nombreCompleto);
    setShowClientSuggestions(false);
  };

  const handleRemoveClient = () => {
    setSelectedClient(null);
    setClientSearchQuery('');
  };

  // ====== CREATE QUICK CLIENT ======
  const handleCreateQuickClient = async () => {
    // Validar campos requeridos
    if (!newClientData.nombreCompleto.trim()) {
      alert('Por favor ingrese el nombre completo');
      return;
    }
    if (!newClientData.numeroDocumento.trim()) {
      alert('Por favor ingrese el número de documento');
      return;
    }

    try {
      const newClient = {
        nombreCompleto: newClientData.nombreCompleto.trim(),
        tipoDocumento: newClientData.tipoDocumento,
        numeroDocumento: newClientData.numeroDocumento.trim(),
        telefono: newClientData.telefono.trim(),
        email: newClientData.email.trim(),
        direccion: newClientData.direccion.trim(),
        ciudad: newClientData.ciudad.trim(),
        colegioId: newClientData.colegioId || null,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'clients'), newClient);
      const clientWithId = { id: docRef.id, ...newClient };

      setClients([...clients, clientWithId]);
      setSelectedClient(clientWithId);
      setClientSearchQuery(clientWithId.nombreCompleto);
      setNewClientData({
        nombreCompleto: '',
        tipoDocumento: 'Cédula de Ciudadanía',
        numeroDocumento: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: '',
        colegioId: ''
      });
      setShowClientModal(false);
      alert('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Error al crear cliente: ' + error.message);
    }
  };

  // ====== GENERATE FACTURA (CON TRANSACCIÓN Y VERIFICACIÓN DE STOCK) ======
  const handleGenerateFactura = async () => {
    // Validations
    if (!selectedClient) {
      alert('Por favor seleccione un cliente');
      return;
    }
    if (cartItems.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    setLoading(true); // Activar loading
    try {
      // Usar runTransaction para garantizar atomicidad y verificación de stock
      const result = await runTransaction(db, async (transaction) => {
        // 1. Get next invoice number
        const salesQuery = query(
          collection(db, 'sales'),
          orderBy('numeroFactura', 'desc'),
          limit(1)
        );
        const salesSnap = await getDocs(salesQuery);
        let nextNumero = 1;
        if (!salesSnap.empty) {
          const lastSale = salesSnap.docs[0].data();
          nextNumero = (lastSale.numeroFactura || 0) + 1;
        }

        // 2. Verificar stock de TODOS los productos ANTES de proceder
        const stockChecks = [];
        for (const item of cartItems) {
          const productRef = doc(db, 'products', item.product.id);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`El producto "${item.product.nombre}" ya no existe en el sistema.`);
          }

          const currentStock = productSnap.data().stockTotal || 0;

          if (currentStock < item.cantidad) {
            throw new Error(
              `Stock insuficiente para "${item.product.nombre}".\n` +
              `Stock disponible: ${currentStock}\n` +
              `Cantidad solicitada: ${item.cantidad}`
            );
          }

          stockChecks.push({
            ref: productRef,
            product: productSnap.data(),
            requestedQty: item.cantidad,
            availableStock: currentStock
          });
        }

        // 3. Si llegamos aquí, hay stock suficiente para todos los productos
        // Prepare Sale Data
        const totalVenta = calculateTotal();
        const saleData = {
          numeroFactura: nextNumero,
          clienteId: selectedClient.id,
          clienteNombre: selectedClient.nombreCompleto,
          clienteDocumento: selectedClient.numeroDocumento,
          items: cartItems.map(item => ({
            productoId: item.product.id,
            nombre: item.product.nombre,
            referencia: item.product.referencia,
            talla: item.product.talla,
            cantidad: item.cantidad,
            precioUnitario: item.product.precio,
            descuento: item.descuento,
            tipoDescuento: item.tipoDescuento,
            descuentoAplicado: calculateItemDiscount(item),
            subtotal: (item.product.precio * item.cantidad) - calculateItemDiscount(item)
          })),
          subtotal: calculateSubtotal(),
          descuentoItemsTotal: calculateTotalDiscountItems(),
          descuentoGeneral: descuentoGeneral,
          tipoDescuentoGeneral: tipoDescuentoGeneral,
          descuentoGeneralAplicado: calculateGeneralDiscount(),
          descuentoTotal: calculateTotalDiscountItems() + calculateGeneralDiscount(),
          iva: calculateIVA(),
          ivaAplicado: aplicarIVA,
          ivaPorcentaje: aplicarIVA ? (companyConfig?.iva || 19) : 0,
          totalPagado: totalVenta,
          metodoPago: metodoPago,
          vendedorId: currentUser.uid,
          createdAt: serverTimestamp(),
        };

        // 4. Crear la venta
        const saleRef = doc(collection(db, 'sales'));
        transaction.set(saleRef, saleData);

        // 5. Descontar inventario (ya verificado que hay stock suficiente)
        stockChecks.forEach(({ ref, requestedQty }) => {
          transaction.update(ref, {
            stockTotal: increment(-requestedQty)
          });
        });

        // 6. Registrar transacción financiera
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          tipo: 'venta',
          monto: totalVenta,
          metodoPago: metodoPago,
          ventaId: saleRef.id,
          descripcion: `Venta #${nextNumero}`,
          clienteId: selectedClient.id,
          clienteNombre: selectedClient.nombreCompleto,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });

        // Retornar datos para usar fuera de la transacción
        return {
          saleRef,
          saleData,
          nextNumero
        };
      });

      // 7. Transacción exitosa - Recargar productos
      const productsSnap = await getDocs(collection(db, 'products'));
      const productsData = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);

      // 8. Abrir modal de impresión
      setVentaData({
        id: result.saleRef.id,
        ...result.saleData,
        fecha: new Date().toLocaleDateString('es-CO')
      });
      setShowPrintModal(true);

    } catch (error) {
      console.error('Error generating factura:', error);

      // Mostrar mensaje de error apropiado
      if (error.message.includes('Stock insuficiente') || error.message.includes('ya no existe')) {
        alert(error.message);
      } else {
        alert('Error al generar factura: ' + error.message);
      }
    } finally {
      setLoading(false); // Desactivar loading
    }
  };

  // ====== PRINT MODAL (CORREGIDO) ======
  const handlePrint = () => {
    window.print();
  };

  const handleClosePrintModal = () => {
    setShowPrintModal(false);
    clearCart();
  };

  // ====== SEND EMAIL ======
  const handleOpenEmailModal = () => {
    // Pre-fill with client's email if available
    const clientEmail = clients.find(c => c.id === selectedClient?.id)?.email || '';
    setEmailRecipient(clientEmail);
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) {
      alert('Por favor ingrese un correo electrónico');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRecipient)) {
      alert('Por favor ingrese un correo electrónico válido');
      return;
    }

    setSendingEmail(true);
    try {
      const sendEmailReceipt = httpsCallable(functions, 'sendEmailReceipt');
      const result = await sendEmailReceipt({
        saleId: ventaData.id,
        toEmail: emailRecipient.trim()
      });

      // Actualizar el email del cliente en la base de datos si se ingresó manualmente
      if (selectedClient?.id) {
        try {
          const clienteActual = clients.find(c => c.id === selectedClient.id);
          // Solo actualizar si el email es diferente o no existe
          if (clienteActual && clienteActual.email !== emailRecipient.trim()) {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'clients', selectedClient.id), {
              email: emailRecipient.trim()
            });

            // Actualizar el cliente en el estado local
            setClients(prevClients =>
              prevClients.map(c =>
                c.id === selectedClient.id
                  ? { ...c, email: emailRecipient.trim() }
                  : c
              )
            );
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

  // ====== RENDER ======
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 md:px-6 py-2 md:py-3 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-gray-800">Punto de Venta</h1>
          <h2 className="hidden lg:block text-lg md:text-xl font-bold text-gray-800">Carrito</h2>
        </div>
      </div>

      {/* Mobile Tabs (visible only on mobile/tablet) */}
      <div className="lg:hidden bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('catalogo')}
            className={`flex-1 py-3 md:py-4 px-4 font-medium text-sm md:text-base transition-colors ${
              activeTab === 'catalogo'
                ? 'bg-orange-500 text-white border-b-2 border-orange-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => setActiveTab('carrito')}
            className={`flex-1 py-3 md:py-4 px-4 font-medium text-sm md:text-base transition-colors relative ${
              activeTab === 'carrito'
                ? 'bg-orange-500 text-white border-b-2 border-orange-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Carrito
            {cartItems.length > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs md:text-sm font-bold ${
                activeTab === 'carrito' ? 'bg-white text-orange-500' : 'bg-orange-500 text-white'
              }`}>
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN - CATALOG */}
        <div className={`flex-1 flex flex-col overflow-hidden p-2 md:p-3 ${
          activeTab === 'catalogo' ? 'flex' : 'hidden'
        } lg:flex`}>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-2 md:p-3 mb-2 md:mb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
              {/* Colegio Filter */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Colegio
                </label>
                <select
                  value={selectedColegio}
                  onChange={(e) => setSelectedColegio(e.target.value)}
                  className="w-full px-2 md:px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos los colegios</option>
                  {colegios.map(colegio => (
                    <option key={colegio.id} value={colegio.codigo}>
                      {colegio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo Filter */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Tipo de Uniforme
                </label>
                <div className="flex gap-1 md:gap-2">
                  {['Todos', 'Diario', 'Deportivo'].map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setSelectedTipo(tipo)}
                      className={`flex-1 px-2 md:px-3 py-2 text-xs md:text-sm rounded-md font-medium transition-colors ${
                        selectedTipo === tipo
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Filter (with autoFocus for scanner) */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  Buscar (Nombre o Referencia)
                </label>
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Escribir o escanear código..."
                  className="w-full px-2 md:px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm p-2 md:p-3 lg:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
              {filteredProducts.map(product => {
                const availableStock = calculateAvailableStock(product);
                const isOutOfStock = availableStock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                    className={`border rounded-lg p-2 md:p-3 lg:p-4 transition-all ${
                      isOutOfStock
                        ? 'bg-gray-100 cursor-not-allowed opacity-50'
                        : 'bg-white hover:shadow-md hover:border-orange-500 cursor-pointer'
                    }`}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1 text-xs md:text-sm">
                      {product.nombre}
                    </h3>
                    <p className="text-xs text-gray-500 mb-1 md:mb-2">
                      Ref: {product.referencia}
                    </p>
                    <p className="text-base md:text-lg font-bold text-orange-600 mb-1 md:mb-2">
                      ${product.precio?.toLocaleString('es-CO')}
                    </p>
                    <p className={`text-xs font-medium ${
                      isOutOfStock ? 'text-red-600' : 'text-green-600'
                    }`}>
                      Stock: {availableStock}
                    </p>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center text-gray-500 py-8 md:py-12 text-sm md:text-base">
                No se encontraron productos
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - CART & BILLING */}
        <div className={`w-full lg:w-96 bg-white border-l flex flex-col overflow-hidden ${
          activeTab === 'carrito' ? 'flex' : 'hidden'
        } lg:flex`}>
          {/* Client Selector */}
          <div className="p-2 md:p-3 border-b">
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value);
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  placeholder="Buscar cliente..."
                  className="w-full px-2 md:px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />

                {/* Client Suggestions */}
                {showClientSuggestions && clientSearchQuery && filteredClients.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredClients.slice(0, 5).map(client => (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="font-medium text-sm">{client.nombreCompleto}</div>
                        <div className="text-xs text-gray-500">{client.numeroDocumento}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowClientModal(true)}
                className="px-3 md:px-4 py-2 text-lg md:text-xl bg-orange-500 text-white rounded-md hover:bg-orange-600 font-bold"
              >
                +
              </button>
            </div>

            {selectedClient && (
              <div className="text-xs md:text-sm bg-green-50 border border-green-200 rounded-md p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{selectedClient.nombreCompleto}</div>
                  <div className="text-gray-600 text-xs truncate">{selectedClient.numeroDocumento}</div>
                </div>
                <button
                  onClick={handleRemoveClient}
                  className="text-red-600 hover:text-red-800 font-bold text-xl leading-none flex-shrink-0"
                  title="Remover cliente"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-2 md:p-3 border-b relative">
            {cartItems.length === 0 ? (
              <div className="text-center text-gray-500 py-6 text-sm md:text-base">
                Carrito vacío
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map(item => {
                  const itemTotal = item.product.precio * item.cantidad;
                  const itemDiscount = calculateItemDiscount(item);
                  const itemFinal = itemTotal - itemDiscount;

                  return (
                    <div key={item.product.id} className="border rounded-lg p-2 bg-gray-50">
                      {/* Header compacto con nombre y botón eliminar */}
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.product.nombre}</h4>
                          <p className="text-xs text-gray-500">{item.product.referencia}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="text-red-600 hover:text-red-800 font-bold ml-2 text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>

                      {/* Cantidad y precio en una línea compacta */}
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => handleQuantityChange(item.product.id, item.cantidad - 1)}
                          className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium text-sm">{item.cantidad}</span>
                        <button
                          onClick={() => handleQuantityChange(item.product.id, item.cantidad + 1)}
                          className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded font-bold text-sm"
                        >
                          +
                        </button>
                        <span className="text-xs text-gray-600">
                          ${item.product.precio.toLocaleString('es-CO')}
                        </span>
                        <span className="ml-auto text-sm font-bold text-orange-600">
                          ${itemFinal.toLocaleString('es-CO')}
                        </span>
                      </div>

                      {/* Descuento compacto */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-600">Desc:</label>
                        <input
                          type="number"
                          min="0"
                          value={item.descuento}
                          onChange={(e) => handleDiscountChange(item.product.id, e.target.value)}
                          className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                        />
                        <div className="flex border border-gray-300 rounded overflow-hidden">
                          <button
                            onClick={() => handleDiscountTypeChange(item.product.id, '%')}
                            className={`px-1.5 py-0.5 text-xs font-medium ${
                              item.tipoDescuento === '%'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white text-gray-700'
                            }`}
                          >
                            %
                          </button>
                          <button
                            onClick={() => handleDiscountTypeChange(item.product.id, '$')}
                            className={`px-1.5 py-0.5 text-xs font-medium ${
                              item.tipoDescuento === '$'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white text-gray-700'
                            }`}
                          >
                            $
                          </button>
                        </div>
                        {itemDiscount > 0 && (
                          <span className="text-xs text-red-600 ml-auto">
                            -${itemDiscount.toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Indicador visual de más contenido abajo */}
            {cartItems.length > 4 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
            )}
          </div>

          {/* Billing Summary */}
          <div className="p-2 md:p-3 border-b bg-gray-50">
            <div className="space-y-2 text-xs md:text-sm">
              {/* Contador de productos */}
              {cartItems.length > 0 && (
                <div className="bg-white rounded px-2 py-1.5 mb-2 border border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'} • {cartItems.reduce((sum, item) => sum + item.cantidad, 0)} {cartItems.reduce((sum, item) => sum + item.cantidad, 0) === 1 ? 'unidad' : 'unidades'}
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">${calculateSubtotal().toLocaleString('es-CO')}</span>
              </div>

              {calculateTotalDiscountItems() > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento por ítems:</span>
                  <span className="font-medium">-${calculateTotalDiscountItems().toLocaleString('es-CO')}</span>
                </div>
              )}

              {/* IVA Toggle */}
              <div className="flex justify-between items-center border-t pt-2">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aplicarIVA}
                      onChange={(e) => setAplicarIVA(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                  <span className="text-xs md:text-sm">IVA ({companyConfig?.iva || 19}%)</span>
                </div>
                <span className="font-medium">${calculateIVA().toLocaleString('es-CO')}</span>
              </div>

              {/* General Discount */}
              <div className="border-t pt-2">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <label className="text-xs text-gray-600 whitespace-nowrap">Descuento General:</label>
                  <input
                    type="number"
                    min="0"
                    value={descuentoGeneral}
                    onChange={(e) => setDescuentoGeneral(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                  <div className="flex border border-gray-300 rounded overflow-hidden">
                    <button
                      onClick={() => setTipoDescuentoGeneral('%')}
                      className={`px-2 py-1 text-xs font-medium ${
                        tipoDescuentoGeneral === '%'
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-gray-700'
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => setTipoDescuentoGeneral('$')}
                      className={`px-2 py-1 text-xs font-medium ${
                        tipoDescuentoGeneral === '$'
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-gray-700'
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>
                {calculateGeneralDiscount() > 0 && (
                  <div className="flex justify-between text-red-600 text-xs">
                    <span>Aplicado:</span>
                    <span className="font-medium">-${calculateGeneralDiscount().toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-base md:text-lg font-bold border-t pt-2 mt-2">
                <span>TOTAL:</span>
                <span className="text-orange-600">${calculateTotal().toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>

          {/* Payment Controls */}
          <div className="p-2 md:p-3 space-y-2">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                Método de Pago
              </label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-2 md:px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option>Efectivo</option>
                <option>Nequi</option>
                <option>Daviplata</option>
                <option>Nu</option>
                <option>Tarjeta</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={clearCart}
                className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-red-500 text-white rounded-md hover:bg-red-600 font-medium"
              >
                Limpiar
              </button>
              <button
                onClick={handleGenerateFactura}
                disabled={cartItems.length === 0 || !selectedClient}
                className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-orange-500 text-white rounded-md hover:bg-orange-600 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                style={{ backgroundColor: cartItems.length > 0 && selectedClient ? '#EA5C2E' : undefined }}
              >
                Generar Factura
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK CLIENT MODAL */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg md:text-2xl font-semibold text-gray-800">
                Crear Cliente Rápido
              </h2>
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({
                    nombreCompleto: '',
                    tipoDocumento: 'Cédula de Ciudadanía',
                    numeroDocumento: '',
                    telefono: '',
                    email: '',
                    direccion: '',
                    ciudad: '',
                    colegioId: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600 text-xl md:text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="px-4 md:px-6 py-3 md:py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Nombre Completo */}
                <div className="md:col-span-2">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.nombreCompleto}
                    onChange={(e) => setNewClientData({ ...newClientData, nombreCompleto: e.target.value })}
                    placeholder="Ej: Juan Pérez García"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newClientData.tipoDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, tipoDocumento: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Número de Documento */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Número de Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.numeroDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, numeroDocumento: e.target.value })}
                    placeholder="Ej: 123456789"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newClientData.telefono}
                    onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="Ej: cliente@ejemplo.com"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newClientData.direccion}
                    onChange={(e) => setNewClientData({ ...newClientData, direccion: e.target.value })}
                    placeholder="Ej: Calle 123 # 45-67"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={newClientData.ciudad}
                    onChange={(e) => setNewClientData({ ...newClientData, ciudad: e.target.value })}
                    placeholder="Ej: Bogotá"
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Colegio */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    Colegio (Opcional)
                  </label>
                  <select
                    value={newClientData.colegioId}
                    onChange={(e) => setNewClientData({ ...newClientData, colegioId: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Sin colegio asignado</option>
                    {colegios.map(colegio => (
                      <option key={colegio.id} value={colegio.id}>
                        {colegio.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 md:gap-3">
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setNewClientData({
                    nombreCompleto: '',
                    tipoDocumento: 'Cédula de Ciudadanía',
                    numeroDocumento: '',
                    telefono: '',
                    email: '',
                    direccion: '',
                    ciudad: '',
                    colegioId: ''
                  });
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm md:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateQuickClient}
                className="w-full sm:w-auto px-4 py-2 text-sm md:text-base bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL (CORREGIDO) */}
      {showPrintModal && ventaData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4">
          <div className="bg-white rounded-lg w-full flex flex-col" style={{ maxWidth: '400px', maxHeight: '90vh' }}>

            {/* Header - Fijo arriba */}
            <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-bold">Factura Generada</h2>
                <button
                  onClick={handleClosePrintModal}
                  className="text-gray-500 hover:text-gray-700 text-xl md:text-2xl"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Receipt Preview - Con scroll si es necesario */}
            <div className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4">
              <div className="flex justify-center">
                <div id="receipt-print" className="border p-4 bg-white" style={{ width: '300px' }}>

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
                  <span>{String(ventaData.numeroFactura).padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Fecha:</span>
                  <span>{ventaData.fecha}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cliente:</span>
                  <span className="text-right">{ventaData.clienteNombre}</span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {ventaData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="py-1">
                          <div className="font-medium">{item.nombre}</div>
                          <div className="text-gray-600 text-[10px]">
                            {item.talla && `Talla: ${item.talla} | `}
                            ${item.precioUnitario.toLocaleString('es-CO')}
                          </div>
                        </td>
                        <td className="text-center">{item.cantidad}</td>
                        <td className="text-right">${item.subtotal.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${ventaData.subtotal.toLocaleString('es-CO')}</span>
                </div>
                {ventaData.descuentoTotal > 0 && (
                   <div className="flex justify-between text-red-600">
                    <span>Descuento Total:</span>
                    <span>-${ventaData.descuentoTotal.toLocaleString('es-CO')}</span>
                  </div>
                )}
                {ventaData.ivaAplicado && (
                   <div className="flex justify-between">
                    <span>IVA ({ventaData.ivaPorcentaje}%):</span>
                    <span>${ventaData.iva.toLocaleString('es-CO')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>TOTAL PAGADO:</span>
                  <span>${ventaData.totalPagado.toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-4 text-xs border-t pt-2">
                <p>Método de Pago: {ventaData.metodoPago}</p>
                <p>¡Gracias por su compra!</p>
              </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Fijos abajo */}
            <div className="flex-shrink-0 px-3 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#EA5C2E' }}
                >
                  🖨️ Imprimir
                </button>
                <button
                  onClick={handleOpenEmailModal}
                  className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#D50565' }}
                >
                  📧 Correo
                </button>
              </div>
                <button
                  onClick={handleClosePrintModal}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-3 md:px-4">
          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-md">
            <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-gray-800">Enviar Factura por Correo</h2>

            <div className="mb-4">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico del Cliente
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                disabled={sendingEmail}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#D50565' }}
              >
                {sendingEmail ? '📤 Enviando...' : '📧 Enviar'}
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
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

export default POS;
