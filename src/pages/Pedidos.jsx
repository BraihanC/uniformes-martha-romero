import { useState, useEffect } from 'react';
import { db, functions } from '../services/firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  writeBatch,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  runTransaction,
  setDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/AuthContext';
import { Phone, Loader2 } from 'lucide-react';
import {
  calcularValorDeEntrega,
  calcularValorYaEntregado,
  calcularValorAcumuladoConHoy,
  calcularSaldoRequerido,
  calcularUpdatedItems,
  calcularEstadoGeneral,
  esItemInactivo,
} from '../utils/pedidosLogic';

const Pedidos = () => {
  const { currentUser, isAdmin } = useAuth();

  // Estados para datos
  const [allClients, setAllClients] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [allColegios, setAllColegios] = useState([]);
  const [selectedColegioId, setSelectedColegioId] = useState(''); // Para el formulario

  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [reciboDatos, setReciboDatos] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // Estados para nuevo cliente
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

  // Estados para el formulario de creación
  const [selectedClient, setSelectedClient] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [abono, setAbono] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');

  // Estados para búsqueda
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);

  // Estados para filtros de pedidos
  const [filterEstado, setFilterEstado] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Estado para búsqueda

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const pedidosPorPagina = 10;

  // Estados para gestión de pedido
  const [selectedItemsForDelivery, setSelectedItemsForDelivery] = useState([]);
  const [nuevoAbono, setNuevoAbono] = useState(0);
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState('Efectivo');
  const [showAbonoForm, setShowAbonoForm] = useState(false);

  // Estados para abonos adicionales (sin entrega)
  const [abonoAdicionalMonto, setAbonoAdicionalMonto] = useState('');
  const [abonoAdicionalMetodo, setAbonoAdicionalMetodo] = useState('Efectivo');
  const [referenciaOrigen, setReferenciaOrigen] = useState(''); // Para cruce de saldo

  // Estado para datos de la empresa
  const [companyConfig, setCompanyConfig] = useState(null);

  const [loading, setLoading] = useState(false);

  // Estados para corrección de productos en pedidos
  const [showCorreccionProductoModal, setShowCorreccionProductoModal] = useState(false);
  const [itemIndexToCorrect, setItemIndexToCorrect] = useState(null);
  const [searchProductoCorreccion, setSearchProductoCorreccion] = useState('');
  const [productoNuevoSeleccionado, setProductoNuevoSeleccionado] = useState(null);
  const [nuevaCantidadCorreccion, setNuevaCantidadCorreccion] = useState(1);
  const [notasCorreccion, setNotasCorreccion] = useState('');
  const [corrigiendoProducto, setCorrigiendoProducto] = useState(false);

  // Estados para anulación de productos en pedidos
  const [showAnularProductoModal, setShowAnularProductoModal] = useState(false);
  const [itemIndexToAnular, setItemIndexToAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulandoProducto, setAnulandoProducto] = useState(false);

  // Estados para cambio de cliente en pedidos
  const [showCambiarClienteModal, setShowCambiarClienteModal] = useState(false);
  const [searchNuevoCliente, setSearchNuevoCliente] = useState('');
  const [nuevoClienteSeleccionado, setNuevoClienteSeleccionado] = useState(null);
  const [notasCambioCliente, setNotasCambioCliente] = useState('');
  const [cambiandoCliente, setCambiandoCliente] = useState(false);

  // Estados para observaciones del pedido
  const [nuevaObservacion, setNuevaObservacion] = useState('');
  const [guardandoObservacion, setGuardandoObservacion] = useState(false);

  // Estados para cambio de método de pago de abono
  const [showCambiarMetodoPagoAbonoModal, setShowCambiarMetodoPagoAbonoModal] = useState(false);
  const [abonoIndexToEdit, setAbonoIndexToEdit] = useState(null);
  const [nuevoMetodoPagoAbono, setNuevoMetodoPagoAbono] = useState('');
  const [notasMetodoPagoAbono, setNotasMetodoPagoAbono] = useState('');
  const [cambiandoMetodoPagoAbono, setCambiandoMetodoPagoAbono] = useState(false);

  // Estados para cambio de cantidad lista
  const [showCambiarCantidadListaModal, setShowCambiarCantidadListaModal] = useState(false);
  const [itemIndexToCambiarEstado, setItemIndexToCambiarEstado] = useState(null);
  const [nuevaCantidadLista, setNuevaCantidadLista] = useState(0);
  const [notasCambioEstado, setNotasCambioEstado] = useState('');
  const [cambiandoCantidadLista, setCambiandoCantidadLista] = useState(false);

  // Estados para anular pedido completo
  const [showAnularPedidoModal, setShowAnularPedidoModal] = useState(false);
  const [motivoAnularPedido, setMotivoAnularPedido] = useState('');
  const [anulandoPedido, setAnulandoPedido] = useState(false);

  // Estados para prevenir doble clic en operaciones críticas
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [registrandoEntrega, setRegistrandoEntrega] = useState(false);
  const [registrandoAbonoAdicional, setRegistrandoAbonoAdicional] = useState(false);
  const [restaurandoProducto, setRestaurandoProducto] = useState(false);
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Estados para cambio de talla
  const [showCambiarTallaModal, setShowCambiarTallaModal] = useState(false);
  const [itemIndexToCambiarTalla, setItemIndexToCambiarTalla] = useState(null);
  const [searchNuevaTalla, setSearchNuevaTalla] = useState('');
  const [productoNuevaTalla, setProductoNuevaTalla] = useState(null);
  const [motivoCambioTalla, setMotivoCambioTalla] = useState('Cliente se probó y no le quedó');
  const [cambiandoTalla, setCambiandoTalla] = useState(false);

  // Cargar datos al iniciar
  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchPedidos();
    fetchCompanyConfig();
    fetchColegios();
  }, []);

  const fetchCompanyConfig = async () => {
    try {
      const companyDoc = await getDoc(doc(db, 'config', 'company'));
      if (companyDoc.exists()) {
        setCompanyConfig(companyDoc.data());
      }
    } catch (error) {
      console.error('Error al cargar configuración de empresa:', error);
    }
  };

  const fetchColegios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'colegios'));
      const colegiosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      colegiosData.sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar alfabéticamente
      setAllColegios(colegiosData);
    } catch (error) {
      console.error('Error al cargar colegios:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'clients'));
      const clientsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllClients(clientsData);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  // Función pura: deriva el estadoGeneral correcto a partir de los ítems del pedido.
  // No hace lecturas ni escrituras a Firestore.
  const calcularEstadoCorrectoPedido = (pedido) => {
    if (!pedido.items || pedido.items.length === 0) return pedido.estadoGeneral;

    // Excluir ítems anulados y registros de cambio de talla (no son entregables)
    const itemsActivos = pedido.items.filter(
      item => !item.anulado && item.estadoItem !== 'Cambio de Talla'
    );
    if (itemsActivos.length === 0) return pedido.estadoGeneral;

    const todosEntregados = itemsActivos.every(item => item.estadoItem === 'Entregado');
    const anyInProduction = itemsActivos.some(item => item.estadoItem === 'En Producción');
    const allReadyOrDelivered = itemsActivos.every(
      item => item.estadoItem === 'Listo para Entrega' ||
              item.estadoItem === 'Entregado' ||
              item.estadoItem === 'Parcialmente Listo'
    );

    if (todosEntregados) return 'Entregado';
    if (anyInProduction) return 'En Proceso';
    if (allReadyOrDelivered) return 'Pedido Completo - Listo para Recoger';
    return pedido.estadoGeneral;
  };

  // Persiste correcciones de estado a Firestore sin re-fetch.
  // Solo se llama una vez por sesión de navegador.
  const persistirCorreccionesEstados = async (pedidosACorregir) => {
    try {
      const batch = writeBatch(db);
      for (const pedido of pedidosACorregir) {
        batch.update(doc(db, 'pedidos', pedido.id), {
          estadoGeneral: pedido.estadoGeneral,
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      console.log(`📊 ${pedidosACorregir.length} estado(s) de pedido sincronizados con Firestore`);
    } catch (error) {
      console.error('Error al persistir correcciones de estado:', error);
    }
  };

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'pedidos'));
      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      pedidosData.sort((a, b) => (b.numeroPedido || 0) - (a.numeroPedido || 0));

      // Corregir estados usando los datos ya cargados (sin viajes extra a Firestore)
      const pedidosCorregidos = pedidosData.map(pedido => {
        const estadoCorrecto = calcularEstadoCorrectoPedido(pedido);
        return estadoCorrecto !== pedido.estadoGeneral
          ? { ...pedido, estadoGeneral: estadoCorrecto }
          : pedido;
      });

      setPedidos(pedidosCorregidos);

      // Persistir correcciones a Firestore solo una vez por sesión de navegador.
      // Evita N escrituras innecesarias en cada carga posterior.
      const SESSION_KEY = 'pedidos_estados_sincronizados';
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        const conDiscrepancias = pedidosCorregidos.filter((p, i) =>
          p.estadoGeneral !== pedidosData[i].estadoGeneral
        );
        if (conDiscrepancias.length > 0) {
          await persistirCorreccionesEstados(conDiscrepancias);
        }
      }
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda de clientes en tiempo real
  useEffect(() => {
    if (!clientSearchTerm.trim()) {
      setClientSearchResults([]);
      return;
    }

    const searchLower = clientSearchTerm.toLowerCase();
    const filtered = allClients.filter(client => {
      const nombreMatch = client.nombreCompleto?.toLowerCase().includes(searchLower);
      const documentoMatch = client.numeroDocumento?.toLowerCase().includes(searchLower);
      return nombreMatch || documentoMatch;
    });

    setClientSearchResults(filtered);
  }, [clientSearchTerm, allClients]);

  // Función para ordenar productos por talla
  const ordenarPorTalla = (productos) => {
    const ordenTallas = {
      '4': 1, '6': 2, '8': 3, '10': 4, '12': 5, '14': 6, '16': 7,
      'S': 8, 'M': 9, 'L': 10, 'XL': 11, 'XXL': 12,
      'SX': 8, 'XS': 8
    };

    return [...productos].sort((a, b) => {
      const tallaA = (a.talla || '').toUpperCase().trim();
      const tallaB = (b.talla || '').toUpperCase().trim();

      const ordenA = ordenTallas[tallaA] || 999;
      const ordenB = ordenTallas[tallaB] || 999;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      // Si tienen el mismo orden, ordenar alfabéticamente
      return tallaA.localeCompare(tallaB);
    });
  };

  // Búsqueda de productos en tiempo real
  useEffect(() => {
    if (!productSearchTerm.trim()) {
      setProductSearchResults([]);
      return;
    }

    const searchLower = productSearchTerm.toLowerCase();
    let filtered = allProducts.filter(product => {
      const nombreMatch = product.nombre?.toLowerCase().includes(searchLower);
      const referenciaMatch = product.referencia?.toLowerCase().includes(searchLower);
      const textMatch = nombreMatch || referenciaMatch;

      // Si hay un colegio seleccionado, filtrar por colegio
      if (selectedColegioId && selectedColegioId !== 'GENERAL') {
        // Buscar el colegio seleccionado en la lista de colegios para obtener su código
        const colegioSeleccionado = allColegios.find(c => c.id === selectedColegioId);
        const codigoColegio = colegioSeleccionado?.codigo || selectedColegioId;

        // Comparar el código del colegio con el campo colegio del producto
        // También incluir productos OT (Otras) que aplican para todos los colegios
        const colegioMatch = product.colegio === codigoColegio || product.colegio === 'OT';
        return textMatch && colegioMatch;
      }

      return textMatch;
    });

    // Ordenar por talla
    filtered = ordenarPorTalla(filtered);

    setProductSearchResults(filtered);
  }, [productSearchTerm, allProducts, selectedColegioId, allColegios]);

  // Funciones para el formulario de creación
  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearchTerm('');
    setClientSearchResults([]);
  };

  const handleCreateClient = async () => {
    // Validar campos requeridos
    if (!newClientData.nombreCompleto.trim()) {
      alert('Por favor, ingresa el nombre completo del cliente.');
      return;
    }
    if (!newClientData.numeroDocumento.trim()) {
      alert('Por favor, ingresa el número de documento del cliente.');
      return;
    }

    // Prevenir doble clic
    if (creandoCliente) return;
    setCreandoCliente(true);

    setLoading(true);
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
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'clients'), newClient);
      const clientWithId = { id: docRef.id, ...newClient };

      // Actualizar lista de clientes
      setAllClients([...allClients, clientWithId]);

      // Seleccionar el cliente recién creado
      setSelectedClient(clientWithId);
      setClientSearchTerm(clientWithId.nombreCompleto);

      // Cerrar modal y limpiar formulario
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

      alert('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error al crear cliente:', error);
      alert('Error al crear el cliente. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
      setCreandoCliente(false);
    }
  };

  const handleAddProduct = (product) => {
    const exists = cartItems.find(item => item.product.id === product.id);
    if (exists) {
      alert('Este producto ya está en el carrito.');
      return;
    }

    const newItem = {
      product: product,
      cantidad: 1,
      precio: product.precio || 0
    };

    setCartItems([...cartItems, newItem]);
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  const handleUpdateQuantity = (index, cantidad) => {
    const updated = [...cartItems];
    updated[index].cantidad = Number(cantidad);
    setCartItems(updated);
  };

  const handleUpdatePrice = (index, precio) => {
    const updated = [...cartItems];
    updated[index].precio = Number(precio);
    setCartItems(updated);
  };

  const handleRemoveFromCart = (index) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  };

  const calculateSaldoPendiente = () => {
    return calculateTotal() - (Number(abono) || 0);
  };

  // Guardar pedido (PARTE 2)
  const handleSavePedido = async (e) => {
    e.preventDefault();

    if (!selectedClient) {
      alert('Por favor, selecciona un cliente.');
      return;
    }

    if (cartItems.length === 0) {
      alert('Por favor, añade al menos un producto al pedido.');
      return;
    }

    if (!selectedColegioId) {
      alert('Por favor, selecciona un colegio.');
      return;
    }

    // Prevenir doble clic
    if (guardandoPedido) return;
    setGuardandoPedido(true);

    setLoading(true);
    try {
      // PRIMERO: Verificar si necesitamos inicializar el contador (FUERA de la transacción)
      let initialCounterValue = null;
      const counterRefCheck = doc(db, 'counters', 'pedidos');
      const counterCheckSnap = await getDoc(counterRefCheck);

      if (!counterCheckSnap.exists()) {
        // Si no existe el contador, buscar el último pedido para inicializarlo
        const q = query(collection(db, 'pedidos'), orderBy('numeroPedido', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        initialCounterValue = snapshot.empty ? 0 : (snapshot.docs[0].data().numeroPedido || 0);
      }

      // LUEGO: Obtener el número de pedido usando contador atómico
      const counterRef = doc(db, 'counters', 'pedidos');
      const nextNumero = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newNumber;

        if (!counterDoc.exists()) {
          // Usar el valor inicial obtenido ANTES de la transacción
          newNumber = (initialCounterValue || 0) + 1;
          transaction.set(counterRef, { lastNumber: newNumber });
        } else {
          // Incrementar el contador existente
          const currentNumber = counterDoc.data().lastNumber || 0;
          newNumber = currentNumber + 1;
          transaction.update(counterRef, { lastNumber: newNumber });
        }

        return newNumber;
      });

      const batch = writeBatch(db);

      // Formatear items con estado inicial
      const fechaSolicitudInicial = new Date().toISOString();
      const itemsConEstado = cartItems.map(item => ({
        productoId: item.product.id,
        referencia: item.product.referencia,
        nombre: item.product.nombre,
        talla: item.product.talla,
        cantidad: item.cantidad,
        precio: item.precio,
        subtotal: item.cantidad * item.precio,
        estadoItem: 'En Producción', // Estado inicial
        fechaSolicitud: fechaSolicitudInicial // Fecha de solicitud para reporte de corte
      }));

      const totalPedido = calculateTotal();
      const abonoInicial = Number(abono) || 0;

      // Busca el colegio seleccionado
      const selectedColegio = allColegios.find(c => c.id === selectedColegioId);
      const colegioNombre = selectedColegio ? selectedColegio.nombre : 'General (Sin Colegio)';

      // Paso A: Crear el pedido
      const pedidoRef = doc(collection(db, 'pedidos'));
      const pedidoData = {
        numeroPedido: nextNumero,
        clienteId: selectedClient.id,
        clienteNombre: selectedClient.nombreCompleto,
        clienteDocumento: selectedClient.numeroDocumento,
        colegioId: selectedColegioId,
        colegioNombre: colegioNombre,
        items: itemsConEstado,
        total: totalPedido,
        totalAbonado: abonoInicial,
        saldoPendiente: totalPedido - abonoInicial,
        abonos: abonoInicial > 0 ? [{
          monto: abonoInicial,
          metodoPago: metodoPago,
          ...(metodoPago === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
          fecha: new Date().toISOString()
        }] : [],
        observaciones: observaciones.trim(),
        estadoGeneral: 'En Proceso',
        createdAt: serverTimestamp(),
        userId: currentUser.uid
      };

      batch.set(pedidoRef, pedidoData);

      // Paso B: Incrementar total de prendas pedidas (NO actualizar stockTotal porque las prendas no existen aún)
      // Incrementar totalPrendasPedidas para que corte/producción sepa cuántas prendas están en pedidos
      for (const item of cartItems) {
        if (item.product && item.product.id) {
          const productRef = doc(db, 'products', item.product.id);
          batch.set(productRef, {
            totalPrendasPedidas: increment(item.cantidad),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      // 5. (NUEVO) Registrar Transacción de Abono Inicial (si existe)
      if (abonoInicial > 0) {
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'abono_pedido',
          monto: abonoInicial,
          metodoPago: metodoPago,
          ...(metodoPago === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
          pedidoId: pedidoRef.id,
          descripcion: `Abono inicial Pedido #${nextNumero}`,
          clienteId: selectedClient.id,
          clienteNombre: selectedClient.nombreCompleto,
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      // Paso C: Commit
      await batch.commit();

      alert(`¡Pedido #${nextNumero} creado correctamente!`);

      // Guardar datos para la tirilla
      setReciboDatos({
        pedidoId: pedidoRef.id,
        numeroPedido: nextNumero,
        clienteNombre: selectedClient.nombreCompleto,
        clienteId: selectedClient.id,
        colegioNombre: colegioNombre,
        items: itemsConEstado,
        total: totalPedido,
        abono: abonoInicial,
        saldo: totalPedido - abonoInicial,
        fecha: new Date().toLocaleDateString('es-CO'),
        observaciones: observaciones.trim()
      });

      // Limpiar formulario
      handleCancelCreateForm();
      fetchPedidos();
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert('Error al crear el pedido. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setGuardandoPedido(false);
    }
  };

  const handleCancelCreateForm = () => {
    setShowCreateModal(false);
    setSelectedClient(null);
    setCartItems([]);
    setObservaciones('');
    setAbono(0);
    setMetodoPago('Efectivo');
    setReferenciaOrigen('');
    setSelectedColegioId('');
    setClientSearchTerm('');
    setProductSearchTerm('');
    setClientSearchResults([]);
    setProductSearchResults([]);
  };


  // Abrir modal de gestión (PARTE 3)
  const handleOpenManagePedido = async (pedidoId) => {
    setLoading(true);
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      const pedidoSnap = await getDoc(pedidoRef);

      if (pedidoSnap.exists()) {
        setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
        setShowManageModal(true);
        setSelectedItemsForDelivery([]);
        setNuevoAbono(0);
        setShowAbonoForm(false);
        setAbonoAdicionalMonto(0);
        setAbonoAdicionalMetodo('Efectivo');
        setReferenciaOrigen('');
      }
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      alert('Error al cargar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  // Nueva función para manejar el cambio de estado con el <select>
  const handleUpdateItemEstado = async (itemIndex, nuevoEstado) => {
    if (!selectedPedido) return;

    const item = selectedPedido.items[itemIndex];
    const estadoAnterior = item.estadoItem;

    // Evitar cambios si el estado ya es el mismo
    if (estadoAnterior === nuevoEstado) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // 1. Actualizar el estado del item específico
      const updatedItems = [...selectedPedido.items];

      // Calcular cantidadLista según el nuevo estado
      const cantidadTotal = item.cantidad;
      const cantidadEntregada = item.cantidadEntregada || 0;
      let nuevaCantidadLista = item.cantidadLista || 0;

      // Si cambia a "Listo para Entrega", toda la cantidad pendiente está lista
      if (nuevoEstado === 'Listo para Entrega') {
        nuevaCantidadLista = cantidadTotal - cantidadEntregada;
      }
      // Si cambia a "En Producción", no hay nada listo
      else if (nuevoEstado === 'En Producción') {
        nuevaCantidadLista = 0;
      }
      // Si cambia a "Parcialmente Listo", mantener el valor actual o usar la mitad como default
      else if (nuevoEstado === 'Parcialmente Listo' && nuevaCantidadLista === 0) {
        nuevaCantidadLista = Math.floor(cantidadTotal / 2) || 1;
      }

      // Actualizar el item con estado y cantidadLista
      updatedItems[itemIndex] = {
        ...item,
        estadoItem: nuevoEstado,
        cantidadLista: nuevaCantidadLista
      };

      // 2. Actualizar inventario según el cambio de estado
      const productoRef = doc(db, 'products', item.productoId);
      const cantidadListaAnterior = item.cantidadLista || 0;
      const diferenciaCantidadLista = nuevaCantidadLista - cantidadListaAnterior;

      // Si cambia de "En Producción" a "Listo para Entrega"
      if (estadoAnterior === 'En Producción' && nuevoEstado === 'Listo para Entrega') {
        // Cambio MANUAL: asume que se usa stock existente
        // Solo reserva el stock, NO incrementa stockTotal
        // Reservar solo la cantidad pendiente (total - ya entregada)
        batch.update(productoRef, {
          stockReservadoPedidos: increment(nuevaCantidadLista),
          updatedAt: serverTimestamp()
        });
      }
      // Si cambia de "Listo para Entrega" a "En Producción" (poco común pero posible)
      else if (estadoAnterior === 'Listo para Entrega' && nuevoEstado === 'En Producción') {
        // Reversa del cambio manual: libera la reserva
        batch.update(productoRef, {
          stockReservadoPedidos: increment(-cantidadListaAnterior),
          updatedAt: serverTimestamp()
        });
      }
      // Otros cambios que afectan la reserva (ej: Parcialmente Listo)
      else if (diferenciaCantidadLista !== 0) {
        batch.update(productoRef, {
          stockReservadoPedidos: increment(diferenciaCantidadLista),
          updatedAt: serverTimestamp()
        });
      }

      // 3. Recalcular el estado general del pedido (excluyendo items anulados)
      const anyInProduction = updatedItems.some(item =>
        !item.anulado && item.estadoItem === 'En Producción'
      );

      // Considera 'Listo' o 'Entregado' como completos para esta lógica
      const allItemsReadyOrDelivered = updatedItems.every(
        item => item.anulado || item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Entregado'
      );

      let nuevoEstadoGeneral;
      if (anyInProduction) {
        nuevoEstadoGeneral = 'En Proceso';
      } else if (allItemsReadyOrDelivered) {
        nuevoEstadoGeneral = 'Pedido Completo - Listo para Recoger';
      } else {
        // Esto cubre casos mixtos, ej: 1 'Listo', 1 'Entregado', pero 0 'En Producción'
        nuevoEstadoGeneral = selectedPedido.estadoGeneral;
      }

      // Si todos están entregados, el estado general será 'Entregado'
      const todosEntregados = updatedItems.every(item =>
        item.anulado || item.estadoItem === 'Entregado'
      );
      if (todosEntregados) {
        nuevoEstadoGeneral = 'Entregado';
      }

      // 4. Actualizar el pedido en la base de datos
      batch.update(pedidoRef, {
        items: updatedItems,
        estadoGeneral: nuevoEstadoGeneral,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      // 5. Recargar el estado local
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });

      // 6. Refrescar la lista principal de pedidos
      fetchPedidos();

    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado.');
    } finally {
      setLoading(false);
    }
  };

  // Sub-Módulo 2: Toggle selección de item para entrega
  const handleToggleItemForDelivery = (itemIndex) => {
    if (selectedItemsForDelivery.includes(itemIndex)) {
      setSelectedItemsForDelivery(selectedItemsForDelivery.filter(i => i !== itemIndex));
    } else {
      setSelectedItemsForDelivery([...selectedItemsForDelivery, itemIndex]);
    }
  };

  // Sub-Módulo 2: Registrar Entrega Parcial (PARTE 3)
  const handleRegistrarEntregaParcial = async () => {
    if (!selectedPedido || selectedItemsForDelivery.length === 0) {
      alert('Por favor, selecciona al menos un ítem para entregar.');
      return;
    }

    // Prevenir doble clic
    if (registrandoEntrega) return;
    setRegistrandoEntrega(true);

    // Paso A: Calcular valor de entrega de hoy
    const valorDeEntrega = calcularValorDeEntrega(selectedPedido.items, selectedItemsForDelivery);
    const valorYaEntregado = calcularValorYaEntregado(selectedPedido.items, selectedItemsForDelivery);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, selectedPedido.total);

    // Paso B y C: Validar abono
    const totalAbonado = selectedPedido.totalAbonado || 0;

    if (totalAbonado < valorAcumuladoConHoy) {
      const saldoAPagar = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);
      alert(`⚠️ El abono actual no cubre el valor de entrega.\n\nTotal del pedido: $${selectedPedido.total.toLocaleString('es-CO')}\nTotal abonado: $${totalAbonado.toLocaleString('es-CO')}\n\nValor de entrega hoy: $${valorDeEntrega.toLocaleString('es-CO')}\nDebe pagar hoy: $${saldoAPagar.toLocaleString('es-CO')}`);
      setShowAbonoForm(true);
      setRegistrandoEntrega(false);
      return;
    }

    // Si todo está OK, proceder con la entrega
    await confirmarEntrega();
  };

  const confirmarEntrega = async () => {
    if (!selectedPedido) return;

    // Prevenir doble clic
    if (registrandoEntrega) return;
    setRegistrandoEntrega(true);

    // Calcular valor de entrega de hoy
    const valorDeEntrega = calcularValorDeEntrega(selectedPedido.items, selectedItemsForDelivery);
    const valorYaEntregado = calcularValorYaEntregado(selectedPedido.items, selectedItemsForDelivery);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, selectedPedido.total);

    const abonoNuevo = Number(nuevoAbono) || 0;
    const totalAbonado = selectedPedido.totalAbonado || 0;

    // VALIDACIÓN: Si se mostró formulario de abono, el cliente necesita cubrir
    // el acumulado (lo ya entregado + lo de hoy) con lo que ha pagado total.
    // Nota: showAbonoForm puede quedar true de un intento anterior; solo bloquear
    // si realmente hay saldo pendiente (saldoRequerido > 0).
    if (showAbonoForm) {
      const saldoRequerido = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

      if (saldoRequerido > 0 && abonoNuevo <= 0) {
        alert(
          `⚠️ ABONO REQUERIDO\n\n` +
          `Total del pedido: $${selectedPedido.total.toLocaleString('es-CO')}\n` +
          `Total abonado: $${totalAbonado.toLocaleString('es-CO')}\n\n` +
          `Valor de entrega hoy: $${valorDeEntrega.toLocaleString('es-CO')}\n` +
          `Debe pagar hoy mínimo: $${saldoRequerido.toLocaleString('es-CO')}\n\n` +
          `No se puede entregar sin recibir el pago.`
        );
        setRegistrandoEntrega(false);
        return;
      }

      if (saldoRequerido > 0 && abonoNuevo < saldoRequerido) {
        const faltante = saldoRequerido - abonoNuevo;
        alert(
          `⚠️ ABONO INSUFICIENTE\n\n` +
          `Total del pedido: $${selectedPedido.total.toLocaleString('es-CO')}\n` +
          `Abonado previamente: $${totalAbonado.toLocaleString('es-CO')}\n\n` +
          `Valor de entrega hoy: $${valorDeEntrega.toLocaleString('es-CO')}\n` +
          `Debe pagar hoy: $${saldoRequerido.toLocaleString('es-CO')}\n\n` +
          `Abono ingresado: $${abonoNuevo.toLocaleString('es-CO')}\n` +
          `Falta: $${faltante.toLocaleString('es-CO')}\n\n` +
          `El cliente debe completar el pago para poder llevarse los productos.`
        );
        setRegistrandoEntrega(false);
        return;
      }
    }

    setLoading(true);
    try {
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      const nuevoTotalAbonado = totalAbonado + abonoNuevo;
      const nuevoSaldoPendiente = selectedPedido.total - nuevoTotalAbonado;

      // Calcular items actualizados a partir del estado local (para preparar el payload)
      const updatedItems = calcularUpdatedItems(selectedPedido.items, selectedItemsForDelivery);

      // Actualizar abonos si hay nuevo abono
      const updatedAbonos = (selectedPedido.abonos || []).map(a => {
        const limpio = { ...a };
        Object.keys(limpio).forEach(k => limpio[k] === undefined && delete limpio[k]);
        return limpio;
      });
      if (abonoNuevo > 0) {
        updatedAbonos.push({
          monto: abonoNuevo,
          metodoPago: nuevoMetodoPago,
          ...(nuevoMetodoPago === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
          fecha: new Date().toISOString()
        });
      }

      // Calcular estado general del pedido
      const todosEntregados = updatedItems.every(item => esItemInactivo(item) || item.estadoItem === 'Entregado');
      const nuevoEstadoGeneral = calcularEstadoGeneral(updatedItems, selectedPedido.estadoGeneral);

      // FASE 1: Verificar existencia de productos FUERA de la transacción
      // (necesario para poder mostrar window.confirm al usuario)
      const productosNoEncontrados = [];
      const productosConReservaInsuficiente = [];
      const productRefsAEntregar = []; // { productRef, cantidadAEntregar }

      for (const index of selectedItemsForDelivery) {
        const item = selectedPedido.items[index];
        if (item.anulado) continue;

        const esParcial = item.estadoItem === 'Parcialmente Listo';
        const cantidadAEntregar = esParcial ? (item.cantidadLista || 0) : item.cantidad;

        if (!item.productoId) {
          productosNoEncontrados.push({
            nombre: item.productoNombre || item.nombre || '(sin nombre)',
            ref: item.productoRef || item.referencia || '?',
            talla: item.talla || '?'
          });
          continue;
        }

        const productRef = doc(db, 'products', item.productoId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          productosNoEncontrados.push({
            nombre: item.productoNombre || item.nombre || '(sin nombre)',
            ref: item.productoRef || item.referencia || '?',
            talla: item.talla || '?'
          });
        } else {
          const reservaActual = productSnap.data().stockReservadoPedidos || 0;
          if (reservaActual < cantidadAEntregar) {
            productosConReservaInsuficiente.push({
              nombre: item.productoNombre || item.nombre || '(sin nombre)',
              ref: item.productoRef || item.referencia || item.ref || '?',
              talla: item.talla || '?',
              reserva: reservaActual,
              necesita: cantidadAEntregar
            });
          }
          productRefsAEntregar.push({ productRef, cantidadAEntregar });
        }
      }

      if (productosNoEncontrados.length > 0) {
        const listaProductos = productosNoEncontrados
          .map(p => `- ${p.nombre} (Ref: ${p.ref}, Talla: ${p.talla})`)
          .join('\n');

        const continuar = window.confirm(
          `⚠️ ADVERTENCIA: Los siguientes productos ya no existen en el inventario:\n\n${listaProductos}\n\n` +
          `El pedido se facturará correctamente, pero no se ajustará el inventario de estos productos.\n\n` +
          `¿Deseas continuar?`
        );

        if (!continuar) {
          setLoading(false);
          setRegistrandoEntrega(false);
          return;
        }
      }

      if (productosConReservaInsuficiente.length > 0) {
        const listaReserva = productosConReservaInsuficiente
          .map(p => `- ${p.nombre} (Ref: ${p.ref}, Talla: ${p.talla}) — Reserva: ${p.reserva}, Necesita: ${p.necesita}`)
          .join('\n');

        const continuar = window.confirm(
          `⚠️ ADVERTENCIA DE STOCK RESERVADO\n\n` +
          `Los siguientes productos tienen menos unidades apartadas de las que se van a entregar:\n\n${listaReserva}\n\n` +
          `Esto puede indicar un error en el inventario. El pedido se entregará de todas formas.\n\n` +
          `¿Deseas continuar?`
        );

        if (!continuar) {
          setLoading(false);
          setRegistrandoEntrega(false);
          return;
        }
      }

      // FASE 2: Transacción atómica — previene race conditions si dos operadores
      // actúan sobre el mismo pedido o producto al mismo tiempo
      const transactionDocRef = abonoNuevo > 0 ? doc(collection(db, 'transactions')) : null;

      await runTransaction(db, async (transaction) => {
        // ── FASE READS: todos los gets primero ──────────────────────────────
        const pedidoDoc = await transaction.get(pedidoRef);
        if (!pedidoDoc.exists()) {
          throw new Error('El pedido ya no existe en la base de datos.');
        }

        const productDocsLeidos = [];
        for (const { productRef, cantidadAEntregar } of productRefsAEntregar) {
          const productDoc = await transaction.get(productRef);
          productDocsLeidos.push({ productDoc, productRef, cantidadAEntregar });
        }

        // ── VALIDACIONES (sin I/O) ───────────────────────────────────────────
        const pedidoFresco = pedidoDoc.data();
        for (const index of selectedItemsForDelivery) {
          const itemFresco = (pedidoFresco.items || [])[index];
          if (!itemFresco) continue;
          if (itemFresco.estadoItem === 'Entregado') {
            throw new Error(
              `El ítem "${itemFresco.nombre || ''}" (Talla ${itemFresco.talla || ''}) ya fue entregado por otro usuario. Recarga la página e inténtalo de nuevo.`
            );
          }
        }

        // ── FASE WRITES: todos los updates al final ──────────────────────────
        for (const { productDoc, productRef, cantidadAEntregar } of productDocsLeidos) {
          if (!productDoc.exists()) continue;
          transaction.update(productRef, {
            stockTotal: increment(-cantidadAEntregar),
            stockReservadoPedidos: increment(-cantidadAEntregar),
            totalPrendasPedidas: increment(-cantidadAEntregar),
            updatedAt: serverTimestamp()
          });
        }

        transaction.update(pedidoRef, {
          items: updatedItems,
          totalAbonado: nuevoTotalAbonado,
          saldoPendiente: nuevoSaldoPendiente,
          abonos: updatedAbonos,
          estadoGeneral: nuevoEstadoGeneral,
          updatedAt: serverTimestamp()
        });

        if (abonoNuevo > 0 && transactionDocRef) {
          transaction.set(transactionDocRef, {
            tipo: 'abono_pedido',
            monto: abonoNuevo,
            metodoPago: nuevoMetodoPago,
            ...(nuevoMetodoPago === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
            pedidoId: pedidoRef.id,
            descripcion: `Abono en entrega Pedido #${selectedPedido.numeroPedido}`,
            clienteId: selectedPedido.clienteId,
            clienteNombre: selectedPedido.clienteNombre,
            fecha: serverTimestamp(),
            userId: currentUser.uid
          });
        }
      });

      // 5. Si todos los items están entregados, generar factura automáticamente
      let numeroFactura = null;
      if (todosEntregados) {
        // ⚠️ VALIDACIÓN CRÍTICA: No facturar si hay saldo pendiente
        // El cliente DEBE pagar el total del pedido antes de poder facturar
        if (nuevoSaldoPendiente > 0) {
          alert(
            `⚠️ NO SE PUEDE FACTURAR CON SALDO PENDIENTE\n\n` +
            `Total del pedido: $${selectedPedido.total.toLocaleString('es-CO')}\n` +
            `Total abonado: $${nuevoTotalAbonado.toLocaleString('es-CO')}\n` +
            `Saldo pendiente: $${nuevoSaldoPendiente.toLocaleString('es-CO')}\n\n` +
            `El cliente debe pagar el TOTAL antes de facturar.\n\n` +
            `Opciones:\n` +
            `1. Si el cliente va a pagar ahora, cancela esta operación y registra primero el abono.\n` +
            `2. Si el cliente pagará después, usa "Registrar Abono Adicional" cuando pague y luego entrega los productos.`
          );
          setLoading(false);
          setRegistrandoEntrega(false);
          return;
        }

        try {
          // PRIMERO: Verificar si necesitamos inicializar el contador (FUERA de la transacción)
          let initialCounterValue = null;
          const counterRefCheck = doc(db, 'counters', 'facturas');
          const counterCheckSnap = await getDoc(counterRefCheck);

          if (!counterCheckSnap.exists()) {
            // Si no existe el contador, buscar la última factura para inicializarlo
            const q = query(collection(db, 'sales'), orderBy('numeroFactura', 'desc'), limit(1));
            const snapshot = await getDocs(q);
            initialCounterValue = snapshot.empty ? 0 : (snapshot.docs[0].data().numeroFactura || 0);
          }

          // LUEGO: Obtener número de factura consecutivo usando transacción atómica
          const counterRef = doc(db, 'counters', 'facturas');
          numeroFactura = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let newNumber;

            if (!counterDoc.exists()) {
              // Usar el valor inicial obtenido ANTES de la transacción
              newNumber = (initialCounterValue || 0) + 1;
              transaction.set(counterRef, { lastNumber: newNumber });
            } else {
              // Incrementar el contador existente
              const currentNumber = counterDoc.data().lastNumber || 0;
              newNumber = currentNumber + 1;
              transaction.update(counterRef, { lastNumber: newNumber });
            }

            return newNumber;
          });

          // Obtener IDs de las transacciones de abono de este pedido
          const transQuery = query(
            collection(db, 'transactions'),
            where('pedidoId', '==', pedidoRef.id),
            where('tipo', '==', 'abono_pedido')
          );
          const transSnap = await getDocs(transQuery);
          const transaccionesIds = transSnap.docs.map(doc => doc.id);

          // Crear factura en collection 'sales'
          const facturaData = {
            numeroFactura: numeroFactura,
            tipo: 'pedido', // Distinguir de ventas del POS
            pedidoId: pedidoRef.id,
            numeroPedido: selectedPedido.numeroPedido,
            clienteId: selectedPedido.clienteId,
            clienteNombre: selectedPedido.clienteNombre,
            clienteDocumento: selectedPedido.clienteDocumento || '',
            items: updatedItems
              .filter(item => !item.anulado && item.estadoItem !== 'Cambio de Talla')
              .map(item => {
                const itemLimpio = { ...item, precioUnitario: item.precioUnitario || item.precio || 0, subtotal: item.subtotal || (item.cantidad * (item.precioUnitario || item.precio || 0)) };
                // Firestore rechaza valores undefined — eliminarlos
                Object.keys(itemLimpio).forEach(k => itemLimpio[k] === undefined && delete itemLimpio[k]);
                return itemLimpio;
              }),
            subtotal: selectedPedido.total,
            total: selectedPedido.total,
            totalAbonado: nuevoTotalAbonado,
            saldoPendiente: nuevoSaldoPendiente,
            abonos: updatedAbonos,
            transaccionesIds: transaccionesIds, // Referencias a transacciones existentes
            yaRegistradoEnCaja: true, // Importante: ya fue registrado en abonos
            metodoPago: 'Abonos',
            fecha: serverTimestamp(),
            userId: currentUser.uid,
            ...(selectedPedido.colegioId != null ? { colegioId: selectedPedido.colegioId } : {}),
            ...(selectedPedido.colegioNombre != null ? { colegioNombre: selectedPedido.colegioNombre } : {})
          };

          await addDoc(collection(db, 'sales'), facturaData);

          // Actualizar pedido con el número de factura
          await updateDoc(pedidoRef, {
            facturado: true,
            numeroFactura: numeroFactura,
            fechaFacturacion: serverTimestamp()
          });

        } catch (error) {
          console.error('Error al generar factura:', error);
          alert(`⚠️ La entrega se completó pero hubo un error al generar la factura: ${error.message || error}`);
        }
      }

      let mensaje = '✅ Entrega registrada correctamente.';
      if (numeroFactura) {
        mensaje += `\n\n🧾 Factura #${numeroFactura} generada automáticamente.`;
        mensaje += `\n\nPuedes buscar esta factura en el módulo de Devoluciones/Cambios si el cliente necesita hacer un cambio posteriormente.`;
      }
      alert(mensaje);

      // Recargar
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      setSelectedItemsForDelivery([]);
      setNuevoAbono(0);
      setNuevoMetodoPago('Efectivo');
      setReferenciaOrigen('');
      setShowAbonoForm(false);
      fetchPedidos();
    } catch (error) {
      console.error('Error al registrar entrega:', error);
      alert(`Error al registrar la entrega: ${error.message || error}`);
    } finally {
      setLoading(false);
      setRegistrandoEntrega(false);
    }
  };

  // Registrar Abono Adicional (sin entrega de productos)
  const handleRegistrarAbonoAdicional = async (e) => {
    e.preventDefault();

    if (!selectedPedido) return;

    const monto = Number(abonoAdicionalMonto);
    if (monto <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    // Prevenir doble clic
    if (registrandoAbonoAdicional) return;
    setRegistrandoAbonoAdicional(true);

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      const nuevoTotalAbonado = (selectedPedido.totalAbonado || 0) + monto;
      const nuevoSaldoPendiente = selectedPedido.total - nuevoTotalAbonado;

      // 1. Preparar lista de abonos actualizada
      const updatedAbonos = [...(selectedPedido.abonos || [])];
      updatedAbonos.push({
        monto: monto,
        metodoPago: abonoAdicionalMetodo,
        ...(abonoAdicionalMetodo === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
        fecha: new Date().toISOString()
      });

      // 2. Actualizar el Pedido en el Batch
      batch.update(pedidoRef, {
        totalAbonado: nuevoTotalAbonado,
        saldoPendiente: nuevoSaldoPendiente,
        abonos: updatedAbonos,
        updatedAt: serverTimestamp()
      });

      // 3. (NUEVO) Registrar la Transacción en el Batch
      const transactionRef = doc(collection(db, 'transactions'));
      batch.set(transactionRef, {
        tipo: 'abono_pedido',
        monto: monto,
        metodoPago: abonoAdicionalMetodo,
        ...(abonoAdicionalMetodo === 'Cruce de saldo' && referenciaOrigen.trim() ? { referenciaOrigen: referenciaOrigen.trim() } : {}),
        pedidoId: selectedPedido.id,
        descripcion: `Abono adicional Pedido #${selectedPedido.numeroPedido}`,
        clienteId: selectedPedido.clienteId,
        clienteNombre: selectedPedido.clienteNombre,
        fecha: serverTimestamp(),
        userId: currentUser.uid
      });

      // 4. Commit atómico
      await batch.commit();

      alert('¡Abono registrado correctamente!');

      // Recargar el pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      setAbonoAdicionalMonto(0);
      setAbonoAdicionalMetodo('Efectivo');
      setReferenciaOrigen('');
      fetchPedidos();

    } catch (error) {
      console.error('Error al registrar abono:', error);
      alert('Error al registrar el abono. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setRegistrandoAbonoAdicional(false);
    }
  };

  // Funciones para corrección de productos en pedidos
  const handleOpenCorreccionProducto = (itemIndex) => {
    setItemIndexToCorrect(itemIndex);
    setShowCorreccionProductoModal(true);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNuevaCantidadCorreccion(selectedPedido.items[itemIndex].cantidad); // Inicializar con cantidad actual
    setNotasCorreccion('');
  };

  const handleCloseCorreccionProducto = () => {
    setShowCorreccionProductoModal(false);
    setItemIndexToCorrect(null);
    setSearchProductoCorreccion('');
    setProductoNuevoSeleccionado(null);
    setNuevaCantidadCorreccion(1);
    setNotasCorreccion('');
  };

  const handleCorregirProductoPedido = async () => {
    if (!selectedPedido || itemIndexToCorrect === null) {
      return;
    }

    if (!notasCorreccion.trim()) {
      alert('Por favor, ingresa las notas explicando el motivo de la corrección.');
      return;
    }

    // Validar que la nueva cantidad sea válida
    const cantidadNueva = parseInt(nuevaCantidadCorreccion);
    if (!cantidadNueva || cantidadNueva <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const itemActual = selectedPedido.items[itemIndexToCorrect];
    const cantidadAnterior = itemActual.cantidad;

    // Si no se seleccionó producto nuevo, usar el actual
    const productoParaUsar = productoNuevoSeleccionado || itemActual;
    const cambioDeProducto = productoNuevoSeleccionado && itemActual.productoId !== productoNuevoSeleccionado.id;
    const cambioDeCantidad = cantidadNueva !== cantidadAnterior;

    // Validar que haya al menos un cambio
    if (!cambioDeProducto && !cambioDeCantidad) {
      alert('No hay cambios para aplicar. Modifica el producto o la cantidad.');
      return;
    }

    // Mensaje de confirmación personalizado
    let mensajeConfirmacion = `⚠️ CORREGIR PEDIDO\n\nPedido #${selectedPedido.numeroPedido}\n\n`;

    if (cambioDeProducto && cambioDeCantidad) {
      mensajeConfirmacion += `Producto anterior: ${itemActual.nombre || itemActual.productoNombre} (${cantidadAnterior} unidades)\n`;
      mensajeConfirmacion += `Producto nuevo: ${productoParaUsar.nombre} (${cantidadNueva} unidades)\n`;
    } else if (cambioDeProducto) {
      mensajeConfirmacion += `Cambio de producto:\n`;
      mensajeConfirmacion += `  De: ${itemActual.nombre || itemActual.productoNombre}\n`;
      mensajeConfirmacion += `  A: ${productoParaUsar.nombre}\n`;
      mensajeConfirmacion += `Cantidad: ${cantidadNueva} unidades\n`;
    } else {
      mensajeConfirmacion += `Producto: ${itemActual.nombre || itemActual.productoNombre}\n`;
      mensajeConfirmacion += `Cantidad anterior: ${cantidadAnterior} unidades\n`;
      mensajeConfirmacion += `Cantidad nueva: ${cantidadNueva} unidades\n`;
    }

    mensajeConfirmacion += `\nEsta acción:\n`;
    mensajeConfirmacion += `• Modificará el pedido\n`;
    mensajeConfirmacion += `• Ajustará el inventario reservado automáticamente\n`;
    mensajeConfirmacion += `• Actualizará el valor total\n\n`;
    mensajeConfirmacion += `¿Continuar?`;

    const confirmar = window.confirm(mensajeConfirmacion);

    if (!confirmar) return;

    setCorrigiendoProducto(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Producto a usar (nuevo o el mismo)
      const productoNuevoId = productoParaUsar.id || productoParaUsar.productoId || '';
      const precioNuevo = productoParaUsar.precio || 0;
      const subtotalNuevo = (precioNuevo || 0) * (cantidadNueva || 0);

      // Crear copia de items actualizada (preservando estadoItem)
      const updatedItems = [...selectedPedido.items];
      const estadoItemActual = itemActual.estadoItem || 'En Producción';
      updatedItems[itemIndexToCorrect] = {
        productoId: productoNuevoId || '',
        productoNombre: productoParaUsar.nombre || '',
        nombre: productoParaUsar.nombre || '',
        productoRef: productoParaUsar.referencia || '',
        referencia: productoParaUsar.referencia || '',
        talla: productoParaUsar.talla || '',
        precio: precioNuevo || 0,
        cantidad: cantidadNueva || 0,
        subtotal: subtotalNuevo || 0,
        categoria: productoParaUsar.categoria || '',
        estadoItem: estadoItemActual // Preservar el estado
      };

      // Recalcular total del pedido (excluyendo items anulados y cambios de talla)
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado && item.estadoItem !== 'Cambio de Talla')
        .reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const nuevoSaldoPendiente = Math.max(0, nuevoTotal - (selectedPedido.totalAbonado || 0));

      // Ajustar inventario
      const itemTieneStockReservado = estadoItemActual === 'Listo para Entrega' || estadoItemActual === 'Parcialmente Listo';
      const cantidadReservadaActual = itemTieneStockReservado ? (itemActual.cantidadLista || itemActual.cantidad) : 0;

      if (!cambioDeProducto) {
        // Mismo producto, solo cambió la cantidad
        const diferenciaCantidad = cantidadNueva - cantidadAnterior;
        if (diferenciaCantidad !== 0 && itemActual.productoId) {
          const productoRef = doc(db, 'products', itemActual.productoId);
          const updateData = {
            totalPrendasPedidas: increment(diferenciaCantidad),
            updatedAt: serverTimestamp()
          };

          // Si tiene stock reservado, ajustar la reserva (pero NO el stockTotal)
          // Las prendas ya existen en el inventario, solo cambiamos cuántas están reservadas
          if (itemTieneStockReservado) {
            updateData.stockReservadoPedidos = increment(diferenciaCantidad);
          }

          batch.update(productoRef, updateData);
        }
      } else {
        // Productos diferentes
        // Liberar del producto anterior (solo si tiene productoId válido)
        if (itemActual.productoId) {
          const productoAnteriorRef = doc(db, 'products', itemActual.productoId);
          const updateDataAnterior = {
            totalPrendasPedidas: increment(-cantidadAnterior),
            updatedAt: serverTimestamp()
          };

          // Liberar reserva del producto anterior (si tenía)
          if (itemTieneStockReservado) {
            updateDataAnterior.stockReservadoPedidos = increment(-cantidadReservadaActual);
          }

          batch.update(productoAnteriorRef, updateDataAnterior);
        }

        // Incrementar del producto nuevo (solo si tiene productoId válido)
        if (productoNuevoId) {
          const productoNuevoRef = doc(db, 'products', productoNuevoId);
          const updateDataNuevo = {
            totalPrendasPedidas: increment(cantidadNueva),
            updatedAt: serverTimestamp()
          };

          // Reservar en el producto nuevo (si estaba listo)
          if (itemTieneStockReservado) {
            updateDataNuevo.stockReservadoPedidos = increment(cantidadNueva);
          }

          batch.update(productoNuevoRef, updateDataNuevo);
        }
      }

      // Actualizar el pedido
      batch.update(pedidoRef, {
        items: updatedItems,
        total: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        correccion: {
          fecha: serverTimestamp(),
          usuario: currentUser.uid,
          itemIndex: itemIndexToCorrect,
          productoAnterior: `${itemActual.nombre || itemActual.productoNombre} (${cantidadAnterior} unidades)`,
          productoNuevo: `${productoParaUsar.nombre} (${cantidadNueva} unidades)`,
          notas: notasCorreccion
        },
        updatedAt: serverTimestamp()
      });

      // Verificar si necesitamos crear transacción de ajuste
      const totalAnterior = selectedPedido.total || selectedPedido.totalPedido || 0;
      const totalAbonado = selectedPedido.totalAbonado || 0;

      // Solo crear transacción si nuevo total < total abonado (hay exceso de pago)
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;

        // Determinar método de pago del último abono para el egreso
        const abonosCorreccion = selectedPedido.abonos || [];
        const metodoEgresoCorreccion = abonosCorreccion.length > 0
          ? (abonosCorreccion[abonosCorreccion.length - 1].metodoPago || 'Efectivo')
          : 'Efectivo';

        // Crear transacción de egreso/devolución con la fecha ACTUAL (cuando sale el dinero de caja)
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'egreso',
          monto: -diferenciaExceso, // Negativo para que se reste en el cierre de caja
          metodoPago: metodoEgresoCorreccion,
          pedidoId: selectedPedido.id,
          numeroPedido: selectedPedido.numeroPedido,
          descripcion: `Egreso por corrección Pedido #${selectedPedido.numeroPedido}: Total abonado ($${totalAbonado.toLocaleString()}) excede nuevo total ($${nuevoTotal.toLocaleString()})`,
          categoria: 'Devolución',
          notas: `Corrección: ${itemActual.nombre || itemActual.productoNombre} → ${productoParaUsar.nombre}. ${notasCorreccion}`,
          clienteId: selectedPedido.clienteId,
          clienteNombre: selectedPedido.clienteNombre,
          detalleCorreccion: {
            productoAnterior: itemActual.nombre || itemActual.productoNombre,
            cantidadAnterior: cantidadAnterior,
            subtotalAnterior: itemActual.subtotal || 0,
            productoNuevo: productoParaUsar.nombre,
            cantidadNueva: cantidadNueva,
            subtotalNuevo: subtotalNuevo,
            totalAnterior: totalAnterior,
            nuevoTotal: nuevoTotal,
            totalAbonado: totalAbonado,
            diferenciaExceso: diferenciaExceso
          },
          fecha: serverTimestamp(), // Fecha actual - cuando realmente sale el dinero de caja
          userId: currentUser.uid
        });
      }

      await batch.commit();

      let mensaje = '✅ Pedido corregido exitosamente.\n\nInventario actualizado correctamente.';

      // Mostrar advertencia si hubo exceso de pago
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;
        mensaje += `\n\n⚠️ ADVERTENCIA: El total abonado ($${totalAbonado.toLocaleString()}) excede el nuevo total ($${nuevoTotal.toLocaleString()})`;
        mensaje += `\n\n💰 Se creó un egreso automático de $${diferenciaExceso.toLocaleString()} en caja`;
        mensaje += `\n\nDebes devolver este dinero al cliente.`;
      }
      alert(mensaje);

      // Recargar pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();
      handleCloseCorreccionProducto();

    } catch (error) {
      console.error('Error al corregir pedido:', error);
      alert('❌ Error al corregir pedido: ' + error.message);
    } finally {
      setCorrigiendoProducto(false);
    }
  };

  // Funciones para anulación de productos en pedidos
  const handleOpenAnularProducto = (itemIndex) => {
    setItemIndexToAnular(itemIndex);
    setShowAnularProductoModal(true);
    setMotivoAnulacion('');
  };

  const handleCloseAnularProducto = () => {
    setShowAnularProductoModal(false);
    setItemIndexToAnular(null);
    setMotivoAnulacion('');
  };

  const handleAnularProducto = async () => {
    if (!selectedPedido || itemIndexToAnular === null) {
      return;
    }

    if (!motivoAnulacion.trim()) {
      alert('Por favor, ingresa el motivo de la anulación.');
      return;
    }

    const itemToAnular = selectedPedido.items[itemIndexToAnular];

    // Validar que no sea el último producto activo
    const productosActivos = selectedPedido.items.filter(item => !item.anulado);
    if (productosActivos.length === 1 && !itemToAnular.anulado) {
      alert('⚠️ No puedes anular el último producto activo.\n\nSi deseas cancelar todo el pedido, usa la opción "Eliminar Pedido".');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ ANULAR PRODUCTO\n\n` +
      `Pedido #${selectedPedido.numeroPedido}\n` +
      `Producto: ${itemToAnular.nombre}\n` +
      `Talla: ${itemToAnular.talla}\n` +
      `Cantidad: ${itemToAnular.cantidad}\n` +
      `Subtotal: $${itemToAnular.subtotal?.toLocaleString()}\n\n` +
      `Esta acción:\n` +
      `• Liberará ${itemToAnular.cantidad} unidad(es) del inventario reservado\n` +
      `• Reducirá el total del pedido\n` +
      `• El producto quedará marcado como ANULADO (visible para auditoría)\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setAnulandoProducto(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Marcar producto como anulado (preservando estadoItem)
      const updatedItems = [...selectedPedido.items];
      const estadoItemActual = itemToAnular.estadoItem || 'En Producción';
      updatedItems[itemIndexToAnular] = {
        productoId: itemToAnular.productoId || '',
        productoNombre: itemToAnular.productoNombre || itemToAnular.nombre || '',
        nombre: itemToAnular.nombre || itemToAnular.productoNombre || '',
        productoRef: itemToAnular.productoRef || itemToAnular.referencia || '',
        referencia: itemToAnular.referencia || itemToAnular.productoRef || '',
        talla: itemToAnular.talla || '',
        precio: itemToAnular.precio || 0,
        cantidad: itemToAnular.cantidad || 0,
        subtotal: itemToAnular.subtotal || 0,
        categoria: itemToAnular.categoria || '',
        estadoItem: estadoItemActual, // Preservar estado
        anulado: true,
        anulacion: {
          fecha: new Date().toISOString(), // No se puede usar serverTimestamp() dentro de arrays
          motivo: motivoAnulacion || '',
          usuario: currentUser.email || 'Admin'
        }
      };

      // Recalcular totales (solo productos NO anulados y NO cambio de talla)
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado && item.estadoItem !== 'Cambio de Talla')
        .reduce((sum, item) => sum + (item.subtotal || 0), 0);

      // Decrementar inventario
      const itemTeniaStockReservado = estadoItemActual === 'Listo para Entrega' || estadoItemActual === 'Parcialmente Listo';
      const cantidadReservada = itemTeniaStockReservado ? (itemToAnular.cantidadLista || itemToAnular.cantidad) : 0;
      // Solo actualizar inventario si el item tiene productoId válido
      if (itemToAnular.productoId) {
        const productoRef = doc(db, 'products', itemToAnular.productoId);
        const updateData = {
          totalPrendasPedidas: increment(-itemToAnular.cantidad),
          updatedAt: serverTimestamp()
        };

        // Si tenía stock reservado, liberar la reserva (pero NO tocar stockTotal)
        // Las prendas siguen existiendo en el inventario, solo ya no están reservadas
        if (itemTeniaStockReservado) {
          updateData.stockReservadoPedidos = increment(-cantidadReservada);
        }

        batch.update(productoRef, updateData);
      }

      // Verificar totales para el pedido
      const totalAbonado = selectedPedido.totalAbonado || 0;
      const nuevoSaldoPendiente = Math.max(0, nuevoTotal - totalAbonado);

      // Actualizar pedido con total y saldo recalculados
      batch.update(pedidoRef, {
        items: updatedItems,
        total: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        updatedAt: serverTimestamp()
      });

      // Solo crear transacción si nuevo total < total abonado (hay exceso de pago)
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;

        // Determinar método de pago del último abono para el egreso
        const abonosAnulacion = selectedPedido.abonos || [];
        const metodoEgresoAnulacion = abonosAnulacion.length > 0
          ? (abonosAnulacion[abonosAnulacion.length - 1].metodoPago || 'Efectivo')
          : 'Efectivo';

        // Crear transacción de egreso/devolución con la fecha ACTUAL (cuando sale el dinero de caja)
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'egreso',
          monto: -diferenciaExceso, // Negativo para que se reste en el cierre de caja
          metodoPago: metodoEgresoAnulacion,
          categoria: 'Devolución',
          pedidoId: selectedPedido.id,
          numeroPedido: selectedPedido.numeroPedido,
          descripcion: `Egreso por anulación Pedido #${selectedPedido.numeroPedido}: Total abonado ($${totalAbonado.toLocaleString()}) excede nuevo total ($${nuevoTotal.toLocaleString()})`,
          motivo: motivoAnulacion,
          clienteId: selectedPedido.clienteId,
          clienteNombre: selectedPedido.clienteNombre,
          productoAnulado: {
            nombre: itemToAnular.nombre,
            cantidad: itemToAnular.cantidad,
            precio: itemToAnular.precio || 0,
            subtotal: itemToAnular.subtotal || 0,
            totalAnterior: selectedPedido.total || selectedPedido.totalPedido || 0,
            nuevoTotal: nuevoTotal,
            totalAbonado: totalAbonado,
            diferenciaExceso: diferenciaExceso
          },
          fecha: serverTimestamp(), // Fecha actual - cuando realmente sale el dinero de caja
          userId: currentUser.uid
        });
      }

      await batch.commit();

      let mensaje = `✅ Producto anulado exitosamente.\n\nNuevo total: $${nuevoTotal.toLocaleString()}`;

      // Mostrar advertencia si hubo exceso de pago
      if (nuevoTotal < totalAbonado) {
        const diferenciaExceso = totalAbonado - nuevoTotal;
        mensaje += `\n\n⚠️ ADVERTENCIA: El total abonado ($${totalAbonado.toLocaleString()}) excede el nuevo total ($${nuevoTotal.toLocaleString()})`;
        mensaje += `\n\n💰 Se creó un egreso automático de $${diferenciaExceso.toLocaleString()} en caja`;
        mensaje += `\n\nDebes devolver este dinero al cliente.`;
      }
      alert(mensaje);

      // Recargar pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();
      fetchProducts();
      handleCloseAnularProducto();

    } catch (error) {
      console.error('Error al anular producto:', error);
      alert('❌ Error al anular producto: ' + error.message);
    } finally {
      setAnulandoProducto(false);
    }
  };

  const handleRestaurarProducto = async (itemIndex) => {
    if (!selectedPedido) return;

    const itemToRestaurar = selectedPedido.items[itemIndex];

    const confirmar = window.confirm(
      `🔄 RESTAURAR PRODUCTO\n\n` +
      `Producto: ${itemToRestaurar.nombre}\n` +
      `Cantidad: ${itemToRestaurar.cantidad}\n` +
      `Subtotal: $${itemToRestaurar.subtotal?.toLocaleString()}\n\n` +
      `Esta acción:\n` +
      `• Volverá a reservar ${itemToRestaurar.cantidad} unidad(es) en el inventario\n` +
      `• Aumentará el total del pedido\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    // Prevenir doble clic
    if (restaurandoProducto) return;
    setRestaurandoProducto(true);

    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Quitar marca de anulado
      const updatedItems = [...selectedPedido.items];
      const { anulado, anulacion, ...itemSinAnulacion } = itemToRestaurar;
      updatedItems[itemIndex] = itemSinAnulacion;

      // Recalcular totales (excluyendo anulados y cambios de talla)
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado && item.estadoItem !== 'Cambio de Talla')
        .reduce((sum, item) => sum + (item.subtotal || 0), 0);

      // Incrementar inventario (solo si tiene productoId válido)
      const itemTieneStockReservado = itemToRestaurar.estadoItem === 'Listo para Entrega' || itemToRestaurar.estadoItem === 'Parcialmente Listo';
      const cantidadReservada = itemTieneStockReservado ? (itemToRestaurar.cantidadLista || itemToRestaurar.cantidad) : 0;

      if (itemToRestaurar.productoId) {
        const productoRef = doc(db, 'products', itemToRestaurar.productoId);
        const updateData = {
          totalPrendasPedidas: increment(itemToRestaurar.cantidad),
          updatedAt: serverTimestamp()
        };

        // Si tiene stock reservado, volver a reservar (pero NO tocar stockTotal)
        // Las prendas ya existen en el inventario, solo volvemos a reservarlas
        if (itemTieneStockReservado) {
          updateData.stockReservadoPedidos = increment(cantidadReservada);
        }

        batch.update(productoRef, updateData);
      }

      // Actualizar pedido (incluyendo saldoPendiente recalculado)
      const nuevoSaldoPendiente = Math.max(0, nuevoTotal - (selectedPedido.totalAbonado || 0));
      batch.update(pedidoRef, {
        items: updatedItems,
        total: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        updatedAt: serverTimestamp()
      });

      // Crear transacción de ajuste POSITIVA SI el pedido tiene abonos
      const totalAbonado = selectedPedido.totalAbonado || 0;
      const tieneAbonos = totalAbonado > 0;

      if (tieneAbonos) {
        // Determinar método de pago del último abono para la restauración
        const abonosRestauracion = selectedPedido.abonos || [];
        const metodoRestauracion = abonosRestauracion.length > 0
          ? (abonosRestauracion[abonosRestauracion.length - 1].metodoPago || 'Efectivo')
          : 'Efectivo';

        const diferenciaTotal = itemToRestaurar.subtotal;
        const transactionRef = doc(collection(db, 'transactions'));
        batch.set(transactionRef, {
          tipo: 'restauracion_pedido',
          monto: diferenciaTotal, // POSITIVO - representa reversión de ajuste
          metodoPago: metodoRestauracion,
          pedidoId: selectedPedido.id,
          numeroPedido: selectedPedido.numeroPedido,
          descripcion: `Restauración producto en Pedido #${selectedPedido.numeroPedido}: ${itemToRestaurar.nombre}`,
          clienteId: selectedPedido.clienteId,
          clienteNombre: selectedPedido.clienteNombre,
          productoRestaurado: {
            nombre: itemToRestaurar.nombre,
            cantidad: itemToRestaurar.cantidad,
            precio: itemToRestaurar.precio,
            subtotal: itemToRestaurar.subtotal
          },
          fecha: serverTimestamp(),
          userId: currentUser.uid
        });
      }

      await batch.commit();

      let mensaje = `✅ Producto restaurado exitosamente.\n\nNuevo total: $${nuevoTotal.toLocaleString()}`;
      if (tieneAbonos) {
        mensaje += `\n\n📊 Transacción de ajuste creada.`;
      }
      alert(mensaje);

      // Recargar pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();
      fetchProducts();

    } catch (error) {
      console.error('Error al restaurar producto:', error);
      alert('❌ Error al restaurar producto: ' + error.message);
    } finally {
      setRestaurandoProducto(false);
    }
  };

  // Funciones para cambiar cliente del pedido
  const handleAbrirCambiarCliente = () => {
    setShowCambiarClienteModal(true);
    setSearchNuevoCliente('');
    setNuevoClienteSeleccionado(null);
    setNotasCambioCliente('');
  };

  const handleCerrarCambiarCliente = () => {
    setShowCambiarClienteModal(false);
    setSearchNuevoCliente('');
    setNuevoClienteSeleccionado(null);
    setNotasCambioCliente('');
  };

  const handleCambiarCliente = async () => {
    if (!selectedPedido || !nuevoClienteSeleccionado) {
      alert('Por favor, selecciona un cliente.');
      return;
    }

    if (!notasCambioCliente.trim()) {
      alert('Por favor, ingresa las notas explicando el motivo del cambio de cliente.');
      return;
    }

    // Validar que no sea el mismo cliente
    if (selectedPedido.clienteId === nuevoClienteSeleccionado.id) {
      alert('El cliente seleccionado es el mismo que el actual.');
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas que deseas cambiar el cliente de este pedido?\n\n` +
      `Cliente Actual:\n` +
      `- ${selectedPedido.clienteNombre}\n\n` +
      `Cliente Nuevo:\n` +
      `- ${nuevoClienteSeleccionado.nombreCompleto}\n\n` +
      `Notas: ${notasCambioCliente}`
    );

    if (!confirmar) return;

    setCambiandoCliente(true);
    try {
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      await updateDoc(pedidoRef, {
        clienteId: nuevoClienteSeleccionado.id,
        clienteNombre: nuevoClienteSeleccionado.nombreCompleto,
        cambioCliente: {
          fecha: serverTimestamp(),
          usuario: currentUser.uid,
          clienteAnterior: {
            id: selectedPedido.clienteId,
            nombre: selectedPedido.clienteNombre
          },
          clienteNuevo: {
            id: nuevoClienteSeleccionado.id,
            nombre: nuevoClienteSeleccionado.nombreCompleto
          },
          notas: notasCambioCliente
        },
        updatedAt: serverTimestamp()
      });

      alert('✅ Cliente actualizado exitosamente.');

      // Recargar pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();
      handleCerrarCambiarCliente();

    } catch (error) {
      console.error('Error al cambiar cliente:', error);
      alert('❌ Error al cambiar cliente: ' + error.message);
    } finally {
      setCambiandoCliente(false);
    }
  };

  // Funciones para cambiar talla de un producto
  const handleAbrirCambiarTalla = (itemIndex) => {
    setItemIndexToCambiarTalla(itemIndex);
    setShowCambiarTallaModal(true);
    setSearchNuevaTalla('');
    setProductoNuevaTalla(null);
    setMotivoCambioTalla('Cliente se probó y no le quedó');
  };

  const handleCerrarCambiarTalla = () => {
    setShowCambiarTallaModal(false);
    setItemIndexToCambiarTalla(null);
    setSearchNuevaTalla('');
    setProductoNuevaTalla(null);
    setMotivoCambioTalla('');
  };

  const handleCambiarTalla = async () => {
    if (!selectedPedido || itemIndexToCambiarTalla === null) return;

    const itemActual = selectedPedido.items[itemIndexToCambiarTalla];

    if (!productoNuevaTalla) {
      alert('Por favor, selecciona el producto con la nueva talla.');
      return;
    }

    if (!motivoCambioTalla.trim()) {
      alert('Por favor, ingresa el motivo del cambio de talla.');
      return;
    }

    // Validar que sea diferente producto
    if (itemActual.productoId === productoNuevaTalla.id) {
      alert('El producto seleccionado es el mismo que el actual.');
      return;
    }

    const confirmar = window.confirm(
      `🔄 CAMBIO DE TALLA\n\n` +
      `Producto Actual:\n` +
      `- ${itemActual.nombre} - Talla ${itemActual.talla}\n` +
      `- Estado: ${itemActual.estadoItem}\n` +
      `- Precio: $${itemActual.precio?.toLocaleString('es-CO')}\n\n` +
      `Nueva Talla:\n` +
      `- ${productoNuevaTalla.nombre} - Talla ${productoNuevaTalla.talla}\n` +
      `- Precio: $${productoNuevaTalla.precio?.toLocaleString('es-CO')}\n\n` +
      `Motivo: ${motivoCambioTalla}\n\n` +
      `Esta acción:\n` +
      `• Liberará la talla actual (volverá a stock disponible)\n` +
      `• Agregará la nueva talla en "En Producción"\n` +
      `• Ajustará el total del pedido si hay diferencia de precio\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    // Prevenir doble clic
    if (cambiandoTalla) return;
    setCambiandoTalla(true);

    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Crear copia de items
      const updatedItems = [...selectedPedido.items];

      // Marcar el item actual como "cambiado" (para historial)
      const itemCambiado = {
        ...itemActual,
        estadoItem: 'Cambio de Talla',
        cambioTalla: {
          fecha: new Date().toISOString(),
          tallaAnterior: itemActual.talla,
          tallaNueva: productoNuevaTalla.talla,
          motivo: motivoCambioTalla,
          usuario: currentUser?.email || 'Admin'
        }
      };
      updatedItems[itemIndexToCambiarTalla] = itemCambiado;

      // Agregar el nuevo producto con la nueva talla
      const nuevoItem = {
        productoId: productoNuevaTalla.id,
        nombre: productoNuevaTalla.nombre,
        referencia: productoNuevaTalla.referencia,
        talla: productoNuevaTalla.talla,
        cantidad: itemActual.cantidad,
        precio: productoNuevaTalla.precio || 0,
        subtotal: (productoNuevaTalla.precio || 0) * itemActual.cantidad,
        categoria: productoNuevaTalla.categoria || '',
        estadoItem: 'En Producción',
        fechaSolicitud: new Date().toISOString(), // ✅ Fecha de hoy para reporte de corte
        origenCambioTalla: {
          itemOriginalIndex: itemIndexToCambiarTalla,
          tallaAnterior: itemActual.talla,
          fechaCambio: new Date().toISOString()
        }
      };
      updatedItems.push(nuevoItem);

      // Recalcular total del pedido
      const nuevoTotal = updatedItems
        .filter(item => !item.anulado && item.estadoItem !== 'Cambio de Talla')
        .reduce((sum, item) => sum + item.subtotal, 0);

      const nuevoSaldoPendiente = Math.max(0, nuevoTotal - (selectedPedido.totalAbonado || 0));

      // Actualizar inventario
      // 1. Liberar el producto anterior
      const itemYaEntregado = itemActual.estadoItem === 'Entregado';
      const itemTeniaReserva = itemActual.estadoItem === 'Listo para Entrega' || itemActual.estadoItem === 'Parcialmente Listo';
      const cantidadReservada = itemTeniaReserva ? (itemActual.cantidadLista || itemActual.cantidad) : 0;

      const productoAnteriorRef = doc(db, 'products', itemActual.productoId);
      const updateAnterior = {
        updatedAt: serverTimestamp()
      };

      if (itemYaEntregado) {
        // Si ya fue entregado, devolver al stock total (cliente lo devuelve)
        updateAnterior.stockTotal = increment(itemActual.cantidad);
        // No modificar totalPrendasPedidas ni stockReservadoPedidos (ya se decrementaron al entregar)
      } else {
        // Si NO fue entregado, liberar las reservas normalmente
        updateAnterior.totalPrendasPedidas = increment(-itemActual.cantidad);

        if (itemTeniaReserva) {
          // Liberar la reserva y devolver a stock disponible
          updateAnterior.stockReservadoPedidos = increment(-cantidadReservada);
        }
      }

      batch.update(productoAnteriorRef, updateAnterior);

      // Si el item ya fue entregado, crear transacción de cambio/devolución
      if (itemYaEntregado) {
        const transaccionCambioRef = doc(collection(db, 'transactions'));
        batch.set(transaccionCambioRef, {
          tipo: 'cambio_talla',
          monto: 0, // No afecta caja, es un cambio
          metodoPago: 'Cambio',
          pedidoId: selectedPedido.id,
          numeroPedido: selectedPedido.numeroPedido,
          descripcion: `Cambio de talla en Pedido #${selectedPedido.numeroPedido}: ${itemActual.nombre} Talla ${itemActual.talla} → Talla ${productoNuevaTalla.talla}`,
          clienteId: selectedPedido.clienteId,
          clienteNombre: selectedPedido.clienteNombre,
          productoDevuelto: {
            nombre: itemActual.nombre,
            talla: itemActual.talla,
            cantidad: itemActual.cantidad
          },
          productoNuevo: {
            nombre: productoNuevaTalla.nombre,
            talla: productoNuevaTalla.talla,
            cantidad: itemActual.cantidad
          },
          motivo: motivoCambioTalla,
          fecha: serverTimestamp(),
          userId: currentUser?.uid,
          afectaCaja: false // No afecta el cierre de caja
        });
      }

      // 2. Reservar el nuevo producto (solo totalPrendasPedidas porque está en producción)
      const productoNuevoRef = doc(db, 'products', productoNuevaTalla.id);
      batch.update(productoNuevoRef, {
        totalPrendasPedidas: increment(itemActual.cantidad),
        updatedAt: serverTimestamp()
      });

      // Actualizar el pedido
      batch.update(pedidoRef, {
        items: updatedItems,
        total: nuevoTotal,
        saldoPendiente: nuevoSaldoPendiente,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      const diferenciaPrecio = (productoNuevaTalla.precio || 0) - (itemActual.precio || 0);
      let mensaje = `✅ Talla cambiada exitosamente.\n\n`;
      mensaje += `${itemActual.nombre} Talla ${itemActual.talla} → Talla ${productoNuevaTalla.talla}\n\n`;
      mensaje += `Nuevo total del pedido: $${nuevoTotal.toLocaleString('es-CO')}`;

      if (diferenciaPrecio !== 0) {
        mensaje += `\n\n💰 Diferencia de precio: ${diferenciaPrecio > 0 ? '+' : ''}$${diferenciaPrecio.toLocaleString('es-CO')}`;
      }

      alert(mensaje);

      // Recargar pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();
      fetchProducts();
      handleCerrarCambiarTalla();

    } catch (error) {
      console.error('Error al cambiar talla:', error);
      alert('❌ Error al cambiar talla: ' + error.message);
    } finally {
      setCambiandoTalla(false);
    }
  };

  // Función para agregar observación al pedido
  const handleAgregarObservacion = async () => {
    if (!selectedPedido) return;

    if (!nuevaObservacion.trim()) {
      alert('Por favor, escribe una observación.');
      return;
    }

    setGuardandoObservacion(true);
    try {
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Crear el objeto de observación con timestamp y usuario
      const nuevaObs = {
        texto: nuevaObservacion.trim(),
        fecha: new Date().toISOString(),
        usuario: currentUser?.email || 'Usuario'
      };

      // Obtener el historial actual de observaciones
      const observacionesActuales = selectedPedido.observacionesHistorial || [];

      // Agregar la nueva observación al inicio del array
      const observacionesActualizadas = [nuevaObs, ...observacionesActuales];

      // Actualizar en Firestore
      await updateDoc(pedidoRef, {
        observacionesHistorial: observacionesActualizadas,
        updatedAt: serverTimestamp()
      });

      // Recargar el pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });

      // Limpiar el campo de texto
      setNuevaObservacion('');

      alert('✅ Observación agregada exitosamente.');
      fetchPedidos(); // Refrescar la lista

    } catch (error) {
      console.error('Error al agregar observación:', error);
      alert('❌ Error al agregar observación: ' + error.message);
    } finally {
      setGuardandoObservacion(false);
    }
  };

  // Función para abrir el modal de cambio de método de pago de abono
  const handleOpenCambiarMetodoPagoAbono = (abonoIndex) => {
    const abono = selectedPedido.abonos[abonoIndex];
    setAbonoIndexToEdit(abonoIndex);
    setNuevoMetodoPagoAbono(abono.metodoPago);
    setNotasMetodoPagoAbono('');
    setShowCambiarMetodoPagoAbonoModal(true);
  };

  // Función para cerrar el modal de cambio de método de pago de abono
  const handleCloseCambiarMetodoPagoAbono = () => {
    setShowCambiarMetodoPagoAbonoModal(false);
    setAbonoIndexToEdit(null);
    setNuevoMetodoPagoAbono('');
    setNotasMetodoPagoAbono('');
  };

  // Función para cambiar el método de pago de un abono
  const handleCambiarMetodoPagoAbono = async () => {
    if (!selectedPedido || abonoIndexToEdit === null) return;

    if (!notasMetodoPagoAbono.trim()) {
      alert('Por favor, ingresa una nota explicando el cambio.');
      return;
    }

    const abonoActual = selectedPedido.abonos[abonoIndexToEdit];

    if (nuevoMetodoPagoAbono === abonoActual.metodoPago) {
      alert('El método de pago es el mismo que el actual.');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ CAMBIAR MÉTODO DE PAGO DE ABONO\n\n` +
      `Pedido #${selectedPedido.numeroPedido}\n` +
      `Abono: $${abonoActual.monto.toLocaleString('es-CO')}\n` +
      `Fecha: ${new Date(abonoActual.fecha).toLocaleDateString('es-CO')}\n\n` +
      `Método actual: ${abonoActual.metodoPago}\n` +
      `Nuevo método: ${nuevoMetodoPagoAbono}\n\n` +
      `Esta acción:\n` +
      `• Modificará el método de pago del abono\n` +
      `• Actualizará la transacción asociada\n` +
      `• Registrará el cambio para auditoría\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setCambiandoMetodoPagoAbono(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // 1. Actualizar el abono en el pedido
      const abonosActualizados = [...selectedPedido.abonos];
      abonosActualizados[abonoIndexToEdit] = {
        ...abonoActual,
        metodoPago: nuevoMetodoPagoAbono,
        correccionMetodoPago: {
          fecha: new Date().toISOString(),
          metodoPagoAnterior: abonoActual.metodoPago,
          metodoPagoNuevo: nuevoMetodoPagoAbono,
          notas: notasMetodoPagoAbono,
          usuario: currentUser?.email || 'Admin'
        }
      };

      batch.update(pedidoRef, {
        abonos: abonosActualizados,
        updatedAt: serverTimestamp()
      });

      // 2. Buscar y actualizar la transacción asociada
      // Las transacciones de abono tienen el monto y fecha del abono
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('pedidoId', '==', selectedPedido.id),
        where('tipo', '==', 'abono_pedido'),
        where('monto', '==', abonoActual.monto)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      // Filtrar por fecha para encontrar la transacción exacta
      const abonoFecha = new Date(abonoActual.fecha);
      transactionsSnapshot.docs.forEach(transactionDoc => {
        const transData = transactionDoc.data();
        const transFecha = transData.fecha?.toDate?.();

        // Comparar si es la misma fecha (con margen de 1 minuto)
        if (transFecha && Math.abs(transFecha - abonoFecha) < 60000) {
          batch.update(transactionDoc.ref, {
            metodoPago: nuevoMetodoPagoAbono,
            correccionMetodoPago: {
              fecha: serverTimestamp(),
              metodoPagoAnterior: abonoActual.metodoPago,
              metodoPagoNuevo: nuevoMetodoPagoAbono,
              notas: notasMetodoPagoAbono,
              usuario: currentUser?.email || 'Admin'
            }
          });
        }
      });

      await batch.commit();

      alert(
        `✅ Método de pago actualizado\n\n` +
        `Anterior: ${abonoActual.metodoPago}\n` +
        `Nuevo: ${nuevoMetodoPagoAbono}`
      );

      // Recargar el pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos(); // Refrescar la lista

      handleCloseCambiarMetodoPagoAbono();

    } catch (error) {
      console.error('Error al cambiar método de pago del abono:', error);
      alert('❌ Error al cambiar método de pago: ' + error.message);
    } finally {
      setCambiandoMetodoPagoAbono(false);
    }
  };

  // Función para abrir el modal de cambio de cantidad lista
  const handleOpenCambiarCantidadLista = (itemIndex) => {
    const item = selectedPedido.items[itemIndex];
    setItemIndexToCambiarEstado(itemIndex);

    // Calcular la cantidad lista correcta basada en el estado actual
    let cantidadListaInicial = item.cantidadLista || 0;

    // Si el item está "Listo para Entrega" pero no tiene cantidadLista definido,
    // asumir que toda la cantidad (menos entregada) está lista
    if (item.estadoItem === 'Listo para Entrega' && !item.cantidadLista) {
      cantidadListaInicial = item.cantidad - (item.cantidadEntregada || 0);
    }

    setNuevaCantidadLista(cantidadListaInicial);
    setNotasCambioEstado('');
    setShowCambiarCantidadListaModal(true);
  };

  // Función para cerrar el modal de cambio de cantidad lista
  const handleCloseCambiarCantidadLista = () => {
    setShowCambiarCantidadListaModal(false);
    setItemIndexToCambiarEstado(null);
    setNuevaCantidadLista(0);
    setNotasCambioEstado('');
  };

  // Función para cambiar la cantidad lista de un item
  const handleCambiarCantidadLista = async () => {
    if (!selectedPedido || itemIndexToCambiarEstado === null) return;

    const item = selectedPedido.items[itemIndexToCambiarEstado];
    const cantidadTotal = item.cantidad;
    const cantidadEntregada = item.cantidadEntregada || 0;

    if (nuevaCantidadLista < 0 || nuevaCantidadLista > cantidadTotal) {
      alert(`La cantidad lista debe estar entre 0 y ${cantidadTotal}`);
      return;
    }

    if (nuevaCantidadLista + cantidadEntregada > cantidadTotal) {
      alert(`La suma de cantidad lista (${nuevaCantidadLista}) y cantidad entregada (${cantidadEntregada}) no puede superar el total (${cantidadTotal})`);
      return;
    }

    const cantidadActualLista = item.cantidadLista || 0;

    if (nuevaCantidadLista === cantidadActualLista) {
      alert('La cantidad lista es la misma que la actual.');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ CAMBIAR CANTIDAD LISTA\n\n` +
      `Pedido #${selectedPedido.numeroPedido}\n` +
      `Producto: ${item.nombre}\n` +
      `Talla: ${item.talla}\n` +
      `Cantidad Total: ${cantidadTotal}\n\n` +
      `Cantidad Lista Actual: ${cantidadActualLista}\n` +
      `Nueva Cantidad Lista: ${nuevaCantidadLista}\n` +
      `Cantidad Aún en Producción: ${cantidadTotal - nuevaCantidadLista - cantidadEntregada}\n\n` +
      `¿Continuar?`
    );

    if (!confirmar) return;

    setCambiandoCantidadLista(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // Actualizar el item con la nueva cantidad lista
      const updatedItems = [...selectedPedido.items];
      updatedItems[itemIndexToCambiarEstado] = {
        ...item,
        cantidadLista: nuevaCantidadLista,
        cantidadEntregada: cantidadEntregada,
        // Calcular estadoItem basado en las cantidades
        estadoItem:
          cantidadEntregada === cantidadTotal ? 'Entregado' :
            nuevaCantidadLista + cantidadEntregada === cantidadTotal ? 'Listo para Entrega' :
              nuevaCantidadLista > 0 ? 'Parcialmente Listo' :
                'En Producción',
        historialCambiosEstado: [
          ...(item.historialCambiosEstado || []),
          {
            fecha: new Date().toISOString(),
            cantidadListaAnterior: cantidadActualLista,
            cantidadListaNueva: nuevaCantidadLista,
            notas: notasCambioEstado || 'Cambio manual de cantidad lista',
            usuario: currentUser?.email || 'Admin'
          }
        ]
      };

      // ACTUALIZAR INVENTARIO - Incrementar/Decrementar stockReservadoPedidos
      const productoRef = doc(db, 'products', item.productoId);
      const diferenciaCantidad = nuevaCantidadLista - cantidadActualLista;

      if (diferenciaCantidad !== 0) {
        // Si aumenta la cantidad lista, aumentamos la reserva
        // Si disminuye la cantidad lista, disminuimos la reserva
        batch.update(productoRef, {
          stockReservadoPedidos: increment(diferenciaCantidad),
          updatedAt: serverTimestamp()
        });
      }

      // Calcular el nuevo estado general del pedido
      const anyInProduction = updatedItems.some(item =>
        !item.anulado && (item.cantidadLista || 0) + (item.cantidadEntregada || 0) < item.cantidad
      );
      const allItemsReadyOrDelivered = updatedItems.every(item =>
        item.anulado || (item.cantidadLista || 0) + (item.cantidadEntregada || 0) === item.cantidad
      );
      const todosEntregados = updatedItems.every(item =>
        item.anulado || (item.cantidadEntregada || 0) === item.cantidad
      );

      let estadoCorrecto;
      if (todosEntregados) {
        estadoCorrecto = 'Entregado';
      } else if (anyInProduction) {
        estadoCorrecto = 'En Proceso';
      } else if (allItemsReadyOrDelivered) {
        estadoCorrecto = 'Pedido Completo - Listo para Recoger';
      }

      batch.update(pedidoRef, {
        items: updatedItems,
        estadoGeneral: estadoCorrecto,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      alert(
        `✅ Cantidad lista actualizada\n\n` +
        `Anterior: ${cantidadActualLista} de ${cantidadTotal}\n` +
        `Nueva: ${nuevaCantidadLista} de ${cantidadTotal}`
      );

      // Recargar el pedido
      const pedidoSnap = await getDoc(pedidoRef);
      setSelectedPedido({ id: pedidoSnap.id, ...pedidoSnap.data() });
      fetchPedidos();

      handleCloseCambiarCantidadLista();

    } catch (error) {
      console.error('Error al cambiar cantidad lista:', error);
      alert('❌ Error al cambiar cantidad lista: ' + error.message);
    } finally {
      setCambiandoCantidadLista(false);
    }
  };

  // ===== ANULAR PEDIDO COMPLETO =====
  const handleOpenAnularPedido = () => {
    setShowAnularPedidoModal(true);
    setMotivoAnularPedido('');
  };

  const handleCloseAnularPedido = () => {
    setShowAnularPedidoModal(false);
    setMotivoAnularPedido('');
  };

  const handleAnularPedidoCompleto = async () => {
    if (!selectedPedido) return;

    if (!motivoAnularPedido.trim()) {
      alert('Por favor, ingresa el motivo de la anulación.');
      return;
    }

    // Calcular totales para el mensaje de confirmación
    const totalAbonado = selectedPedido.totalAbonado || 0;
    const itemsActivos = selectedPedido.items?.filter(item => !item.anulado) || [];

    const confirmar = window.confirm(
      `⚠️ ANULAR PEDIDO COMPLETO\n\n` +
      `Pedido #${selectedPedido.numeroPedido}\n` +
      `Cliente: ${selectedPedido.clienteNombre}\n` +
      `Total: $${selectedPedido.total?.toLocaleString('es-CO')}\n` +
      `Total Abonado: $${totalAbonado.toLocaleString('es-CO')}\n` +
      `Productos: ${itemsActivos.length}\n\n` +
      `Esta acción:\n` +
      `• Marcará el pedido como ANULADO\n` +
      `• Anulará todas las transacciones asociadas\n` +
      `• Liberará el inventario reservado\n` +
      `${totalAbonado > 0 ? `• ⚠️ IMPORTANTE: Debes devolver $${totalAbonado.toLocaleString('es-CO')} al cliente\n` : ''}` +
      `\n¿Continuar con la anulación?`
    );

    if (!confirmar) return;

    setAnulandoPedido(true);
    try {
      const batch = writeBatch(db);
      const pedidoRef = doc(db, 'pedidos', selectedPedido.id);

      // 1. Marcar pedido como anulado
      batch.update(pedidoRef, {
        anulado: true,
        estadoGeneral: 'Anulado',
        fechaAnulacion: serverTimestamp(),
        motivoAnulacion: motivoAnularPedido,
        usuarioAnulacion: currentUser?.email || 'Admin',
        updatedAt: serverTimestamp()
      });

      // 2. Revertir inventario de items activos
      for (const item of itemsActivos) {
        if (item.productoId) {
          const productoRef = doc(db, 'products', item.productoId);
          const updateData = {
            totalPrendasPedidas: increment(-item.cantidad),
            updatedAt: serverTimestamp()
          };

          // Si estaba "Listo para Entrega", también liberar stock reservado
          if (item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Parcialmente Listo') {
            const cantidadLista = item.cantidadLista || (item.estadoItem === 'Listo para Entrega' ? item.cantidad : 0);
            if (cantidadLista > 0) {
              updateData.stockReservadoPedidos = increment(-cantidadLista);
            }
          }

          batch.update(productoRef, updateData);
        }
      }

      // 3. Buscar y anular transacciones asociadas
      const transQuery = query(
        collection(db, 'transactions'),
        where('pedidoId', '==', selectedPedido.id)
      );
      const transSnap = await getDocs(transQuery);

      transSnap.docs.forEach(transDoc => {
        batch.update(transDoc.ref, {
          anulada: true,
          fechaAnulacion: serverTimestamp(),
          motivoAnulacion: `Pedido #${selectedPedido.numeroPedido} anulado: ${motivoAnularPedido}`
        });
      });

      // 4. Crear registro(s) de egreso si había abonos (devolver dinero al cliente)
      if (totalAbonado > 0) {
        const abonos = selectedPedido.abonos || [];

        // Agrupar abonos por método de pago
        const abonosPorMetodo = {};
        abonos.forEach(abono => {
          const metodo = abono.metodoPago || 'Efectivo';
          if (!abonosPorMetodo[metodo]) abonosPorMetodo[metodo] = 0;
          abonosPorMetodo[metodo] += abono.monto;
        });

        const metodos = Object.keys(abonosPorMetodo);

        if (metodos.length === 0) {
          // Fallback: si no hay array de abonos, crear egreso único con Efectivo
          const egresoRef = doc(collection(db, 'transactions'));
          batch.set(egresoRef, {
            tipo: 'egreso',
            monto: -totalAbonado,
            metodoPago: 'Efectivo',
            categoria: 'Devolución',
            pedidoId: selectedPedido.id,
            numeroPedido: selectedPedido.numeroPedido,
            descripcion: `Devolución por anulación Pedido #${selectedPedido.numeroPedido}`,
            concepto: `Devolución por anulación Pedido #${selectedPedido.numeroPedido}`,
            motivo: motivoAnularPedido,
            clienteId: selectedPedido.clienteId,
            clienteNombre: selectedPedido.clienteNombre,
            fecha: serverTimestamp(),
            userId: currentUser?.uid
          });
        } else {
          // Crear un egreso por cada método de pago usado
          for (const metodo of metodos) {
            const montoMetodo = abonosPorMetodo[metodo];
            const egresoRef = doc(collection(db, 'transactions'));
            batch.set(egresoRef, {
              tipo: 'egreso',
              monto: -montoMetodo,
              metodoPago: metodo,
              categoria: 'Devolución',
              pedidoId: selectedPedido.id,
              numeroPedido: selectedPedido.numeroPedido,
              descripcion: `Devolución por anulación Pedido #${selectedPedido.numeroPedido} (${metodo})`,
              concepto: `Devolución por anulación Pedido #${selectedPedido.numeroPedido}`,
              motivo: motivoAnularPedido,
              clienteId: selectedPedido.clienteId,
              clienteNombre: selectedPedido.clienteNombre,
              fecha: serverTimestamp(),
              userId: currentUser?.uid
            });
          }
        }
      }

      await batch.commit();

      let mensaje = `✅ Pedido #${selectedPedido.numeroPedido} anulado exitosamente.\n\n`;
      mensaje += `• Transacciones anuladas: ${transSnap.size}\n`;
      mensaje += `• Productos liberados: ${itemsActivos.length}`;

      if (totalAbonado > 0) {
        const abonos = selectedPedido.abonos || [];
        const abonosPorMetodo = {};
        abonos.forEach(abono => {
          const metodo = abono.metodoPago || 'Efectivo';
          if (!abonosPorMetodo[metodo]) abonosPorMetodo[metodo] = 0;
          abonosPorMetodo[metodo] += abono.monto;
        });
        const detalleMetodos = Object.entries(abonosPorMetodo)
          .map(([metodo, monto]) => `  • ${metodo}: $${monto.toLocaleString('es-CO')}`)
          .join('\n');

        mensaje += `\n\n⚠️ IMPORTANTE:\nDebes devolver $${totalAbonado.toLocaleString('es-CO')} al cliente.`;
        if (detalleMetodos) {
          mensaje += `\nDesglose por método:\n${detalleMetodos}`;
        }
      }

      alert(mensaje);

      // Cerrar modales y recargar
      handleCloseAnularPedido();
      setShowManageModal(false);
      setSelectedPedido(null);
      fetchPedidos();
      fetchProducts();

    } catch (error) {
      console.error('Error al anular pedido:', error);
      alert('❌ Error al anular pedido: ' + error.message);
    } finally {
      setAnulandoPedido(false);
    }
  };

  // Imprimir tirilla desde el modal de gestión
  const handleImprimirTirillaGestion = () => {
    if (!selectedPedido) {
      alert('No hay pedido seleccionado para imprimir.');
      return;
    }

    // Verificar que haya items
    if (!selectedPedido.items || selectedPedido.items.length === 0) {
      alert('El pedido no tiene productos para imprimir.');
      return;
    }

    // Preparar datos para la tirilla - esto hará visible el modal
    setReciboDatos({
      pedidoId: selectedPedido.id,
      numeroPedido: selectedPedido.numeroPedido,
      clienteNombre: selectedPedido.clienteNombre,
      clienteId: selectedPedido.clienteId,
      items: selectedPedido.items,
      total: selectedPedido.total,
      abono: selectedPedido.totalAbonado || 0,
      saldo: selectedPedido.saldoPendiente || 0,
      fecha: selectedPedido.createdAt?.toDate
        ? new Date(selectedPedido.createdAt.toDate()).toLocaleDateString('es-CO')
        : new Date().toLocaleDateString('es-CO'),
      observaciones: selectedPedido.observaciones || ''
    });
  };

  // Función común para imprimir
  const handlePrint = () => {
    window.print();
  };

  // ====== SEND EMAIL ======
  const handleOpenEmailModal = () => {
    // Pre-fill with client's email if available
    const clientEmail = allClients.find(c => c.id === reciboDatos?.clienteId)?.email || '';
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
      const sendPedidoEmail = httpsCallable(functions, 'sendPedidoEmail');
      const result = await sendPedidoEmail({
        pedidoId: reciboDatos.pedidoId,
        toEmail: emailRecipient.trim()
      });

      // Actualizar el email del cliente en la base de datos si se ingresó manualmente
      if (reciboDatos?.clienteId) {
        try {
          const clienteActual = allClients.find(c => c.id === reciboDatos.clienteId);
          // Solo actualizar si el email es diferente o no existe
          if (clienteActual && clienteActual.email !== emailRecipient.trim()) {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'clients', reciboDatos.clienteId), {
              email: emailRecipient.trim()
            });

            // Actualizar el cliente en el estado local
            setAllClients(prevClients =>
              prevClients.map(c =>
                c.id === reciboDatos.clienteId
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

  // Filtrar pedidos por estado y búsqueda con ordenamiento por relevancia
  const filteredPedidos = pedidos
    .filter(pedido => {
      // Filtro por estado
      const matchEstado = filterEstado ? pedido.estadoGeneral === filterEstado : true;

      // Filtro por búsqueda
      if (!searchTerm.trim()) {
        return matchEstado;
      }

      const searchLower = searchTerm.toLowerCase().trim();
      const matchNumero = String(pedido.numeroPedido || '').includes(searchTerm);
      const matchNombre = (pedido.clienteNombre || '').toLowerCase().includes(searchLower);
      const matchDocumento = (pedido.clienteDocumento || '').toLowerCase().includes(searchLower);

      // Buscar teléfono en los datos del cliente
      const clienteData = allClients.find(c => c.id === pedido.clienteId);
      const matchTelefono = clienteData ? (clienteData.telefono || '').includes(searchTerm) : false;

      const matchSearch = matchNumero || matchNombre || matchDocumento || matchTelefono;

      return matchEstado && matchSearch;
    })
    .sort((a, b) => {
      // Si hay búsqueda activa, ordenar por relevancia
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const aNumero = String(a.numeroPedido || '');
        const bNumero = String(b.numeroPedido || '');

        // Prioridad 1: Coincidencia exacta en número de pedido
        const aExactMatch = aNumero === searchTerm;
        const bExactMatch = bNumero === searchTerm;
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // Prioridad 2: Comienza con el término de búsqueda en número de pedido
        const aStartsWith = aNumero.startsWith(searchTerm);
        const bStartsWith = bNumero.startsWith(searchTerm);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Prioridad 3: Contiene el término en número de pedido
        const aContainsNumero = aNumero.includes(searchTerm);
        const bContainsNumero = bNumero.includes(searchTerm);
        if (aContainsNumero && !bContainsNumero) return -1;
        if (!aContainsNumero && bContainsNumero) return 1;

        // Prioridad 4: Coincidencia exacta en nombre del cliente
        const aNombreExact = (a.clienteNombre || '').toLowerCase() === searchLower;
        const bNombreExact = (b.clienteNombre || '').toLowerCase() === searchLower;
        if (aNombreExact && !bNombreExact) return -1;
        if (!aNombreExact && bNombreExact) return 1;

        // Prioridad 5: Comienza con el término en nombre del cliente
        const aNombreStarts = (a.clienteNombre || '').toLowerCase().startsWith(searchLower);
        const bNombreStarts = (b.clienteNombre || '').toLowerCase().startsWith(searchLower);
        if (aNombreStarts && !bNombreStarts) return -1;
        if (!aNombreStarts && bNombreStarts) return 1;
      }

      // Orden por defecto: pedidos más recientes primero
      return b.numeroPedido - a.numeroPedido;
    });

  // Calcular paginación
  const totalPaginas = Math.ceil(filteredPedidos.length / pedidosPorPagina);
  const indiceInicio = (paginaActual - 1) * pedidosPorPagina;
  const indiceFin = indiceInicio + pedidosPorPagina;
  const pedidosPaginados = filteredPedidos.slice(indiceInicio, indiceFin);

  // Resetear página cuando cambia el filtro o la búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [filterEstado, searchTerm]);

  // Función helper para obtener color del badge de estado
  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'En Proceso':
        return 'bg-blue-100 text-blue-800';
      case 'Pedido Completo - Listo para Recoger':
        return 'bg-yellow-100 text-yellow-800';
      case 'Entregado':
        return 'bg-green-100 text-green-800';
      case 'Anulado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* PARTE 1: Vista Principal */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Pedidos de Producción</h1>
          <p className="text-gray-600 mt-1">Sistema integral de gestión de pedidos</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ backgroundColor: '#D50565' }}
          className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <span className="hidden sm:inline">+ Crear Nuevo Pedido</span>
          <span className="sm:hidden">+ Nuevo Pedido</span>
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 print:hidden">
        {/* Barra de búsqueda */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por número de pedido, cliente, teléfono o identificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
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

        {/* Filtros por estado */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterEstado('')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${filterEstado === '' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterEstado('En Proceso')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${filterEstado === 'En Proceso' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => setFilterEstado('Pedido Completo - Listo para Recoger')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${filterEstado === 'Pedido Completo - Listo para Recoger' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <span className="hidden sm:inline">Pedido Completo</span>
            <span className="sm:hidden">Completo</span>
          </button>
          <button
            onClick={() => setFilterEstado('Entregado')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${filterEstado === 'Entregado' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Entregado
          </button>
          <button
            onClick={() => setFilterEstado('Anulado')}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${filterEstado === 'Anulado' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
          >
            Anulados
          </button>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Lista de Pedidos</h2>
        </div>

        {loading && pedidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Cargando pedidos...</div>
        ) : filteredPedidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? (
              <>
                No se encontraron pedidos que coincidan con "{searchTerm}"
                {filterEstado && ` en estado "${filterEstado}"`}.
              </>
            ) : (
              <>No hay pedidos {filterEstado ? `en estado "${filterEstado}"` : 'registrados'}.</>
            )}
          </div>
        ) : (
          <>
            {/* Vista de Tarjetas - Solo Móvil */}
            <div className="md:hidden space-y-4">
              {pedidosPaginados.map((pedido) => (
                <div key={pedido.id} className={`bg-white border rounded-lg p-4 shadow-sm ${pedido.anulado ? 'opacity-60 border-red-300' : ''}`}>
                  {/* Header de la tarjeta */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className={`font-mono font-bold text-lg ${pedido.anulado ? 'text-red-600 line-through' : 'text-gray-800'}`}>
                        #{String(pedido.numeroPedido).padStart(4, '0')}
                      </span>
                      <p className="font-medium text-gray-900 mt-1">{pedido.clienteNombre}</p>
                      {pedido.colegioNombre && (
                        <p className="text-sm text-gray-600 mt-0.5">{pedido.colegioNombre}</p>
                      )}
                      {(() => {
                        const telefono = allClients.find(c => c.id === pedido.clienteId)?.telefono;
                        return telefono ? (
                          <a
                            href={`tel:${telefono}`}
                            className="text-sm hover:underline flex items-center gap-1 mt-1"
                            style={{ color: '#D50565' }}
                          >
                            <Phone size={12} />
                            {telefono}
                          </a>
                        ) : null;
                      })()}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoBadgeColor(pedido.estadoGeneral)}`}>
                      {pedido.estadoGeneral}
                    </span>
                  </div>

                  {/* Información del pedido */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <p className="font-medium text-gray-900">
                        {pedido.createdAt?.toDate
                          ? new Date(pedido.createdAt.toDate()).toLocaleDateString('es-CO')
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <p className="font-bold text-gray-900">${pedido.total?.toLocaleString('es-CO')}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Saldo Pendiente:</span>
                      <p className="font-bold text-lg" style={{ color: '#D50565' }}>
                        ${pedido.saldoPendiente?.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>

                  {/* Botón de acción */}
                  <button
                    onClick={() => handleOpenManagePedido(pedido.id)}
                    className="w-full px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Gestionar Pedido
                  </button>
                </div>
              ))}
            </div>

            {/* Vista de Tabla - Solo Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Pedido</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado General</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Pendiente</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pedidosPaginados.map((pedido) => (
                    <tr key={pedido.id} className={`hover:bg-gray-50 ${pedido.anulado ? 'bg-red-50 opacity-70' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-mono font-bold ${pedido.anulado ? 'text-red-600 line-through' : 'text-gray-800'}`}>
                          #{String(pedido.numeroPedido).padStart(4, '0')}
                        </span>
                        {pedido.anulado && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">ANULADO</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className={`font-medium ${pedido.anulado ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{pedido.clienteNombre}</p>
                        {pedido.colegioNombre && (
                          <p className="text-sm text-gray-600">{pedido.colegioNombre}</p>
                        )}
                        {(() => {
                          const telefono = allClients.find(c => c.id === pedido.clienteId)?.telefono;
                          return telefono ? (
                            <a
                              href={`tel:${telefono}`}
                              className="text-sm hover:underline flex items-center gap-1"
                              style={{ color: '#D50565' }}
                            >
                              <Phone size={12} />
                              {telefono}
                            </a>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {pedido.createdAt?.toDate
                          ? new Date(pedido.createdAt.toDate()).toLocaleDateString('es-CO')
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoBadgeColor(pedido.estadoGeneral)}`}>
                          {pedido.estadoGeneral}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-800">
                        ${pedido.total?.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium" style={{ color: '#D50565' }}>
                        ${pedido.saldoPendiente?.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenManagePedido(pedido.id)}
                          className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Gestionar Pedido
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                  <span className="hidden sm:inline">
                    Mostrando {indiceInicio + 1}-{Math.min(indiceFin, filteredPedidos.length)} de {filteredPedidos.length} pedidos
                  </span>
                  <span className="sm:hidden">
                    {indiceInicio + 1}-{Math.min(indiceFin, filteredPedidos.length)} de {filteredPedidos.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setPaginaActual(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">Anterior</span>
                    <span className="sm:hidden">&larr;</span>
                  </button>
                  <div className="hidden sm:flex gap-2">
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                      <button
                        key={numero}
                        onClick={() => setPaginaActual(numero)}
                        className={`px-3 py-1 text-sm border rounded-lg transition-colors ${paginaActual === numero
                            ? 'bg-primary text-white border-primary'
                            : 'border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {numero}
                      </button>
                    ))}
                  </div>
                  <span className="sm:hidden text-sm font-medium text-gray-700">
                    Pág. {paginaActual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaActual(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <span className="sm:hidden">&rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PARTE 2: Modal de Creación de Pedido */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">Crear Nuevo Pedido</h2>
              <button
                type="button"
                onClick={() => setShowClientModal(true)}
                style={{ backgroundColor: '#D50565' }}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                + Crear Cliente
              </button>
            </div>

            <form onSubmit={handleSavePedido} className="p-6 space-y-6">
              {/* Selector de Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente <span className="text-red-500">*</span>
                </label>
                {!selectedClient ? (
                  <div>
                    <input
                      type="text"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                      placeholder="Buscar cliente por nombre o documento..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {clientSearchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                        {clientSearchResults.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                          >
                            <p className="font-medium text-gray-800">{client.nombreCompleto}</p>
                            <p className="text-sm text-gray-600">{client.numeroDocumento}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{selectedClient.nombreCompleto}</p>
                      <p className="text-sm text-gray-600">{selectedClient.numeroDocumento}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* (NUEVO) SELECTOR DE COLEGIO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colegio (para producción) <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedColegioId}
                  onChange={(e) => setSelectedColegioId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Seleccione un Colegio...</option>
                  <option value="GENERAL">General / Sin Colegio</option>
                  {allColegios.map((colegio) => (
                    <option key={colegio.id} value={colegio.id}>
                      {colegio.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buscador de Productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Productos
                </label>
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  placeholder="Buscar producto por nombre o referencia..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {productSearchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                    {productSearchResults.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{product.nombre}</p>
                            <p className="text-sm text-gray-600">Ref: {product.referencia} | Talla: {product.talla}</p>
                          </div>
                          <p className="text-sm font-medium text-gray-700">
                            ${product.precio?.toLocaleString('es-CO')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Carrito de Pedido */}
              {cartItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Productos del Pedido</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Precio</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cartItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{item.product.nombre}</p>
                              <p className="text-sm text-gray-600">Ref: {item.product.referencia} | Talla: {item.product.talla}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={item.cantidad}
                                onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.precio}
                                onChange={(e) => handleUpdatePrice(index, e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              ${(item.cantidad * item.precio).toLocaleString('es-CO')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Abono y Método de Pago */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abono Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={abono}
                    onChange={(e) => setAbono(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Nequi">Nequi</option>
                    <option value="Daviplata">Daviplata</option>
                    <option value="Nu">Nu</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Cruce de saldo">Cruce de saldo</option>
                  </select>
                </div>
                {metodoPago === 'Cruce de saldo' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Factura/Pedido de origen
                    </label>
                    <input
                      type="text"
                      value={referenciaOrigen}
                      onChange={(e) => setReferenciaOrigen(e.target.value)}
                      placeholder="Ej: Factura #152, Pedido #0405"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones (Medidas especiales, etc.)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows="3"
                  placeholder="Ej: Manga larga, talla especial..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Resumen */}
              {cartItems.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Total del Pedido:</span>
                    <span className="text-xl font-bold text-gray-800">
                      ${calculateTotal().toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">Abono:</span>
                    <span className="text-lg font-medium text-gray-800">
                      ${(Number(abono) || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                    <span className="text-gray-700 font-medium">Saldo Pendiente:</span>
                    <span className="text-xl font-bold" style={{ color: '#D50565' }}>
                      ${calculateSaldoPendiente().toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || guardandoPedido || !selectedClient || cartItems.length === 0}
                  style={{ backgroundColor: '#D50565' }}
                  className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {guardandoPedido && <Loader2 size={18} className="animate-spin" />}
                  {guardandoPedido ? 'Guardando...' : 'Guardar Pedido'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCreateForm}
                  disabled={loading}
                  className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* PARTE 3: Modal de Gestión de Pedido */}
      {showManageModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Gestionar Pedido #{String(selectedPedido.numeroPedido).padStart(4, '0')}
                  </h2>
                  <p className="text-gray-600 mt-1">{selectedPedido.clienteNombre}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAbrirCambiarCliente}
                    style={{ backgroundColor: '#EA5C2E' }}
                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Cambiar Cliente
                  </button>
                  <button
                    onClick={handleImprimirTirillaGestion}
                    style={{ backgroundColor: '#D50565' }}
                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimir Tirilla
                  </button>
                  {isAdmin && selectedPedido.estadoGeneral !== 'Anulado' && (
                    <button
                      onClick={handleOpenAnularPedido}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Anular Pedido
                    </button>
                  )}
                  <button
                    onClick={() => setShowManageModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Resumen Financiero */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-lg font-bold text-gray-800">
                    ${selectedPedido.total?.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Total Abonado</p>
                  <p className="text-lg font-bold text-green-700">
                    ${(selectedPedido.totalAbonado || 0).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Saldo Pendiente</p>
                  <p className="text-lg font-bold text-red-700">
                    ${(selectedPedido.saldoPendiente || 0).toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Lista de Productos del Pedido */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Productos del Pedido
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Precio</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedPedido.items.map((item, index) => (
                        <tr key={index} className={item.anulado ? 'bg-gray-50' : ''}>
                          <td className="px-4 py-3">
                            <p className={`font-medium ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {item.nombre || item.productoNombre}
                            </p>
                            <p className={`text-sm ${item.anulado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                              Ref: {item.referencia} | Talla: {item.talla}
                            </p>
                            {item.anulado && (
                              <p className="text-xs text-red-600 mt-1 font-normal">
                                ❌ ANULADO - {item.anulacion?.motivo}
                              </p>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-center ${item.anulado ? 'text-gray-400 line-through' : ''}`}>
                            {item.cantidad}
                          </td>
                          <td className={`px-4 py-3 text-center ${item.anulado ? 'text-gray-400 line-through' : ''}`}>
                            ${item.precio?.toLocaleString('es-CO')}
                          </td>
                          <td className={`px-4 py-3 text-center font-medium ${item.anulado ? 'text-gray-400 line-through' : ''}`}>
                            {item.anulado ? '[ANULADO]' : `$${item.subtotal?.toLocaleString('es-CO')}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!item.anulado && (
                              <div className="space-y-1">
                                {/* Estado principal */}
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.estadoItem === 'En Producción'
                                    ? 'bg-blue-100 text-blue-800'
                                    : item.estadoItem === 'Listo para Entrega'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : item.estadoItem === 'Parcialmente Listo'
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-green-100 text-green-800'
                                  }`}>
                                  {item.estadoItem}
                                </span>
                                {/* Detalle de cantidades */}
                                {item.cantidad > 1 && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {item.cantidadEntregada > 0 && (
                                      <div className="text-green-700">
                                        ✓ Entregado: {item.cantidadEntregada}/{item.cantidad}
                                      </div>
                                    )}
                                    {(item.cantidadLista || 0) > 0 && (item.cantidadEntregada || 0) < item.cantidad && (
                                      <div className="text-yellow-700">
                                        ⏳ Listo: {item.cantidadLista || 0}/{item.cantidad}
                                      </div>
                                    )}
                                    {((item.cantidadLista || 0) + (item.cantidadEntregada || 0)) < item.cantidad && (
                                      <div className="text-blue-700">
                                        🔧 En Producción: {item.cantidad - (item.cantidadLista || 0) - (item.cantidadEntregada || 0)}/{item.cantidad}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!item.anulado ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2 justify-center flex-wrap">
                                  {item.estadoItem !== 'Entregado' && (
                                    <>
                                      <button
                                        onClick={() => handleOpenCorreccionProducto(index)}
                                        className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                                        title="Corregir Producto"
                                      >
                                        Corregir
                                      </button>
                                      <button
                                        onClick={() => handleOpenCambiarCantidadLista(index)}
                                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                        title="Cambiar estado del producto"
                                      >
                                        📦 Estado
                                      </button>
                                    </>
                                  )}
                                  {/* Botón de cambio de talla: permitir en items listos O entregados si el pedido NO está completo */}
                                  {(item.estadoItem === 'Listo para Entrega' ||
                                    item.estadoItem === 'Parcialmente Listo' ||
                                    (item.estadoItem === 'Entregado' && selectedPedido.estadoGeneral !== 'Entregado')
                                  ) && (
                                      <button
                                        onClick={() => handleAbrirCambiarTalla(index)}
                                        className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors"
                                        title="Cambiar talla (cliente vuelve porque no le quedó)"
                                      >
                                        🔄 Talla
                                      </button>
                                    )}
                                  <button
                                    onClick={() => handleOpenAnularProducto(index)}
                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                    title="Anular este producto"
                                  >
                                    Anular
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRestaurarProducto(index)}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                title="Restaurar producto anulado"
                              >
                                Restaurar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registrar Entrega al Cliente (Listos para Entrega) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Registrar Entrega al Cliente
                </h3>
                {selectedPedido.items.filter(item => item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Parcialmente Listo').length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay ítems listos para entregar.</p>
                ) : (
                  <div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const indices = selectedPedido.items
                                      .map((item, idx) => (item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Parcialmente Listo') ? idx : null)
                                      .filter(idx => idx !== null);
                                    setSelectedItemsForDelivery(indices);
                                  } else {
                                    setSelectedItemsForDelivery([]);
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cantidad Lista</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedPedido.items.map((item, index) => {
                            const cantidadLista = item.cantidadLista || item.cantidad;
                            const esParcial = item.estadoItem === 'Parcialmente Listo';

                            // IMPORTANTE: No mostrar productos anulados para entrega
                            return !item.anulado && (item.estadoItem === 'Listo para Entrega' || item.estadoItem === 'Parcialmente Listo') && (
                              <tr key={index} className={selectedItemsForDelivery.includes(index) ? 'bg-blue-50' : ''}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedItemsForDelivery.includes(index)}
                                    onChange={() => handleToggleItemForDelivery(index)}
                                    className="rounded"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-800">{item.nombre}</p>
                                  <p className="text-sm text-gray-600">Ref: {item.referencia} | Talla: {item.talla}</p>
                                  {esParcial && (
                                    <p className="text-xs text-orange-600 mt-1">
                                      ⚠️ Entrega Parcial: {cantidadLista} de {item.cantidad} listas
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {esParcial ? (
                                    <span className="font-medium text-orange-600">
                                      {cantidadLista}/{item.cantidad}
                                    </span>
                                  ) : (
                                    item.cantidad
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  ${item.subtotal?.toLocaleString('es-CO')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Formulario de Abono (si se requiere) */}
                    {showAbonoForm && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-yellow-800 mb-3">Se requiere abono adicional</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nuevo Abono
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={nuevoAbono}
                              onChange={(e) => setNuevoAbono(e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Método de Pago
                            </label>
                            <select
                              value={nuevoMetodoPago}
                              onChange={(e) => setNuevoMetodoPago(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="Efectivo">Efectivo</option>
                              <option value="Nequi">Nequi</option>
                              <option value="Daviplata">Daviplata</option>
                              <option value="Nu">Nu</option>
                              <option value="Tarjeta">Tarjeta</option>
                              <option value="Cruce de saldo">Cruce de saldo</option>
                            </select>
                          </div>
                          {nuevoMetodoPago === 'Cruce de saldo' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Factura/Pedido de origen
                              </label>
                              <input
                                type="text"
                                value={referenciaOrigen}
                                onChange={(e) => setReferenciaOrigen(e.target.value)}
                                placeholder="Ej: Factura #152, Pedido #0405"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={showAbonoForm ? confirmarEntrega : handleRegistrarEntregaParcial}
                      disabled={loading || registrandoEntrega || selectedItemsForDelivery.length === 0}
                      style={{ backgroundColor: '#D50565' }}
                      className="w-full px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {(loading || registrandoEntrega) && <Loader2 size={18} className="animate-spin" />}
                      {(loading || registrandoEntrega) ? 'Procesando...' : showAbonoForm ? 'Confirmar Entrega' :
                        (() => {
                          // Verificar si después de esta entrega, TODOS los items estarán entregados
                          const itemsQueQuedaranPendientes = selectedPedido.items.filter((item, index) => {
                            // Si este item ya está entregado, no cuenta como pendiente
                            if (item.estadoItem === 'Entregado') return false;
                            // Si este item está seleccionado para entrega ahora, no quedará pendiente
                            if (selectedItemsForDelivery.includes(index)) return false;
                            // Si llegamos aquí, este item quedará pendiente después de la entrega
                            return true;
                          });

                          // Si no quedarán items pendientes, es la entrega final (facturar)
                          const esEntregaFinal = itemsQueQuedaranPendientes.length === 0;

                          return esEntregaFinal ? 'Facturar Pedido' : 'Registrar Entrega Parcial';
                        })()
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Sección de Abonos Adicionales */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Registrar Abono Adicional
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Usa esta sección para registrar abonos cuando el cliente paga sin que haya productos listos para entregar.
                </p>

                <form onSubmit={handleRegistrarAbonoAdicional} className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto del Abono <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={abonoAdicionalMonto}
                        onChange={(e) => setAbonoAdicionalMonto(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Método de Pago
                      </label>
                      <select
                        value={abonoAdicionalMetodo}
                        onChange={(e) => setAbonoAdicionalMetodo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Efectivo">Efectivo</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Daviplata">Daviplata</option>
                        <option value="Nu">Nu</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Cruce de saldo">Cruce de saldo</option>
                      </select>
                    </div>
                    {abonoAdicionalMetodo === 'Cruce de saldo' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Factura/Pedido de origen
                        </label>
                        <input
                          type="text"
                          value={referenciaOrigen}
                          onChange={(e) => setReferenciaOrigen(e.target.value)}
                          placeholder="Ej: Factura #152, Pedido #0405"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || registrandoAbonoAdicional}
                    style={{ backgroundColor: '#D50565' }}
                    className="w-full px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {registrandoAbonoAdicional && <Loader2 size={18} className="animate-spin" />}
                    {registrandoAbonoAdicional ? 'Procesando...' : 'Registrar Abono'}
                  </button>
                </form>

                {/* Historial de Abonos */}
                {selectedPedido.abonos && selectedPedido.abonos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de Abonos</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Método</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                            {isAdmin && <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedPedido.abonos.map((abono, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 text-gray-700">
                                {new Date(abono.fecha).toLocaleDateString('es-CO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-700">
                                {abono.metodoPago}
                                {abono.correccionMetodoPago && (
                                  <span className="ml-1 text-[10px] text-orange-600" title={`Corregido: ${abono.correccionMetodoPago.notas}`}>
                                    ✏️
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-800">
                                ${abono.monto.toLocaleString('es-CO')}
                              </td>
                              {isAdmin && (
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => handleOpenCambiarMetodoPagoAbono(index)}
                                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                    title="Cambiar método de pago"
                                  >
                                    ✏️ Editar
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección de Observaciones del Pedido */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Observaciones del Pedido
                </h3>

                {/* Observación inicial (al crear el pedido) */}
                {selectedPedido.observaciones && selectedPedido.observaciones.trim() && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Observación Inicial:</p>
                    <p className="text-sm text-gray-800">{selectedPedido.observaciones}</p>
                  </div>
                )}

                {/* Formulario para agregar nueva observación */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agregar Nueva Observación
                  </label>
                  <textarea
                    value={nuevaObservacion}
                    onChange={(e) => setNuevaObservacion(e.target.value)}
                    rows="3"
                    placeholder="Escribe aquí cualquier nota o observación adicional..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={guardandoObservacion}
                  />
                  <button
                    onClick={handleAgregarObservacion}
                    disabled={guardandoObservacion || !nuevaObservacion.trim()}
                    className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {guardandoObservacion ? 'Guardando...' : 'Agregar Observación'}
                  </button>
                </div>

                {/* Historial de Observaciones */}
                {selectedPedido.observacionesHistorial && selectedPedido.observacionesHistorial.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de Observaciones</h4>
                    <div className="space-y-2">
                      {selectedPedido.observacionesHistorial.map((obs, index) => (
                        <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs text-gray-500">
                              {new Date(obs.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            <p className="text-xs text-gray-500">{obs.usuario}</p>
                          </div>
                          <p className="text-sm text-gray-800">{obs.texto}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {reciboDatos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full flex flex-col" style={{ maxWidth: '400px', maxHeight: '90vh' }}>

            {/* Header - Fijo arriba */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Pedido Generado</h2>
                <button
                  onClick={() => setReciboDatos(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Receipt Preview - Con scroll si es necesario */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex justify-center">
                <div id="receipt-print" className="bg-white" style={{ maxWidth: '300px', padding: '8px' }}>
                  {/* Company Info */}
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-lg">{companyConfig?.nombre || 'MARTHA ROMERO UNIFORMES'}</h3>
                    {companyConfig?.nit && <p className="text-xs">NIT: {companyConfig.nit}</p>}
                    {companyConfig?.direccion && <p className="text-xs">{companyConfig.direccion}</p>}
                    {companyConfig?.telefono && <p className="text-xs">Tel: {companyConfig.telefono}</p>}
                    <p className="font-bold text-sm mt-2" style={{ letterSpacing: '1px' }}>PEDIDO</p>
                  </div>

                  {/* Order Info */}
                  <div className="border-t border-b border-dashed py-2 mb-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Pedido N°:</span>
                      <span>{String(reciboDatos.numeroPedido).padStart(4, '0')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Fecha:</span>
                      <span>{reciboDatos.fecha}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Cliente:</span>
                      <span>{reciboDatos.clienteNombre}</span>
                    </div>
                    {reciboDatos.colegioNombre && (
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Colegio:</span>
                        <span>{reciboDatos.colegioNombre}</span>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-dashed py-2 mb-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1">Producto</th>
                          <th className="text-center">Cant</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reciboDatos.items.map((item, index) => (
                          <tr key={index}>
                            <td className="py-1">
                              <div className="font-medium">{item.nombre}</div>
                              <div className="text-gray-600 text-[10px]">
                                Ref: {item.referencia} | Talla: {item.talla}
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
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>${reciboDatos.total.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Abono:</span>
                      <span>${reciboDatos.abono.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-1">
                      <span>SALDO:</span>
                      <span>${reciboDatos.saldo.toLocaleString('es-CO')}</span>
                    </div>
                  </div>

                  {/* Observaciones */}
                  {reciboDatos.observaciones && reciboDatos.observaciones.trim() && (
                    <div className="border-t border-dashed pt-2 mb-2 text-xs">
                      <p className="font-bold mb-1">Observaciones:</p>
                      <p>{reciboDatos.observaciones}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="text-center mt-4 text-xs border-t pt-2">
                    <p>¡Gracias por su pedido!</p>
                    <p>Este es un comprobante de pedido</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Fijos abajo */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#EA5C2E' }}
                  >
                    🖨️ Imprimir
                  </button>
                  <button
                    onClick={handleOpenEmailModal}
                    className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#D50565' }}
                  >
                    📧 Enviar por Correo
                  </button>
                </div>
                <button
                  onClick={() => setReciboDatos(null)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Enviar Pedido por Correo</h2>

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
                style={{ backgroundColor: '#D50565' }}
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

      {/* MODAL DE CREACIÓN DE CLIENTE */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">
                Crear Cliente
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
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre Completo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.nombreCompleto}
                    onChange={(e) => setNewClientData({ ...newClientData, nombreCompleto: e.target.value })}
                    placeholder="Ej: Juan Pérez García"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newClientData.tipoDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, tipoDocumento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.numeroDocumento}
                    onChange={(e) => setNewClientData({ ...newClientData, numeroDocumento: e.target.value })}
                    placeholder="Ej: 123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newClientData.telefono}
                    onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                    placeholder="Ej: 3001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="Ej: cliente@ejemplo.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Dirección */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newClientData.direccion}
                    onChange={(e) => setNewClientData({ ...newClientData, direccion: e.target.value })}
                    placeholder="Ej: Calle 123 # 45-67"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={newClientData.ciudad}
                    onChange={(e) => setNewClientData({ ...newClientData, ciudad: e.target.value })}
                    placeholder="Ej: Bogotá"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  />
                </div>

                {/* Colegio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colegio (Opcional)
                  </label>
                  <select
                    value={newClientData.colegioId}
                    onChange={(e) => setNewClientData({ ...newClientData, colegioId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#D50565' }}
                  >
                    <option value="">Sin colegio asignado</option>
                    {allColegios.map(colegio => (
                      <option key={colegio.id} value={colegio.id}>
                        {colegio.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
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
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                style={{ backgroundColor: '#D50565' }}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Crear Cliente
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

      {/* Modal de Corrección de Producto */}
      {/* Modal para cambiar cliente */}
      {showCambiarClienteModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Cambiar Cliente del Pedido</h3>
              <button
                onClick={handleCerrarCambiarCliente}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cliente Actual */}
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">Cliente Actual</h4>
              <div className="text-sm text-gray-700">
                <p><strong>Nombre:</strong> {selectedPedido.clienteNombre}</p>
                {allClients.find(c => c.id === selectedPedido.clienteId) && (
                  <>
                    <p><strong>Documento:</strong> {allClients.find(c => c.id === selectedPedido.clienteId).numeroDocumento}</p>
                    <p><strong>Teléfono:</strong> {allClients.find(c => c.id === selectedPedido.clienteId).telefono}</p>
                  </>
                )}
              </div>
            </div>

            {/* Buscador de Cliente Nuevo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Cliente Nuevo
              </label>
              <input
                type="text"
                placeholder="Buscar por nombre, documento o teléfono..."
                value={searchNuevoCliente}
                onChange={(e) => setSearchNuevoCliente(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Lista de Clientes */}
            <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {allClients
                .filter(c => {
                  if (!searchNuevoCliente.trim()) return true;
                  const searchLower = searchNuevoCliente.toLowerCase();
                  return (
                    c.nombreCompleto?.toLowerCase().includes(searchLower) ||
                    c.numeroDocumento?.toLowerCase().includes(searchLower) ||
                    c.telefono?.toLowerCase().includes(searchLower)
                  );
                })
                .slice(0, 20)
                .map(cliente => (
                  <div
                    key={cliente.id}
                    onClick={() => setNuevoClienteSeleccionado(cliente)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${nuevoClienteSeleccionado?.id === cliente.id ? 'bg-blue-50' : ''
                      }`}
                  >
                    <p className="font-medium text-gray-800">{cliente.nombreCompleto}</p>
                    <p className="text-sm text-gray-600">
                      {cliente.tipoDocumento}: {cliente.numeroDocumento} | Tel: {cliente.telefono || 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cliente.email || 'Sin email'}
                    </p>
                  </div>
                ))}
            </div>

            {/* Cliente Seleccionado */}
            {nuevoClienteSeleccionado && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Cliente Nuevo Seleccionado</h4>
                <div className="text-sm text-gray-700">
                  <p><strong>Nombre:</strong> {nuevoClienteSeleccionado.nombreCompleto}</p>
                  <p><strong>Documento:</strong> {nuevoClienteSeleccionado.tipoDocumento} {nuevoClienteSeleccionado.numeroDocumento}</p>
                  <p><strong>Teléfono:</strong> {nuevoClienteSeleccionado.telefono || 'N/A'}</p>
                  <p><strong>Email:</strong> {nuevoClienteSeleccionado.email || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Notas de Cambio */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del Cambio de Cliente <span className="text-red-500">*</span>
              </label>
              <textarea
                value={notasCambioCliente}
                onChange={(e) => setNotasCambioCliente(e.target.value)}
                placeholder="Explica el motivo del cambio de cliente..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={handleCambiarCliente}
                disabled={cambiandoCliente || !nuevoClienteSeleccionado || !notasCambioCliente.trim()}
                style={{ backgroundColor: '#EA5C2E' }}
                className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cambiandoCliente ? 'Cambiando...' : 'Cambiar Cliente'}
              </button>
              <button
                onClick={handleCerrarCambiarCliente}
                disabled={cambiandoCliente}
                className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorreccionProductoModal && selectedPedido && itemIndexToCorrect !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Corregir Producto en Pedido</h3>
              <button
                onClick={handleCloseCorreccionProducto}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Producto Actual */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Producto Actual</h4>
              <div className="text-sm text-gray-700">
                <p><strong>Nombre:</strong> {selectedPedido.items[itemIndexToCorrect].nombre || selectedPedido.items[itemIndexToCorrect].productoNombre}</p>
                <p><strong>Ref:</strong> {selectedPedido.items[itemIndexToCorrect].referencia}</p>
                <p><strong>Talla:</strong> {selectedPedido.items[itemIndexToCorrect].talla}</p>
                <p><strong>Cantidad:</strong> {selectedPedido.items[itemIndexToCorrect].cantidad}</p>
                <p><strong>Precio:</strong> ${selectedPedido.items[itemIndexToCorrect].precio?.toLocaleString('es-CO')}</p>
                <p><strong>Subtotal:</strong> ${selectedPedido.items[itemIndexToCorrect].subtotal?.toLocaleString('es-CO')}</p>
              </div>
            </div>

            {/* Buscador de Producto Nuevo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cambiar Producto (opcional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Deja vacío si solo quieres cambiar la cantidad
              </p>
              <input
                type="text"
                placeholder="Buscar por nombre, referencia o talla..."
                value={searchProductoCorreccion}
                onChange={(e) => setSearchProductoCorreccion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Lista de Productos */}
            <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {allProducts
                .filter(p => {
                  const searchLower = searchProductoCorreccion.toLowerCase();
                  return (
                    p.nombre?.toLowerCase().includes(searchLower) ||
                    p.referencia?.toLowerCase().includes(searchLower) ||
                    p.talla?.toLowerCase().includes(searchLower)
                  );
                })
                .slice(0, 20)
                .map(producto => (
                  <div
                    key={producto.id}
                    onClick={() => setProductoNuevoSeleccionado(producto)}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${productoNuevoSeleccionado?.id === producto.id ? 'bg-blue-50' : ''
                      }`}
                  >
                    <p className="font-medium text-gray-800">{producto.nombre}</p>
                    <p className="text-sm text-gray-600">
                      Ref: {producto.referencia} | Talla: {producto.talla} | Precio: ${producto.precio?.toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Stock: {producto.stockTotal || 0} | Categoría: {producto.categoria || 'N/A'}
                    </p>
                  </div>
                ))}
            </div>

            {/* Producto Seleccionado */}
            {productoNuevoSeleccionado && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Producto Nuevo Seleccionado</h4>
                <div className="text-sm text-gray-700">
                  <p><strong>Nombre:</strong> {productoNuevoSeleccionado.nombre}</p>
                  <p><strong>Ref:</strong> {productoNuevoSeleccionado.referencia}</p>
                  <p><strong>Talla:</strong> {productoNuevoSeleccionado.talla}</p>
                  <p><strong>Precio:</strong> ${productoNuevoSeleccionado.precio?.toLocaleString('es-CO')}</p>
                  <p><strong>Nuevo Subtotal:</strong> ${(productoNuevoSeleccionado.precio * nuevaCantidadCorreccion)?.toLocaleString('es-CO')}</p>
                  <p className="mt-2 text-orange-700">
                    <strong>Diferencia:</strong> ${Math.abs((productoNuevoSeleccionado.precio * nuevaCantidadCorreccion) - selectedPedido.items[itemIndexToCorrect].subtotal)?.toLocaleString('es-CO')}
                    {(productoNuevoSeleccionado.precio * nuevaCantidadCorreccion) > selectedPedido.items[itemIndexToCorrect].subtotal ? ' (aumenta)' : ' (disminuye)'}
                  </p>
                </div>
              </div>
            )}

            {/* Campo de Cantidad */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad:
              </label>
              <input
                type="number"
                min="1"
                value={nuevaCantidadCorreccion}
                onChange={(e) => setNuevaCantidadCorreccion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cantidad actual: {selectedPedido.items[itemIndexToCorrect].cantidad}
              </p>
            </div>

            {/* Notas de Corrección */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas de Corrección <span className="text-red-500">*</span>
              </label>
              <textarea
                value={notasCorreccion}
                onChange={(e) => setNotasCorreccion(e.target.value)}
                placeholder="Explica el motivo de la corrección..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={handleCorregirProductoPedido}
                disabled={corrigiendoProducto || !productoNuevoSeleccionado || !notasCorreccion.trim()}
                style={{ backgroundColor: '#D50565' }}
                className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {corrigiendoProducto ? 'Corrigiendo...' : 'Corregir Producto'}
              </button>
              <button
                onClick={handleCloseCorreccionProducto}
                disabled={corrigiendoProducto}
                className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Anular Producto */}
      {showAnularProductoModal && selectedPedido && itemIndexToAnular !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              ⚠️ Anular Producto
            </h3>

            {/* Información del producto a anular */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-red-800 mb-2">Producto a Anular:</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Producto:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToAnular].nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Talla:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToAnular].talla}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToAnular].cantidad}</span>
                </div>
                <div>
                  <span className="text-gray-600">Subtotal:</span>{' '}
                  <span className="font-semibold">${selectedPedido.items[itemIndexToAnular].subtotal?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Advertencia */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Esta acción:</strong>
              </p>
              <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                <li>Liberará el inventario reservado</li>
                <li>Reducirá el total del pedido</li>
                <li>El producto quedará visible como ANULADO</li>
                <li>Se guardará en el historial para auditoría</li>
              </ul>
            </div>

            {/* Campo de motivo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la Anulación (requerido):
              </label>
              <textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                rows="3"
                placeholder="Ej: Producto agregado por error, cliente cambió de opinión, etc."
                required
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleAnularProducto}
                disabled={anulandoProducto}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-opacity disabled:opacity-50"
              >
                {anulandoProducto ? 'Anulando...' : 'Anular Producto'}
              </button>
              <button
                onClick={handleCloseAnularProducto}
                disabled={anulandoProducto}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE TALLA */}
      {showCambiarTallaModal && selectedPedido && itemIndexToCambiarTalla !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">🔄 Cambiar Talla de Producto</h3>
              <button
                onClick={handleCerrarCambiarTalla}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Advertencia */}
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Importante:</strong> Esta función es para cuando el cliente se prueba el producto y no le queda.
                El producto actual volverá a stock disponible y se agregará la nueva talla en "En Producción".
              </p>
            </div>

            {/* Producto Actual */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Producto Actual</h4>
              <div className="text-sm text-gray-700">
                <p><strong>Nombre:</strong> {selectedPedido.items[itemIndexToCambiarTalla].nombre}</p>
                <p><strong>Talla:</strong> {selectedPedido.items[itemIndexToCambiarTalla].talla}</p>
                <p><strong>Estado:</strong> {selectedPedido.items[itemIndexToCambiarTalla].estadoItem}</p>
                <p><strong>Cantidad:</strong> {selectedPedido.items[itemIndexToCambiarTalla].cantidad}</p>
                <p><strong>Precio:</strong> ${selectedPedido.items[itemIndexToCambiarTalla].precio?.toLocaleString('es-CO')}</p>
                <p><strong>Subtotal:</strong> ${selectedPedido.items[itemIndexToCambiarTalla].subtotal?.toLocaleString('es-CO')}</p>
              </div>
            </div>

            {/* Buscador de Nueva Talla */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Nueva Talla <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Buscar por nombre, referencia o talla..."
                value={searchNuevaTalla}
                onChange={(e) => setSearchNuevaTalla(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Lista de Productos */}
            {searchNuevaTalla && (
              <div className="mb-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {allProducts
                  .filter(p => {
                    const searchLower = searchNuevaTalla.toLowerCase();
                    return (
                      (p.nombre?.toLowerCase().includes(searchLower) ||
                        p.referencia?.toLowerCase().includes(searchLower) ||
                        p.talla?.toLowerCase().includes(searchLower)) &&
                      p.id !== selectedPedido.items[itemIndexToCambiarTalla].productoId
                    );
                  })
                  .slice(0, 20)
                  .map(producto => (
                    <div
                      key={producto.id}
                      onClick={() => setProductoNuevaTalla(producto)}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${productoNuevaTalla?.id === producto.id ? 'bg-green-50 border-green-200' : ''
                        }`}
                    >
                      <p className="font-medium text-gray-800">{producto.nombre}</p>
                      <p className="text-sm text-gray-600">
                        Ref: {producto.referencia} | Talla: {producto.talla} | Precio: ${producto.precio?.toLocaleString('es-CO')}
                      </p>
                      <p className="text-xs text-gray-500">
                        Stock Disponible: {(producto.stockTotal || 0) - (producto.stockReservadoPedidos || 0) - (producto.stockReservadoApartados || 0)}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {/* Producto Nuevo Seleccionado */}
            {productoNuevaTalla && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Nueva Talla Seleccionada</h4>
                <div className="text-sm text-gray-700">
                  <p><strong>Nombre:</strong> {productoNuevaTalla.nombre}</p>
                  <p><strong>Talla:</strong> {productoNuevaTalla.talla}</p>
                  <p><strong>Precio:</strong> ${productoNuevaTalla.precio?.toLocaleString('es-CO')}</p>
                  <p><strong>Nuevo Subtotal:</strong> ${(productoNuevaTalla.precio * selectedPedido.items[itemIndexToCambiarTalla].cantidad)?.toLocaleString('es-CO')}</p>
                  {productoNuevaTalla.precio !== selectedPedido.items[itemIndexToCambiarTalla].precio && (
                    <p className="mt-2 text-orange-700">
                      <strong>Diferencia:</strong> ${Math.abs(productoNuevaTalla.precio - selectedPedido.items[itemIndexToCambiarTalla].precio)?.toLocaleString('es-CO')}
                      {productoNuevaTalla.precio > selectedPedido.items[itemIndexToCambiarTalla].precio ? ' (aumenta)' : ' (disminuye)'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Motivo del Cambio */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo del Cambio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoCambioTalla}
                onChange={(e) => setMotivoCambioTalla(e.target.value)}
                placeholder="Ej: Cliente se probó y no le quedó, necesita talla más grande..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={handleCambiarTalla}
                disabled={cambiandoTalla || !productoNuevaTalla || !motivoCambioTalla.trim()}
                style={{ backgroundColor: '#D50565' }}
                className="flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cambiandoTalla && <Loader2 size={18} className="animate-spin" />}
                {cambiandoTalla ? 'Cambiando Talla...' : '✓ Cambiar Talla'}
              </button>
              <button
                onClick={handleCerrarCambiarTalla}
                disabled={cambiandoTalla}
                className="px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE MÉTODO DE PAGO DE ABONO */}
      {showCambiarMetodoPagoAbonoModal && selectedPedido && abonoIndexToEdit !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Cambiar Método de Pago de Abono</h2>
              <button
                onClick={handleCloseCambiarMetodoPagoAbono}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Información del abono */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Abono Actual:</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Pedido:</span>{' '}
                  <span className="font-semibold">#{selectedPedido.numeroPedido}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha:</span>{' '}
                  <span className="font-semibold">
                    {new Date(selectedPedido.abonos[abonoIndexToEdit].fecha).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Monto:</span>{' '}
                  <span className="font-semibold">${selectedPedido.abonos[abonoIndexToEdit].monto.toLocaleString('es-CO')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Método Actual:</span>{' '}
                  <span className="font-semibold text-lg">{selectedPedido.abonos[abonoIndexToEdit].metodoPago}</span>
                </div>
              </div>
            </div>

            {/* Selector de nuevo método */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nuevo Método de Pago:
              </label>
              <select
                value={nuevoMetodoPagoAbono}
                onChange={(e) => setNuevoMetodoPagoAbono(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Nequi">Nequi</option>
                <option value="Daviplata">Daviplata</option>
                <option value="Nu">Nu</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Cruce de saldo">Cruce de saldo</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>

            {/* Notas de corrección */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (obligatorio):
              </label>
              <textarea
                value={notasMetodoPagoAbono}
                onChange={(e) => setNotasMetodoPagoAbono(e.target.value)}
                placeholder="Ej: Se registró como efectivo pero fue pago por Nequi..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleCambiarMetodoPagoAbono}
                disabled={cambiandoMetodoPagoAbono || !notasMetodoPagoAbono.trim() || nuevoMetodoPagoAbono === selectedPedido.abonos[abonoIndexToEdit].metodoPago}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cambiandoMetodoPagoAbono ? '⏳ Cambiando...' : '✓ Cambiar Método'}
              </button>
              <button
                onClick={handleCloseCambiarMetodoPagoAbono}
                disabled={cambiandoMetodoPagoAbono}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE CANTIDAD LISTA */}
      {showCambiarCantidadListaModal && selectedPedido && itemIndexToCambiarEstado !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Cambiar Cantidad Lista</h2>
              <button
                onClick={handleCloseCambiarCantidadLista}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Información del producto */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">Producto:</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Pedido:</span>{' '}
                  <span className="font-semibold">#{selectedPedido.numeroPedido}</span>
                </div>
                <div>
                  <span className="text-gray-600">Producto:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToCambiarEstado].nombre}</span>
                </div>
                <div>
                  <span className="text-gray-600">Talla:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToCambiarEstado].talla}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad Total:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToCambiarEstado].cantidad}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad Entregada:</span>{' '}
                  <span className="font-semibold">{selectedPedido.items[itemIndexToCambiarEstado].cantidadEntregada || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cantidad Lista Actual:</span>{' '}
                  <span className="font-semibold text-lg">{selectedPedido.items[itemIndexToCambiarEstado].cantidadLista || 0}</span>
                </div>
              </div>
            </div>

            {/* Selector de nueva cantidad lista */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nueva Cantidad Lista:
              </label>
              <input
                type="number"
                min="0"
                max={selectedPedido.items[itemIndexToCambiarEstado].cantidad}
                value={nuevaCantidadLista === 0 ? '' : nuevaCantidadLista}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setNuevaCantidadLista(0);
                  } else {
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 0) {
                      setNuevaCantidadLista(num);
                    }
                  }
                }}
                placeholder="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cantidad máxima: {selectedPedido.items[itemIndexToCambiarEstado].cantidad}
              </p>
            </div>

            {/* Previsualización */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-semibold text-gray-700 mb-2">Nuevo estado:</p>
              {(() => {
                const item = selectedPedido.items[itemIndexToCambiarEstado];
                const cantidadTotal = item.cantidad;
                const cantidadEntregada = item.cantidadEntregada || 0;
                const cantidadPendiente = cantidadTotal - nuevaCantidadLista - cantidadEntregada;
                const todoListo = nuevaCantidadLista + cantidadEntregada === cantidadTotal;

                return (
                  <div className="space-y-1">
                    {todoListo ? (
                      <div className="text-green-700 font-medium">
                        ✅ Listo para Entrega: {cantidadTotal}/{cantidadTotal}
                      </div>
                    ) : (
                      <>
                        {nuevaCantidadLista > 0 && (
                          <div className="text-yellow-700">
                            ⏳ Listo: {nuevaCantidadLista}/{cantidadTotal}
                          </div>
                        )}
                        {cantidadPendiente > 0 && (
                          <div className="text-blue-700">
                            🔧 En Producción: {cantidadPendiente}/{cantidadTotal}
                          </div>
                        )}
                        {nuevaCantidadLista === 0 && cantidadPendiente > 0 && (
                          <div className="text-gray-500 text-xs mt-1">
                            (Todo en producción)
                          </div>
                        )}
                      </>
                    )}
                    {cantidadEntregada > 0 && (
                      <div className="text-gray-500 text-xs">
                        📦 Ya entregado: {cantidadEntregada}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Notas (opcional) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional):
              </label>
              <textarea
                value={notasCambioEstado}
                onChange={(e) => setNotasCambioEstado(e.target.value)}
                placeholder="Ej: Llegó solo 1 unidad del satélite..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleCambiarCantidadLista}
                disabled={cambiandoCantidadLista || nuevaCantidadLista === (selectedPedido.items[itemIndexToCambiarEstado].cantidadLista || 0)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cambiandoCantidadLista ? '⏳ Guardando...' : '✓ Guardar Cambio'}
              </button>
              <button
                onClick={handleCloseCambiarCantidadLista}
                disabled={cambiandoCantidadLista}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Anular Pedido Completo */}
      {showAnularPedidoModal && selectedPedido && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">
              ⚠️ Anular Pedido #{String(selectedPedido.numeroPedido).padStart(4, '0')}
            </h3>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 mb-2">
                <strong>Cliente:</strong> {selectedPedido.clienteNombre}
              </p>
              <p className="text-sm text-red-800 mb-2">
                <strong>Total:</strong> ${selectedPedido.total?.toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-red-800">
                <strong>Abonado:</strong> ${(selectedPedido.totalAbonado || 0).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 font-medium mb-2">Esta acción:</p>
              <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                <li>Marcará el pedido como ANULADO</li>
                <li>Anulará todas las transacciones asociadas</li>
                <li>Liberará el inventario reservado</li>
                {(selectedPedido.totalAbonado || 0) > 0 && (
                  <li className="text-red-700 font-bold">
                    Debes devolver ${(selectedPedido.totalAbonado || 0).toLocaleString('es-CO')} al cliente
                  </li>
                )}
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de anulación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoAnularPedido}
                onChange={(e) => setMotivoAnularPedido(e.target.value)}
                placeholder="Ingrese el motivo de la anulación..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAnularPedidoCompleto}
                disabled={anulandoPedido || !motivoAnularPedido.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anulandoPedido ? '⏳ Anulando...' : '⚠️ Confirmar Anulación'}
              </button>
              <button
                onClick={handleCloseAnularPedido}
                disabled={anulandoPedido}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pedidos;
