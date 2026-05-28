import { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { getAlistadaActual, productoB2BCoincideConAsignacion } from '../utils/pedidosB2BLogic';

const Inventory = () => {
  const { isAdmin, currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [colegios, setColegios] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Estados para tabs
  const [activeTab, setActiveTab] = useState('inventario'); // 'inventario' | 'historial'

  // Estados para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColegio, setFilterColegio] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStock, setFilterStock] = useState(''); // todos, bajo, agotado

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 10;

  // Estados para historial de entradas
  const [entradas, setEntradas] = useState([]);
  const [filteredEntradas, setFilteredEntradas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filterFechaInicio, setFilterFechaInicio] = useState('');
  const [filterFechaFin, setFilterFechaFin] = useState('');
  const [filterProveedor, setFilterProveedor] = useState('');
  const [filterProductoHistorial, setFilterProductoHistorial] = useState('');
  const [expandedEntrada, setExpandedEntrada] = useState(null);
  const [expandedProveedor, setExpandedProveedor] = useState(null);
  const [processingAnulacion, setProcessingAnulacion] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

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
    fetchProveedores();
  }, []);

  // Cargar historial de entradas cuando se cambia al tab de historial
  useEffect(() => {
    if (activeTab === 'historial') {
      fetchEntradas();
    }
  }, [activeTab]);

  // Calcular stock disponible (nunca muestra negativos)
  // Resta stockReservadoPedidos (pedidos POS listos), stockReservadoApartados y stockReservadoB2B
  // NO resta totalPrendasPedidas porque son prendas que aún no existen físicamente
  const calcularStockDisponible = (product) => {
    const disponible = (product.stockTotal || 0) - (product.stockReservadoPedidos || 0) - (product.stockReservadoApartados || 0) - (product.stockReservadoB2B || 0);
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

  // Obtener proveedores
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
    }
  };

  // Obtener historial de entradas de proveedor
  const fetchEntradas = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'stockEntries'),
        where('tipoEntrada', '==', 'proveedor')
      );
      const querySnapshot = await getDocs(q);
      const entradasData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por fecha (más reciente primero)
      entradasData.sort((a, b) => {
        const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return fechaB - fechaA;
      });

      setEntradas(entradasData);
      setFilteredEntradas(entradasData);
    } catch (error) {
      console.error('Error al cargar entradas:', error);
      alert('Error al cargar el historial de entradas.');
    } finally {
      setLoading(false);
    }
  };

  // Anular entrada de proveedor
  const handleAnularEntrada = async (entrada) => {
    const proveedor = proveedores.find(p => p.id === entrada.proveedorId);

    const detallesAnulacion = `
⚠️ ANULAR ENTRADA DE PROVEEDOR

Producto: ${entrada.nombre}
Referencia: ${entrada.referencia}
Talla: ${entrada.talla || 'Única'}
Cantidad: ${entrada.cantidad}
Proveedor: ${proveedor?.nombre || 'N/A'}
${entrada.facturaProveedor ? `Factura: ${entrada.facturaProveedor}` : ''}

Esta acción REVERTIRÁ:
- Stock del producto (-${entrada.cantidad} unidades)
${entrada.asignaciones?.length > 0 ? `- ${entrada.asignaciones.length} asignaciones a pedidos` : ''}

¿Está seguro de anular esta entrada?`;

    const confirmar = window.confirm(detallesAnulacion);
    if (!confirmar) return;

    // Pedir motivo de anulación
    const motivo = window.prompt('Ingrese el motivo de la anulación:');
    if (!motivo || !motivo.trim()) {
      alert('Debe ingresar un motivo para anular la entrada.');
      return;
    }

    setProcessingAnulacion(true);
    try {
      const batch = writeBatch(db);

      // 1. Revertir stock del producto
      // Bug 3: solo revertir lo que realmente entró al stockTotal — las defectuosas
      // nunca se sumaron. Para entradas legacy (sin cantidadBuena) caemos a cantidad.
      const cantidadParaRevertir = entrada.cantidadBuena ?? entrada.cantidad;
      const productRef = doc(db, 'products', entrada.productId);
      const productUpdate = {
        stockTotal: increment(-cantidadParaRevertir),
        updatedAt: serverTimestamp()
      };

      // Calcular cuánto stock reservado hay que revertir
      let cantidadReservadaPedidos = 0;
      let cantidadReservadaB2B = 0;

      if (entrada.asignaciones && entrada.asignaciones.length > 0) {
        entrada.asignaciones.forEach(asig => {
          // Bug 9: entradas legacy no tienen `tipo` — eran todas POS antes de B2B.
          const tipo = asig.tipo || 'pedido';
          if (tipo === 'pedido') {
            cantidadReservadaPedidos += asig.cantidad;
          } else if (tipo === 'pedido_b2b') {
            cantidadReservadaB2B += asig.cantidad;
          }
        });

        if (cantidadReservadaPedidos > 0) {
          productUpdate.stockReservadoPedidos = increment(-cantidadReservadaPedidos);
        }
        if (cantidadReservadaB2B > 0) {
          productUpdate.stockReservadoB2B = increment(-cantidadReservadaB2B);
        }
      }

      batch.update(productRef, productUpdate);

      // 2. Revertir asignaciones a pedidos
      if (entrada.asignaciones && entrada.asignaciones.length > 0) {
        for (const asig of entrada.asignaciones) {
          const tipo = asig.tipo || 'pedido'; // Bug 9: legacy
          // Reconstruye los identificadores para el matching. Las entradas viejas no
          // los persistían, así que caemos a los datos top-level de la entrada.
          const asigForMatching = (asig.referencia || asig.productoId || asig.descripcion)
            ? asig
            : {
                ...asig,
                referencia: entrada.referencia,
                talla: entrada.talla,
                productoId: entrada.productId,
                descripcion: entrada.nombre
              };

          if (tipo === 'pedido') {
            // PEDIDO POS
            const pedidoRef = doc(db, 'pedidos', asig.pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (pedidoSnap.exists()) {
              const pedidoData = pedidoSnap.data();
              const updatedItems = [...pedidoData.items];

              // Match con talla coercida + filtro anulado. Preferimos el row con
              // cantidadLista pendiente de revertir; si no hay, cae al primer match.
              const matchItem = (item) =>
                !item.anulado &&
                item.referencia === asigForMatching.referencia &&
                String(item.talla) === String(asigForMatching.talla);

              let itemIndex = updatedItems.findIndex(item =>
                matchItem(item) && (item.cantidadLista || 0) > 0
              );
              if (itemIndex === -1) {
                itemIndex = updatedItems.findIndex(matchItem);
              }

              if (itemIndex !== -1) {
                const item = updatedItems[itemIndex];
                const nuevaCantidadLista = Math.max(0, (item.cantidadLista || 0) - asig.cantidad);

                // Determinar nuevo estado
                let nuevoEstado;
                const cantidadEntregada = item.cantidadEntregada || 0;
                if (cantidadEntregada === item.cantidad) {
                  nuevoEstado = 'Entregado';
                } else if (nuevaCantidadLista + cantidadEntregada === item.cantidad) {
                  nuevoEstado = 'Listo para Entrega';
                } else if (nuevaCantidadLista > 0) {
                  nuevoEstado = 'Parcialmente Listo';
                } else {
                  nuevoEstado = 'En Producción';
                }

                updatedItems[itemIndex] = {
                  ...item,
                  cantidadLista: nuevaCantidadLista,
                  estadoItem: nuevoEstado
                };

                batch.update(pedidoRef, {
                  items: updatedItems,
                  updatedAt: serverTimestamp()
                });
              }
            }
          } else if (tipo === 'pedido_b2b') {
            // PEDIDO B2B
            const pedidoRef = doc(db, 'pedidos_b2b', asig.pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);

            if (pedidoSnap.exists()) {
              const pedidoData = pedidoSnap.data();
              const updatedProductos = [...pedidoData.productos];

              // Preferimos el row con alistamiento pendiente de revertir. Si todos
              // los matches están en 0 (porque ya se hizo envío que consumió la
              // alistada), cae al primer match para mantener compat.
              let prodIndex = updatedProductos.findIndex(p =>
                productoB2BCoincideConAsignacion(p, asigForMatching) &&
                getAlistadaActual(p) > 0
              );
              if (prodIndex === -1) {
                prodIndex = updatedProductos.findIndex(p =>
                  productoB2BCoincideConAsignacion(p, asigForMatching)
                );
              }

              if (prodIndex !== -1) {
                const producto = updatedProductos[prodIndex];
                const cantidadEnviadaProd = producto.cantidadEnviada || 0;
                const nuevaAlistadaActual = Math.max(0, (producto.cantidadAlistadaActual ?? Math.max(0, (producto.cantidadAlistada || 0) - cantidadEnviadaProd)) - asig.cantidad);
                const nuevaAlistadaTotal = Math.max(0, (producto.cantidadAlistadaTotal ?? (producto.cantidadAlistada || 0)) - asig.cantidad);
                const totalPreparado = nuevaAlistadaActual + cantidadEnviadaProd;

                updatedProductos[prodIndex] = {
                  ...producto,
                  cantidadAlistadaActual: nuevaAlistadaActual,
                  cantidadAlistadaTotal: nuevaAlistadaTotal,
                  cantidadAlistada: totalPreparado, // compat
                  estadoProduccion: totalPreparado >= producto.cantidad ? 'alistado' : (totalPreparado > 0 ? 'en_produccion' : 'pendiente')
                };

                batch.update(pedidoRef, {
                  productos: updatedProductos,
                  updatedAt: serverTimestamp()
                });
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
        motivoAnulacion: motivo.trim(),
        anuladaPor: currentUser?.email || currentUser?.uid || 'Admin'
      });

      // 4. Eliminar o anular la transacción asociada
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('entradaId', '==', entrada.id)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      transactionsSnapshot.docs.forEach(transDoc => {
        batch.update(transDoc.ref, {
          anulada: true,
          fechaAnulacion: serverTimestamp(),
          motivoAnulacion: motivo.trim()
        });
      });

      await batch.commit();

      alert(`✅ Entrada anulada exitosamente.\n\nSe han revertido:\n- Stock del producto: -${entrada.cantidad} unidades\n${entrada.asignaciones?.length > 0 ? `- ${entrada.asignaciones.length} asignación(es) a pedidos` : ''}`);

      // Recargar datos
      await fetchEntradas();
      await fetchProducts();

    } catch (error) {
      console.error('Error al anular entrada:', error);
      alert('Error al anular la entrada: ' + error.message);
    } finally {
      setProcessingAnulacion(false);
    }
  };

  // Filtrar entradas cuando cambian los filtros
  useEffect(() => {
    let filtered = [...entradas];

    // Filtro por proveedor
    if (filterProveedor) {
      filtered = filtered.filter(entrada => entrada.proveedorId === filterProveedor);
    }

    // Filtro por producto (nombre o referencia)
    if (filterProductoHistorial.trim()) {
      const search = filterProductoHistorial.toLowerCase();
      filtered = filtered.filter(entrada =>
        entrada.nombre?.toLowerCase().includes(search) ||
        entrada.referencia?.toLowerCase().includes(search)
      );
    }

    // Filtro por rango de fechas
    if (filterFechaInicio) {
      const fechaInicio = new Date(filterFechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      filtered = filtered.filter(entrada => {
        const fechaEntrada = entrada.createdAt?.toDate ? entrada.createdAt.toDate() : new Date(entrada.createdAt || 0);
        return fechaEntrada >= fechaInicio;
      });
    }

    if (filterFechaFin) {
      const fechaFin = new Date(filterFechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(entrada => {
        const fechaEntrada = entrada.createdAt?.toDate ? entrada.createdAt.toDate() : new Date(entrada.createdAt || 0);
        return fechaEntrada <= fechaFin;
      });
    }

    setFilteredEntradas(filtered);
  }, [filterProveedor, filterProductoHistorial, filterFechaInicio, filterFechaFin, entradas]);

  // FUNCIÓN ADMINISTRATIVA: Recalcular stockReservadoPedidos desde los pedidos activos
  const recalcularInventarioCompleto = async () => {
    const confirmar = window.confirm(
      '⚠️ RECALCULAR RESERVAS DE INVENTARIO\n\n' +
      'Esta función recalculará las reservas de TODOS los productos:\n' +
      '• totalPrendasPedidas (unidades pedidas pendientes de entrega)\n' +
      '• stockReservadoPedidos (desde pedidos POS activos)\n' +
      '• stockReservadoB2B (desde pedidos B2B activos)\n' +
      '• stockReservadoApartados (desde apartados activos)\n\n' +
      'NOTA: El stockTotal NO se modificará.\n\n' +
      '¿Deseas continuar?'
    );

    if (!confirmar) return;

    setLoading(true);
    try {
      console.log('🔄 Iniciando recálculo de reservas de inventario...');

      // PASO 1: Calcular stockReservadoPedidos y totalPrendasPedidas desde pedidos POS
      console.log('\n📦 PASO 1: Calculando stockReservadoPedidos y totalPrendasPedidas desde pedidos POS...');
      const pedidosSnapshot = await getDocs(collection(db, 'pedidos'));
      console.log(`   Total de pedidos encontrados: ${pedidosSnapshot.size}`);

      const stockReservadoPorProducto = {}; // { productoId: cantidadReservada }
      const totalPrendasPedidasPorProducto = {}; // { productoId: cantidadPedida }
      const detallesPorProducto = {}; // Para debugging

      // Contadores para estadísticas
      let pedidosRevisados = 0;
      let itemsEnProduccion = 0;
      let itemsParcialmenteListo = 0;
      let itemsListoParaEntrega = 0;
      let itemsEntregados = 0;
      let itemsAnulados = 0;

      pedidosSnapshot.forEach(docSnap => {
        const pedido = docSnap.data();
        const numeroPedido = pedido.numeroPedido;
        const estadoGeneral = pedido.estadoGeneral;
        const items = pedido.items || [];

        // Saltar pedidos anulados o cancelados
        if (estadoGeneral === 'Anulado' || estadoGeneral === 'Cancelado') {
          return;
        }

        pedidosRevisados++;

        items.forEach((item, index) => {
          // Validar que el item tenga los campos necesarios
          if (!item.productoId) {
            console.warn(`⚠️ Pedido #${numeroPedido} item ${index}: Sin productoId`);
            return;
          }

          const productoId = item.productoId;
          const estadoItem = item.estadoItem;
          const cantidadTotal = item.cantidad || 0;
          const cantidadLista = item.cantidadLista || 0;
          const cantidadEntregada = item.cantidadEntregada || 0;
          const anulado = item.anulado || false;

          // Contar por estado
          if (anulado) {
            itemsAnulados++;
            return; // Items anulados no cuentan
          }

          if (estadoItem === 'En Producción') itemsEnProduccion++;
          else if (estadoItem === 'Parcialmente Listo') itemsParcialmenteListo++;
          else if (estadoItem === 'Listo para Entrega') itemsListoParaEntrega++;
          else if (estadoItem === 'Entregado') itemsEntregados++;

          // totalPrendasPedidas = unidades aún en producción (no alistadas todavía).
          // cantidadLista ya tiene stock físico asignado → va a stockReservadoPedidos, no aquí.
          if (estadoItem !== 'Entregado') {
            const cantidadPendiente = Math.max(0, cantidadTotal - cantidadEntregada - cantidadLista);
            if (!totalPrendasPedidasPorProducto[productoId]) {
              totalPrendasPedidasPorProducto[productoId] = 0;
            }
            totalPrendasPedidasPorProducto[productoId] += cantidadPendiente;
          }

          // Calcular cuánto stock reserva este item
          let cantidadReservada = 0;

          if (estadoItem === 'Listo para Entrega') {
            cantidadReservada = Math.max(0, cantidadTotal - cantidadEntregada);
          } else if (estadoItem === 'Parcialmente Listo') {
            cantidadReservada = cantidadLista;
          } else if (estadoItem === 'En Producción') {
            cantidadReservada = 0;
          } else if (estadoItem === 'Entregado') {
            cantidadReservada = 0;
          } else {
            console.warn(`⚠️ Pedido #${numeroPedido}: Estado desconocido "${estadoItem}"`);
            cantidadReservada = 0;
          }

          // Sumar al total de este producto
          if (!stockReservadoPorProducto[productoId]) {
            stockReservadoPorProducto[productoId] = 0;
            detallesPorProducto[productoId] = [];
          }
          stockReservadoPorProducto[productoId] += cantidadReservada;

          if (cantidadReservada > 0) {
            detallesPorProducto[productoId].push({
              pedido: numeroPedido,
              estado: estadoItem,
              cantidad: cantidadReservada,
              ref: item.referencia,
              talla: item.talla
            });
          }
        });
      });

      console.log(`   Estadísticas de items POS:`);
      console.log(`     - En Producción: ${itemsEnProduccion}`);
      console.log(`     - Parcialmente Listo: ${itemsParcialmenteListo}`);
      console.log(`     - Listo para Entrega: ${itemsListoParaEntrega}`);
      console.log(`     - Entregados: ${itemsEntregados}`);
      console.log(`     - Anulados: ${itemsAnulados}`);

      // PASO 2: Calcular stockReservadoB2B desde pedidos B2B
      console.log('\n📦 PASO 2: Calculando stockReservadoB2B desde pedidos B2B...');
      const pedidosB2BSnapshot = await getDocs(collection(db, 'pedidos_b2b'));
      const stockReservadoB2BPorProducto = {}; // { productoId: cantidadReservada }

      pedidosB2BSnapshot.forEach(docSnap => {
        const pedido = docSnap.data();
        // B2B usa 'estado' (no 'estadoGeneral'). También respetar el flag 'anulado'.
        const estado = pedido.estado;
        const productos = pedido.productos || [];

        // Saltar pedidos anulados o ya finalizados
        if (pedido.anulado === true ||
            estado === 'Anulado' ||
            estado === 'Cancelado' ||
            estado === 'Completado' ||
            estado === 'Entregado') {
          return;
        }

        productos.forEach(producto => {
          const productoId = producto.productoId;
          if (!productoId) return;

          // Saltar productos anulados
          if (producto.anulado === true) return;

          // Reservar las unidades alistadas del ciclo actual (pendientes de envío)
          const cantidadEnviadaProd = producto.cantidadEnviada || 0;
          let alistadaActual = producto.cantidadAlistadaActual !== undefined
            ? producto.cantidadAlistadaActual
            : Math.max(0, (producto.cantidadAlistada || 0) - cantidadEnviadaProd);
          // Cap: no más que lo que realmente se puede enviar
          let maxPosible = Math.max(0, producto.cantidad - cantidadEnviadaProd);
          const cantRecibida = producto.cantidadRecibida || 0;
          if (cantRecibida > 0 && cantRecibida < cantidadEnviadaProd && cantRecibida < producto.cantidad) {
            maxPosible += (cantidadEnviadaProd - cantRecibida);
          }
          alistadaActual = Math.min(alistadaActual, maxPosible);

          if (alistadaActual > 0) {
            if (!stockReservadoB2BPorProducto[productoId]) {
              stockReservadoB2BPorProducto[productoId] = 0;
            }
            stockReservadoB2BPorProducto[productoId] += alistadaActual;
          }
        });
      });

      console.log(`   Pedidos B2B procesados: ${pedidosB2BSnapshot.size}`);

      // PASO 3: Calcular stockReservadoApartados desde apartados activos
      console.log('\n📦 PASO 3: Calculando stockReservadoApartados desde apartados...');
      const apartadosSnapshot = await getDocs(collection(db, 'apartados'));
      const stockReservadoApartadosPorProducto = {}; // { productoId: cantidadReservada }

      let apartadosActivos = 0;
      apartadosSnapshot.forEach(docSnap => {
        const apartado = docSnap.data();
        const estadoGeneral = apartado.estadoGeneral;

        // Solo contar apartados activos o vencidos (que aún tienen productos reservados)
        if (estadoGeneral === 'Activo' || estadoGeneral === 'Vencido') {
          apartadosActivos++;
          const items = apartado.items || [];

          items.forEach(item => {
            const productoId = item.productoId;
            if (!productoId) return;

            // Solo contar items que no estén anulados
            if (!item.anulado) {
              const cantidad = item.cantidad || 0;

              if (!stockReservadoApartadosPorProducto[productoId]) {
                stockReservadoApartadosPorProducto[productoId] = 0;
              }
              stockReservadoApartadosPorProducto[productoId] += cantidad;
            }
          });
        }
      });

      console.log(`   Apartados procesados: ${apartadosSnapshot.size}`);
      console.log(`   Apartados activos/vencidos: ${apartadosActivos}`);

      // PASO 4: Actualizar todos los productos (SOLO RESERVAS, NO stockTotal)
      console.log('\n📦 PASO 4: Actualizando reservas en la base de datos...');
      const productosSnapshot = await getDocs(collection(db, 'products'));

      let productosActualizados = 0;
      let productosConCambios = [];
      let totalPrendasCorregido = 0;
      let stockReservadoCorregido = 0;
      let stockB2BCorregido = 0;
      let stockApartadosCorregido = 0;

      // Acumular todas las operaciones antes de hacer commit
      // Firestore permite máx 500 writes por batch → dividir en chunks de 499
      const operaciones = [];

      productosSnapshot.forEach(docSnap => {
        const productoId = docSnap.id;
        const productoData = docSnap.data();

        const totalPrendasCalculado = totalPrendasPedidasPorProducto[productoId] || 0;
        const totalPrendasActual = productoData.totalPrendasPedidas || 0;

        const stockReservadoCalculado = stockReservadoPorProducto[productoId] || 0;
        const stockReservadoActual = productoData.stockReservadoPedidos || 0;

        const stockB2BCalculado = stockReservadoB2BPorProducto[productoId] || 0;
        const stockB2BActual = productoData.stockReservadoB2B || 0;

        const stockApartadosCalculado = stockReservadoApartadosPorProducto[productoId] || 0;
        const stockApartadosActual = productoData.stockReservadoApartados || 0;

        // Verificar si hay diferencias (SOLO en reservas, NO en stockTotal)
        const cambioTotalPrendas = totalPrendasCalculado !== totalPrendasActual;
        const cambioReservado = stockReservadoCalculado !== stockReservadoActual;
        const cambioB2B = stockB2BCalculado !== stockB2BActual;
        const cambioApartados = stockApartadosCalculado !== stockApartadosActual;

        if (cambioTotalPrendas || cambioReservado || cambioB2B || cambioApartados) {
          const productoRef = doc(db, 'products', productoId);
          const updates = { updatedAt: serverTimestamp() };

          if (cambioTotalPrendas) {
            updates.totalPrendasPedidas = totalPrendasCalculado;
            totalPrendasCorregido++;
          }
          if (cambioReservado) {
            updates.stockReservadoPedidos = stockReservadoCalculado;
            stockReservadoCorregido++;
          }
          if (cambioB2B) {
            updates.stockReservadoB2B = stockB2BCalculado;
            stockB2BCorregido++;
          }
          if (cambioApartados) {
            updates.stockReservadoApartados = stockApartadosCalculado;
            stockApartadosCorregido++;
          }

          operaciones.push({ productoRef, updates });
          productosActualizados++;

          // Guardar para el reporte
          productosConCambios.push({
            nombre: productoData.nombre,
            referencia: productoData.referencia,
            talla: productoData.talla,
            totalPrendas: {
              anterior: totalPrendasActual,
              nuevo: totalPrendasCalculado,
              cambio: cambioTotalPrendas
            },
            stockReservado: {
              anterior: stockReservadoActual,
              nuevo: stockReservadoCalculado,
              cambio: cambioReservado
            },
            stockB2B: {
              anterior: stockB2BActual,
              nuevo: stockB2BCalculado,
              cambio: cambioB2B
            },
            stockApartados: {
              anterior: stockApartadosActual,
              nuevo: stockApartadosCalculado,
              cambio: cambioApartados
            }
          });
        }
      });

      // Commit en chunks de 499 para respetar el límite de Firestore
      const CHUNK_SIZE = 499;
      for (let i = 0; i < operaciones.length; i += CHUNK_SIZE) {
        const chunk = operaciones.slice(i, i + CHUNK_SIZE);
        const batchChunk = writeBatch(db);
        chunk.forEach(({ productoRef, updates }) => batchChunk.update(productoRef, updates));
        await batchChunk.commit();
      }

      // Mostrar reporte detallado en consola
      console.log(`\n📝 REPORTE DE CAMBIOS (${productosConCambios.length} productos):`);
      productosConCambios.forEach(p => {
        console.log(`\n${p.referencia} ${p.talla} - ${p.nombre}`);
        if (p.totalPrendas.cambio) {
          console.log(`  totalPrendasPedidas: ${p.totalPrendas.anterior} → ${p.totalPrendas.nuevo}`);
        }
        if (p.stockReservado.cambio) {
          console.log(`  stockReservadoPedidos: ${p.stockReservado.anterior} → ${p.stockReservado.nuevo}`);
        }
        if (p.stockB2B.cambio) {
          console.log(`  stockReservadoB2B: ${p.stockB2B.anterior} → ${p.stockB2B.nuevo}`);
        }
        if (p.stockApartados.cambio) {
          console.log(`  stockReservadoApartados: ${p.stockApartados.anterior} → ${p.stockApartados.nuevo}`);
        }
      });

      alert(
        `✅ RESERVAS RECALCULADAS EXITOSAMENTE\n\n` +
        `📊 RESUMEN:\n` +
        `   • Pedidos POS revisados: ${pedidosRevisados}\n` +
        `   • Pedidos B2B revisados: ${pedidosB2BSnapshot.size}\n` +
        `   • Apartados revisados: ${apartadosSnapshot.size} (${apartadosActivos} activos)\n\n` +
        `🔧 CORRECCIONES APLICADAS:\n` +
        `   • totalPrendasPedidas corregido: ${totalPrendasCorregido} productos\n` +
        `   • stockReservadoPedidos corregido: ${stockReservadoCorregido} productos\n` +
        `   • stockReservadoB2B corregido: ${stockB2BCorregido} productos\n` +
        `   • stockReservadoApartados corregido: ${stockApartadosCorregido} productos\n\n` +
        `📝 Total productos actualizados: ${productosActualizados}\n` +
        `📝 Total productos revisados: ${productosSnapshot.size}\n\n` +
        `ℹ️ El stockTotal NO fue modificado.\n\n` +
        `Revisa la consola (F12) para ver el detalle completo de cambios.`
      );

      // Recargar productos
      await fetchProducts();

    } catch (error) {
      console.error('Error al recalcular inventario:', error);
      alert('❌ Error al recalcular inventario: ' + error.message);
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

  // Verificar si la referencia ya existe.
  // Bug 10: al editar también hay que validar — si no, se pueden crear duplicados
  // ref+talla cambiando la referencia de un producto existente. excludeId permite
  // ignorar el propio producto al editar.
  const checkReferenciaExists = async (referencia, excludeId = null) => {
    const q = query(collection(db, 'products'), where('referencia', '==', referencia));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return false;
    if (!excludeId) return true;
    return querySnapshot.docs.some(d => d.id !== excludeId);
  };

  // Guardar producto (crear o actualizar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.referencia.trim() || !formData.nombre.trim() || !formData.colegio.trim() || !formData.talla.trim()) {
      alert('Por favor, completa todos los campos requeridos.');
      return;
    }

    // Prevenir doble clic
    if (guardandoProducto) return;
    setGuardandoProducto(true);

    setLoading(true);
    try {
      if (editingProduct) {
        // Bug 10: si la referencia cambió, validar que no choque con otro producto
        const referenciaTrimmed = formData.referencia.trim();
        if (referenciaTrimmed !== (editingProduct.referencia || '').trim()) {
          const existsOther = await checkReferenciaExists(referenciaTrimmed, editingProduct.id);
          if (existsOther) {
            alert(`Ya existe otro producto con la referencia "${referenciaTrimmed}". No se puede crear un duplicado — esto causaría descuadres en el inventario.`);
            setLoading(false);
            setGuardandoProducto(false);
            return;
          }
        }
        // Actualizar producto existente
        const productRef = doc(db, 'products', editingProduct.id);

        // Chequeo de concurrencia optimista: si el producto fue mutado por otro
        // flujo (POS, satélite, entrega, anulación…) mientras este modal estaba
        // abierto, abortamos para no pisar el stockTotal/reservas con valores
        // viejos del formulario. Solo aplica si tenemos updatedAt confiable.
        const originalUpdatedAt = editingProduct.updatedAt;
        if (originalUpdatedAt?.toMillis) {
          const freshSnap = await getDoc(productRef);
          if (!freshSnap.exists()) {
            alert('Este producto ya no existe en el sistema.');
            setLoading(false);
            setGuardandoProducto(false);
            return;
          }
          const freshData = freshSnap.data();
          const freshUpdatedAt = freshData.updatedAt;
          if (freshUpdatedAt?.toMillis && freshUpdatedAt.toMillis() !== originalUpdatedAt.toMillis()) {
            const stockCambio = freshData.stockTotal !== editingProduct.stockTotal
              ? `\n\nstockTotal cambió de ${editingProduct.stockTotal} a ${freshData.stockTotal} mientras editabas.`
              : '';
            alert(
              '⚠️ Otro usuario o un proceso (POS, entrada de satélite, entrega, anulación) modificó este producto mientras lo estabas editando.\n\n' +
              'No se guardaron los cambios para no sobrescribir valores actuales.' +
              stockCambio +
              '\n\nCierra el modal, refresca la página y vuelve a intentar.'
            );
            setLoading(false);
            setGuardandoProducto(false);
            return;
          }
        }

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
          stockReservadoB2B: 0,
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
      setGuardandoProducto(false);
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
      // Chequeo de referencias activas antes de borrar. Si el producto está
      // dentro de un pedido / apartado / B2B vivo, no podemos eliminarlo —
      // dejaría productoId huérfanos en items que romperían anulaciones,
      // entregas, devoluciones y recálculos de stock.
      const referenciasActivas = await encontrarReferenciasActivas(id);
      if (referenciasActivas.total > 0) {
        const detalles = [];
        if (referenciasActivas.pedidos.length > 0) {
          detalles.push(`• ${referenciasActivas.pedidos.length} pedido(s) POS activo(s): ${referenciasActivas.pedidos.slice(0, 5).join(', ')}${referenciasActivas.pedidos.length > 5 ? '…' : ''}`);
        }
        if (referenciasActivas.pedidosB2B.length > 0) {
          detalles.push(`• ${referenciasActivas.pedidosB2B.length} pedido(s) B2B activo(s): ${referenciasActivas.pedidosB2B.slice(0, 5).join(', ')}${referenciasActivas.pedidosB2B.length > 5 ? '…' : ''}`);
        }
        if (referenciasActivas.apartados.length > 0) {
          detalles.push(`• ${referenciasActivas.apartados.length} apartado(s) activo(s): ${referenciasActivas.apartados.slice(0, 5).join(', ')}${referenciasActivas.apartados.length > 5 ? '…' : ''}`);
        }
        alert(
          `❌ No se puede eliminar "${nombre}".\n\n` +
          `Está referenciado en operaciones activas:\n\n` +
          detalles.join('\n') +
          `\n\nDebes anular/cancelar/completar esas operaciones antes de eliminar el producto.\n\n` +
          `Si necesitas "ocultar" el producto sin afectar el historial, considera marcarlo como inactivo en lugar de eliminarlo.`
        );
        setLoading(false);
        return;
      }

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

  // Busca pedidos / pedidos_b2b / apartados activos que contengan referencias
  // al producto. Devuelve los numeroPedido/numeroApartado encontrados.
  const encontrarReferenciasActivas = async (productoId) => {
    const pedidosRef = [];
    const pedidosB2BRef = [];
    const apartadosRef = [];

    // Pedidos POS — excluir Anulado/Cancelado
    const pedidosSnap = await getDocs(collection(db, 'pedidos'));
    pedidosSnap.forEach(docSnap => {
      const pedido = docSnap.data();
      if (pedido.estadoGeneral === 'Anulado' || pedido.estadoGeneral === 'Cancelado') return;
      const items = pedido.items || [];
      const tieneRef = items.some(item =>
        item.productoId === productoId && !item.anulado && item.estadoItem !== 'Entregado'
      );
      if (tieneRef) pedidosRef.push(`#${String(pedido.numeroPedido || '?').padStart(4, '0')}`);
    });

    // Pedidos B2B — excluir Anulado/Cancelado/Completado/Entregado
    const b2bSnap = await getDocs(collection(db, 'pedidos_b2b'));
    b2bSnap.forEach(docSnap => {
      const pedido = docSnap.data();
      if (pedido.anulado === true) return;
      const estado = pedido.estado;
      if (estado === 'Anulado' || estado === 'Cancelado' || estado === 'Completado' || estado === 'Entregado') return;
      const productos = pedido.productos || [];
      const tieneRef = productos.some(p => p.productoId === productoId && !p.anulado);
      if (tieneRef) pedidosB2BRef.push(`#${String(pedido.numeroPedido || '?').padStart(4, '0')}`);
    });

    // Apartados — solo Activo/Vencido
    const apartadosSnap = await getDocs(collection(db, 'apartados'));
    apartadosSnap.forEach(docSnap => {
      const apartado = docSnap.data();
      if (apartado.estadoGeneral !== 'Activo' && apartado.estadoGeneral !== 'Vencido') return;
      const items = apartado.items || [];
      const tieneRef = items.some(item => item.productoId === productoId && !item.anulado);
      if (tieneRef) apartadosRef.push(`#${String(apartado.numeroApartado || '?').padStart(4, '0')}`);
    });

    return {
      pedidos: pedidosRef,
      pedidosB2B: pedidosB2BRef,
      apartados: apartadosRef,
      total: pedidosRef.length + pedidosB2BRef.length + apartadosRef.length
    };
  };

  // Activar input de archivo
  const handleImportClick = () => {
    // Security: la librería xlsx tiene CVEs sin parche (prototype pollution + ReDoS).
    // El parseo solo es seguro si confiamos en el origen del archivo.
    const confirmar = window.confirm(
      '⚠️ IMPORTACIÓN DE INVENTARIO\n\n' +
      'Por seguridad, importa únicamente archivos .xlsx generados por este sistema o por una fuente de confianza.\n\n' +
      'No abras archivos enviados por terceros o descargados de internet sin verificar — un archivo malicioso podría afectar tu navegador.\n\n' +
      '¿Continuar?'
    );
    if (!confirmar) return;
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
          stockReservadoB2B: 0,
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
              onClick={recalcularInventarioCompleto}
              disabled={loading}
              style={{ backgroundColor: '#4CAF50' }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              title="Recalcular inventario completo: stockTotal desde entradas, stockReservadoPedidos desde pedidos POS, stockReservadoB2B desde pedidos B2B, y stockReservadoApartados desde apartados activos"
            >
              <span className="hidden sm:inline">🔄 Recalcular Inventario</span>
              <span className="sm:hidden">🔄 Recalc.</span>
            </button>
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

      {/* Pestañas */}
      <div className="bg-white rounded-lg shadow-md mb-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('inventario')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'inventario'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            📦 Inventario de Productos
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === 'historial'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            📋 Historial de Entradas de Proveedor
          </button>
        </div>
      </div>

      {/* CONTENIDO TAB: INVENTARIO */}
      {activeTab === 'inventario' && (
        <>
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
                          <p className="text-gray-500 mb-1">Res. B2B</p>
                          <p className="font-medium text-pink-600">{product.stockReservadoB2B || 0}</p>
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
                      Res. B2B
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
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-pink-600 font-medium">
                        {product.stockReservadoB2B || 0}
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
        </>
      )}

      {/* CONTENIDO TAB: HISTORIAL DE ENTRADAS */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {/* Filtros de búsqueda */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtros de Búsqueda</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtro por Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor
                </label>
                <select
                  value={filterProveedor}
                  onChange={(e) => setFilterProveedor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                >
                  <option value="">Todos los proveedores</option>
                  {proveedores.map(prov => (
                    <option key={prov.id} value={prov.id}>
                      {prov.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Producto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto
                </label>
                <input
                  type="text"
                  value={filterProductoHistorial}
                  onChange={(e) => setFilterProductoHistorial(e.target.value)}
                  placeholder="Buscar por nombre o referencia..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                />
              </div>

              {/* Filtro por Fecha Inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={filterFechaInicio}
                  onChange={(e) => setFilterFechaInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                />
              </div>

              {/* Filtro por Fecha Fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={filterFechaFin}
                  onChange={(e) => setFilterFechaFin(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                />
              </div>
            </div>

            {/* Botón limpiar filtros */}
            {(filterProveedor || filterProductoHistorial || filterFechaInicio || filterFechaFin) && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setFilterProveedor('');
                    setFilterProductoHistorial('');
                    setFilterFechaInicio('');
                    setFilterFechaFin('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Limpiar Filtros
                </button>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Total de Entradas</p>
                <p className="text-2xl font-bold text-blue-700">{filteredEntradas.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Total de Prendas</p>
                <p className="text-2xl font-bold text-green-700">
                  {filteredEntradas.reduce((sum, e) => sum + (e.cantidad || 0), 0)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-sm text-gray-600 mb-1">Costo Total</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatPrice(filteredEntradas.reduce((sum, e) => sum + (e.costoTotal || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de entradas agrupadas por proveedor */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">Cargando historial de entradas...</p>
            </div>
          ) : filteredEntradas.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No se encontraron entradas de proveedor.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agrupar entradas por proveedor */}
              {(() => {
                // Agrupar por proveedor
                const entradasPorProveedor = new Map();
                filteredEntradas.forEach(entrada => {
                  const provId = entrada.proveedorId || 'sin-proveedor';
                  if (!entradasPorProveedor.has(provId)) {
                    entradasPorProveedor.set(provId, {
                      proveedorId: provId,
                      entradas: [],
                      totalPrendas: 0,
                      totalCosto: 0
                    });
                  }
                  const grupo = entradasPorProveedor.get(provId);
                  grupo.entradas.push(entrada);
                  grupo.totalPrendas += entrada.cantidad || 0;
                  grupo.totalCosto += entrada.costoTotal || 0;
                });

                // Convertir a array y ordenar por nombre de proveedor
                const gruposArray = Array.from(entradasPorProveedor.values()).map(grupo => {
                  const prov = proveedores.find(p => p.id === grupo.proveedorId);
                  return {
                    ...grupo,
                    proveedorNombre: prov?.nombre || 'Proveedor desconocido'
                  };
                }).sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));

                return gruposArray.map(grupo => (
                  <div key={grupo.proveedorId} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Header del proveedor - Colapsable */}
                    <div
                      onClick={() => setExpandedProveedor(expandedProveedor === grupo.proveedorId ? null : grupo.proveedorId)}
                      className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">
                          🏢 {grupo.proveedorNombre}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {grupo.entradas.length} entrada{grupo.entradas.length !== 1 ? 's' : ''} • {grupo.totalPrendas} prendas
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Costo Total</p>
                          <p className="text-lg font-bold text-purple-700">
                            {formatPrice(grupo.totalCosto)}
                          </p>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600 text-xl">
                          {expandedProveedor === grupo.proveedorId ? '▼' : '▶'}
                        </button>
                      </div>
                    </div>

                    {/* Entradas del proveedor (expandidas) */}
                    {expandedProveedor === grupo.proveedorId && (
                      <div className="border-t border-gray-200 divide-y divide-gray-100">
                        {grupo.entradas.map((entrada) => {
                          const fechaEntrada = entrada.createdAt?.toDate ? entrada.createdAt.toDate() : new Date(entrada.createdAt || 0);
                          const isExpanded = expandedEntrada === entrada.id;

                          return (
                            <div key={entrada.id} className={`hover:bg-gray-50 transition-colors ${entrada.anulada ? 'opacity-60' : ''}`}>
                              {/* Cabecera de la entrada */}
                              <div
                                className="p-4 cursor-pointer"
                                onClick={() => setExpandedEntrada(isExpanded ? null : entrada.id)}
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-start gap-3">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-semibold text-gray-900 truncate">
                                          {entrada.nombre}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">
                                            Ref: {entrada.referencia}
                                          </span>
                                          <span>•</span>
                                          <span>Talla: {entrada.talla}</span>
                                          <span>•</span>
                                          <span className="font-medium text-blue-600">
                                            {entrada.cantidad} uds
                                          </span>
                                          {entrada.facturaProveedor && (
                                            <>
                                              <span>•</span>
                                              <span className="text-gray-500">📄 {entrada.facturaProveedor}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-gray-900">
                                        {formatPrice(entrada.costoTotal || 0)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {fechaEntrada.toLocaleDateString('es-CO', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </p>
                                    </div>

                                    {/* Botón Anular - Solo si no está anulada */}
                                    {!entrada.anulada && isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAnularEntrada(entrada);
                                        }}
                                        disabled={processingAnulacion}
                                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                        title="Anular esta entrada"
                                      >
                                        {processingAnulacion && <Loader2 size={12} className="animate-spin" />}
                                        {processingAnulacion ? 'Anulando...' : 'Anular'}
                                      </button>
                                    )}
                                    {entrada.anulada && (
                                      <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                                        ANULADA
                                      </span>
                                    )}
                                    <button className="text-gray-400 hover:text-gray-600">
                                      {isExpanded ? '▼' : '▶'}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Detalles expandidos */}
                              {isExpanded && (
                                <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Distribución */}
                                    <div className="space-y-3">
                                      <h5 className="font-semibold text-gray-800">📊 Distribución</h5>
                                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm text-gray-600">Asignadas a pedidos:</span>
                                          <span className="font-semibold text-green-600">
                                            {entrada.cantidadAsignada || 0} uds
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">Disponibles para venta:</span>
                                          <span className="font-semibold text-blue-600">
                                            {entrada.cantidadDisponible || 0} uds
                                          </span>
                                        </div>
                                      </div>

                                      {/* Notas */}
                                      {entrada.notas && (
                                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                          <p className="text-sm font-semibold text-gray-700 mb-1">📝 Notas:</p>
                                          <p className="text-sm text-gray-600">{entrada.notas}</p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Asignaciones a pedidos */}
                                    {entrada.asignaciones && entrada.asignaciones.length > 0 && (
                                      <div className="space-y-3">
                                        <h5 className="font-semibold text-gray-800">
                                          ✅ Asignaciones a Pedidos ({entrada.asignaciones.length})
                                        </h5>
                                        <div className="bg-white rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                                          {entrada.asignaciones.map((asig, idx) => (
                                            <div
                                              key={idx}
                                              className="p-3 border-b border-gray-100 last:border-b-0"
                                            >
                                              <div className="flex justify-between items-start">
                                                <div>
                                                  <p className="font-semibold text-gray-900">
                                                    Pedido #{String(asig.numeroPedido).padStart(4, '0')}
                                                  </p>
                                                  <p className="text-sm text-gray-600">{asig.clienteNombre}</p>
                                                </div>
                                                <span className="text-lg font-bold text-green-600">
                                                  {asig.cantidad}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

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
                  disabled={loading || guardandoProducto}
                  style={{ backgroundColor: '#D50565' }}
                  className="px-6 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {guardandoProducto && <Loader2 size={18} className="animate-spin" />}
                  {guardandoProducto ? 'Guardando...' : 'Guardar Producto'}
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
