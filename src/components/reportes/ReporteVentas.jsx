import { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import {
  Download,
  Calendar,
  TrendingUp,
  Filter,
  Package,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

const TALLA_ORDEN = [
  '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20',
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
];

const sortTallas = (a, b) => {
  const ia = TALLA_ORDEN.indexOf(a);
  const ib = TALLA_ORDEN.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

const CLIENTE_GENERAL_KEY = '__general__';

const ReporteVentas = () => {
  // Control de acceso: solo admin ve cifras en pesos (subtotales, recaudado,
  // costo, utilidad, margen). El vendedor ve únicamente CANTIDADES por prenda
  // para planear inventario/producción.
  const { isAdmin } = useAuth();
  const puedeVerDinero = isAdmin;

  // Filtros de consulta (afectan a Firestore)
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [fuenteVenta, setFuenteVenta] = useState('todas');

  // Filtros cliente-side (se re-aplican sin consultar)
  const [clienteId, setClienteId] = useState('');
  const [productoFiltro, setProductoFiltro] = useState('');
  const [talla, setTalla] = useState('');
  const [metodoPago, setMetodoPago] = useState('todos');
  const [colegioId, setColegioId] = useState('');
  // Vista por defecto: "Totales por Producto" (limpia, una columna de cantidad).
  // La matriz Producto × Talla queda disponible en el selector para planear producción.
  const [agrupacion, setAgrupacion] = useState('producto');

  // Datos
  const [loading, setLoading] = useState(false);
  const [ventasCrudas, setVentasCrudas] = useState(null); // null = no se ha generado
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [colegios, setColegios] = useState([]);

  // Orden y paginación
  const [sortConfig, setSortConfig] = useState({ key: 'totalCantidad', direction: 'desc' });
  const [paginaActual, setPaginaActual] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(50);

  // Snapshot de los filtros de consulta al generar (para detectar cambios pendientes)
  const [consultaGenerada, setConsultaGenerada] = useState(null);

  useEffect(() => {
    loadCatalogos();
  }, []);

  const loadCatalogos = async () => {
    try {
      const [clientesSnap, productosSnap, colegiosSnap] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'colegios'))
      ]);
      setClientes(clientesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProductos(productosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setColegios(colegiosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error al cargar catálogos:', error);
    }
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    const localDate = new Date(date.getTime());
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    return localDate.toISOString().split('T')[0];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const setPresetDate = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'hoy':
        setStartDate(today);
        setEndDate(today);
        break;
      case 'ayer': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(yesterday);
        setEndDate(yesterday);
        break;
      }
      case 'semana': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(weekAgo);
        setEndDate(today);
        break;
      }
      case 'mes': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(monthAgo);
        setEndDate(today);
        break;
      }
    }
  };

  // Clientes ordenados alfabéticamente
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [clientes]
  );

  // Colegios ordenados alfabéticamente
  const colegiosOrdenados = useMemo(
    () => [...colegios].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [colegios]
  );

  // Productos ordenados alfabéticamente para el datalist
  const productosOrdenados = useMemo(
    () => [...productos].sort((a, b) => (a.referencia || '').localeCompare(b.referencia || '')),
    [productos]
  );

  // Tallas presentes en las ventas crudas (para poblar el selector)
  const tallasDisponibles = useMemo(() => {
    if (!ventasCrudas) return [];
    const set = new Set();
    ventasCrudas.forEach(v => { if (v.talla) set.add(v.talla); });
    return Array.from(set).sort(sortTallas);
  }, [ventasCrudas]);

  const generarReporte = async () => {
    const diasRango = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diasRango > 90) {
      const ok = window.confirm(
        `El rango seleccionado es de ${diasRango} días. Puede tardar y consumir muchos datos. ¿Continuar?`
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);

      const todasLasVentas = [];

      // Mapas de productos (productoId tiene prioridad, referencia como fallback)
      // Incluimos colegio para poder filtrar items POS por colegio del producto.
      const productosByIdMap = {};
      const productosByRefMap = {};
      productos.forEach(p => {
        const info = {
          costoCompra: p.costoCompra || 0,
          costoSatelite: p.costoSatelite || 0,
          colegio: p.colegio || '' // código del colegio (ej. 'MA', 'GD')
        };
        if (p.id) productosByIdMap[p.id] = info;
        if (p.referencia && !productosByRefMap[p.referencia]) {
          productosByRefMap[p.referencia] = info;
        }
      });

      const calcularCosto = (venta) => {
        const info = productosByIdMap[venta.productoId]
          || productosByRefMap[venta.referencia]
          || {};
        const costoUnitario = info.costoCompra || info.costoSatelite || 0;
        const costoTotal = costoUnitario * venta.cantidad;
        const utilidad = venta.subtotal - costoTotal;
        const margen = venta.subtotal > 0 ? (utilidad / venta.subtotal) * 100 : 0;
        return { costoUnitario, costoTotal, utilidad, margen };
      };

      const resumenMetodosPago = (abonos = []) => {
        const metodos = abonos.map(a => a?.metodoPago).filter(Boolean);
        const unicos = [...new Set(metodos)];
        return {
          metodosPagoArr: unicos,
          metodoPagoStr: unicos.join(', ') || 'N/A'
        };
      };

      // Mapa colegio codigo -> nombre para B2B
      const colegioCodigoANombre = {};
      colegios.forEach(c => {
        if (c.codigo) colegioCodigoANombre[c.codigo] = c.nombre || c.codigo;
      });

      // Colegio seleccionado: obtenemos código y nombre para optimizar consultas
      const colegioSel = colegioId ? colegios.find(c => c.id === colegioId) : null;
      const codigoColegioSel = colegioSel?.codigo || '';

      // VENTAS POS: SÍ se consultan aunque haya colegio filtrado.
      // Las facturas POS no guardan colegio, pero los PRODUCTOS sí — así que
      // filtramos cada ítem por el colegio del producto (lookup en el mapa).
      const consultarPOS = fuenteVenta === 'todas' || fuenteVenta === 'pos';

      // 1. VENTAS POS
      if (consultarPOS) {
        const salesQuery = query(
          collection(db, 'sales'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const salesSnap = await getDocs(salesQuery);

        salesSnap.forEach(doc => {
          const sale = doc.data();
          // Excluir facturas de pedidos (ya se cuentan en 'pedidos')
          if (sale.tipo === 'pedido') return;

          const metodo = sale.metodoPago || 'Efectivo';

          sale.items?.forEach(item => {
            // Resolver colegio del producto via el mapa (productoId o referencia)
            const prodInfo = productosByIdMap[item.productoId]
              || productosByRefMap[item.referencia]
              || {};
            const prodColegio = prodInfo.colegio || '';

            // Si el usuario filtró un colegio, solo incluir items cuyo producto
            // pertenezca a ese colegio. Si no hay filtro, incluir todo.
            if (codigoColegioSel && prodColegio !== codigoColegioSel) return;

            const subtotalItem = item.subtotal || 0;
            const base = {
              fecha: sale.createdAt.toDate(),
              fuente: 'POS',
              numeroDocumento: sale.numeroFactura || 0,
              clienteId: sale.clienteId || '',
              clienteNombre: sale.clienteNombre || 'Cliente General',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem,
              montoRecibido: subtotalItem,
              metodoPago: metodo,
              metodosPagoArr: [metodo],
              colegioId: '',
              colegioCodigo: prodColegio,
              colegioNombre: colegioCodigoANombre[prodColegio] || ''
            };
            todasLasVentas.push({ ...base, ...calcularCosto(base) });
          });
        });
      }

      // 2. PEDIDOS
      if (fuenteVenta === 'todas' || fuenteVenta === 'pedidos') {
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const pedidosSnap = await getDocs(pedidosQuery);

        pedidosSnap.forEach(doc => {
          const pedido = doc.data();

          // Excluir pedidos completamente anulados/cancelados.
          // Pedidos POS usan `estadoGeneral` (no `estado`).
          if (pedido.estadoGeneral === 'Anulado' ||
              pedido.estadoGeneral === 'Cancelado' ||
              pedido.anulado === true) return;

          const totalPedido = pedido.total || 0;
          const totalAbonado = pedido.totalAbonado || 0;
          const proporcionAbonada = totalPedido > 0 ? totalAbonado / totalPedido : 0;
          const { metodosPagoArr, metodoPagoStr } = resumenMetodosPago(pedido.abonos);

          const itemsValidos = (pedido.items || []).filter(
            item => !item.anulado && item.estadoItem !== 'Cambio de Talla'
          );

          itemsValidos.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const base = {
              fecha: pedido.createdAt.toDate(),
              fuente: 'Pedido',
              numeroDocumento: pedido.numeroPedido || 0,
              clienteId: pedido.clienteId || '',
              clienteNombre: pedido.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precio || 0,
              subtotal: subtotalItem,
              montoRecibido: subtotalItem * proporcionAbonada,
              metodoPago: metodoPagoStr,
              metodosPagoArr,
              colegioId: pedido.colegioId || '',
              colegioCodigo: pedido.codigoColegio || '',
              colegioNombre: pedido.colegioNombre || ''
            };
            todasLasVentas.push({ ...base, ...calcularCosto(base) });
          });
        });
      }

      // 3. PEDIDOS B2B
      if (fuenteVenta === 'todas' || fuenteVenta === 'pedidosB2B') {
        const b2bConstraints = [
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        ];
        if (codigoColegioSel) {
          b2bConstraints.push(where('codigoColegio', '==', codigoColegioSel));
        }
        const pedidosB2BQuery = query(collection(db, 'pedidos_b2b'), ...b2bConstraints);
        const pedidosB2BSnap = await getDocs(pedidosB2BQuery);

        pedidosB2BSnap.forEach(doc => {
          const pedido = doc.data();

          if (pedido.estado === 'Anulado' || pedido.anulado === true) return;

          const totalPedido = pedido.total || 0;
          const totalAbonado = (pedido.abonos || []).reduce(
            (sum, a) => sum + (a.monto || 0),
            0
          );
          const proporcionAbonada = totalPedido > 0 ? totalAbonado / totalPedido : 0;
          const { metodosPagoArr, metodoPagoStr } = resumenMetodosPago(pedido.abonos);

          const codigoCol = pedido.codigoColegio || '';
          const nombreCol = colegioCodigoANombre[codigoCol] || codigoCol;

          pedido.productos?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const base = {
              fecha: pedido.createdAt.toDate(),
              fuente: 'Pedido B2B',
              numeroDocumento: pedido.numeroPedido || 0,
              clienteId: pedido.clienteId || '',
              clienteNombre: pedido.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.descripcion || '',
              referencia: item.codigo || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem,
              montoRecibido: subtotalItem * proporcionAbonada,
              metodoPago: metodoPagoStr,
              metodosPagoArr,
              colegioId: '',
              colegioCodigo: codigoCol,
              colegioNombre: nombreCol
            };
            todasLasVentas.push({ ...base, ...calcularCosto(base) });
          });
        });
      }

      // 4. APARTADOS
      if (fuenteVenta === 'todas' || fuenteVenta === 'apartados') {
        const apartadosQuery = query(
          collection(db, 'apartados'),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        const apartadosSnap = await getDocs(apartadosQuery);

        apartadosSnap.forEach(doc => {
          const apartado = doc.data();

          // Apartados usan `estadoGeneral` (no `estado`). Excluir cancelados
          // y eliminados — esos no representan ventas reales.
          if (apartado.estadoGeneral === 'Cancelado' ||
              apartado.estadoGeneral === 'Eliminado' ||
              apartado.estadoGeneral === 'Anulado' ||
              apartado.anulado === true) return;

          const totalApartado = apartado.totalApartado || 0;
          const totalAbonado = apartado.totalAbonado || 0;
          const proporcionAbonada = totalApartado > 0 ? totalAbonado / totalApartado : 0;
          const { metodosPagoArr, metodoPagoStr } = resumenMetodosPago(apartado.historialAbonos);

          apartado.items?.forEach(item => {
            const subtotalItem = item.subtotal || 0;
            const base = {
              fecha: apartado.createdAt.toDate(),
              fuente: 'Apartado',
              numeroDocumento: apartado.numeroApartado || 0,
              clienteId: apartado.clienteId || '',
              clienteNombre: apartado.clienteNombre || '',
              productoId: item.productoId || '',
              productoNombre: item.nombre || '',
              referencia: item.referencia || '',
              talla: item.talla || '',
              cantidad: item.cantidad || 0,
              precioUnitario: item.precioUnitario || 0,
              subtotal: subtotalItem,
              montoRecibido: subtotalItem * proporcionAbonada,
              metodoPago: metodoPagoStr,
              metodosPagoArr,
              colegioId: apartado.colegioId || '',
              colegioCodigo: '',
              colegioNombre: apartado.colegioNombre || ''
            };
            todasLasVentas.push({ ...base, ...calcularCosto(base) });
          });
        });
      }

      setVentasCrudas(todasLasVentas);
      setConsultaGenerada({
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        fuenteVenta,
        colegioId,
        clienteId
      });
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('Error al generar reporte: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  // Detectar si los filtros de consulta cambiaron desde el último fetch
  const filtrosConsultaCambiados = useMemo(() => {
    if (!consultaGenerada) return false;
    return (
      consultaGenerada.startDate !== startDate.getTime() ||
      consultaGenerada.endDate !== endDate.getTime() ||
      consultaGenerada.fuenteVenta !== fuenteVenta ||
      consultaGenerada.colegioId !== colegioId ||
      consultaGenerada.clienteId !== clienteId
    );
  }, [consultaGenerada, startDate, endDate, fuenteVenta, colegioId, clienteId]);

  // ---- Filtros cliente-side ----
  const ventasFiltradas = useMemo(() => {
    if (!ventasCrudas) return [];
    let res = ventasCrudas;

    if (clienteId === CLIENTE_GENERAL_KEY) {
      res = res.filter(v => !v.clienteId);
    } else if (clienteId) {
      res = res.filter(v => v.clienteId === clienteId);
    }

    const q = productoFiltro.trim().toLowerCase();
    if (q) {
      res = res.filter(v =>
        (v.referencia || '').toLowerCase().includes(q) ||
        (v.productoNombre || '').toLowerCase().includes(q)
      );
    }

    if (talla) {
      res = res.filter(v => v.talla === talla);
    }

    if (metodoPago !== 'todos') {
      res = res.filter(v => v.metodosPagoArr?.includes(metodoPago));
    }

    if (colegioId) {
      const c = colegios.find(col => col.id === colegioId);
      const nombre = c?.nombre || '';
      const codigo = c?.codigo || '';
      res = res.filter(v =>
        v.colegioId === colegioId ||
        (codigo && v.colegioCodigo === codigo) ||
        (nombre && v.colegioNombre === nombre)
      );
    }

    return res;
  }, [ventasCrudas, clienteId, productoFiltro, talla, metodoPago, colegioId, colegios]);

  // ---- Totales ----
  const totales = useMemo(() => {
    const t = {
      cantidadTotal: 0,
      ventasTotal: 0,
      montoRecibidoTotal: 0,
      costoTotal: 0,
      utilidadTotal: 0,
      margenPromedio: 0,
      totalRegistros: ventasFiltradas.length
    };
    ventasFiltradas.forEach(v => {
      t.cantidadTotal += v.cantidad;
      t.ventasTotal += v.subtotal;
      t.montoRecibidoTotal += v.montoRecibido;
      t.costoTotal += v.costoTotal;
      t.utilidadTotal += v.utilidad;
    });
    t.margenPromedio = t.ventasTotal > 0
      ? (t.utilidadTotal / t.ventasTotal) * 100
      : 0;
    return t;
  }, [ventasFiltradas]);

  // ---- Tallas para la matriz ----
  const tallasMatriz = useMemo(() => {
    if (agrupacion !== 'matrizProductoTalla') return [];
    const set = new Set();
    ventasFiltradas.forEach(v => set.add(v.talla || 'Sin talla'));
    return Array.from(set).sort(sortTallas);
  }, [ventasFiltradas, agrupacion]);

  // ---- Agrupación ----
  const datosAgrupados = useMemo(() => {
    if (agrupacion === 'ninguna') return ventasFiltradas;

    // Matriz Producto × Talla (para producción)
    if (agrupacion === 'matrizProductoTalla') {
      const grupos = {};
      ventasFiltradas.forEach(v => {
        const clave = v.productoId || v.referencia || 'Sin ref';
        const t = v.talla || 'Sin talla';
        if (!grupos[clave]) {
          grupos[clave] = {
            clave,
            nombre: v.productoNombre || v.referencia || 'Sin nombre',
            referencia: v.referencia || '',
            tallas: {},
            totalCantidad: 0,
            totalVentas: 0,
            montoRecibido: 0,
            costoTotal: 0,
            utilidad: 0
          };
        }
        grupos[clave].tallas[t] = (grupos[clave].tallas[t] || 0) + v.cantidad;
        grupos[clave].totalCantidad += v.cantidad;
        grupos[clave].totalVentas += v.subtotal;
        grupos[clave].montoRecibido += v.montoRecibido;
        grupos[clave].costoTotal += v.costoTotal;
        grupos[clave].utilidad += v.utilidad;
      });
      return Object.values(grupos).map(g => ({
        ...g,
        margen: g.totalVentas > 0 ? (g.utilidad / g.totalVentas) * 100 : 0
      }));
    }

    const grupos = {};
    ventasFiltradas.forEach(v => {
      let clave = '';
      let nombre = '';

      switch (agrupacion) {
        case 'producto':
          clave = v.productoId || v.referencia || 'Sin ref';
          nombre = v.referencia ? `${v.referencia} - ${v.productoNombre}` : v.productoNombre;
          break;
        case 'cliente':
          clave = v.clienteId || CLIENTE_GENERAL_KEY;
          nombre = v.clienteId ? v.clienteNombre : 'Cliente General';
          break;
        case 'colegio':
          clave = v.colegioId || v.colegioCodigo || v.colegioNombre || 'Sin colegio';
          nombre = v.colegioNombre || v.colegioCodigo || 'Sin colegio';
          break;
        case 'talla':
          clave = v.talla || 'Sin talla';
          nombre = v.talla || 'Sin talla';
          break;
        case 'fecha': {
          const d = v.fecha;
          clave = d.toISOString().split('T')[0];
          nombre = d.toLocaleDateString('es-CO');
          break;
        }
        case 'metodoPago':
          clave = v.metodoPago;
          nombre = v.metodoPago;
          break;
        default:
          clave = 'General';
          nombre = 'General';
      }

      if (!grupos[clave]) {
        grupos[clave] = {
          clave,
          nombre,
          cantidad: 0,
          totalVentas: 0,
          montoRecibido: 0,
          costoTotal: 0,
          utilidad: 0
        };
      }

      grupos[clave].cantidad += v.cantidad;
      grupos[clave].totalVentas += v.subtotal;
      grupos[clave].montoRecibido += v.montoRecibido;
      grupos[clave].costoTotal += v.costoTotal;
      grupos[clave].utilidad += v.utilidad;
    });

    return Object.values(grupos).map(g => ({
      ...g,
      margen: g.totalVentas > 0 ? (g.utilidad / g.totalVentas) * 100 : 0
    }));
  }, [ventasFiltradas, agrupacion]);

  // Totales por talla para la fila final de la matriz
  const totalesPorTalla = useMemo(() => {
    if (agrupacion !== 'matrizProductoTalla') return {};
    const res = {};
    tallasMatriz.forEach(t => { res[t] = 0; });
    datosAgrupados.forEach(p => {
      tallasMatriz.forEach(t => {
        res[t] += p.tallas?.[t] || 0;
      });
    });
    return res;
  }, [datosAgrupados, tallasMatriz, agrupacion]);

  // ---- Ordenamiento ----
  const datosOrdenados = useMemo(() => {
    const arr = [...datosAgrupados];
    const { key, direction } = sortConfig;
    const mult = direction === 'asc' ? 1 : -1;
    const esTalla = key.startsWith('talla_');
    const tallaKey = esTalla ? key.substring(6) : null;

    arr.sort((a, b) => {
      let va, vb;
      if (esTalla) {
        va = a.tallas?.[tallaKey] || 0;
        vb = b.tallas?.[tallaKey] || 0;
      } else {
        va = a[key];
        vb = b[key];
      }
      if (va instanceof Date) va = va.getTime();
      if (vb instanceof Date) vb = vb.getTime();
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb) * mult;
      }
      return (va - vb) * mult;
    });
    return arr;
  }, [datosAgrupados, sortConfig]);

  // ---- Paginación ----
  const totalPaginas = Math.max(1, Math.ceil(datosOrdenados.length / tamanoPagina));
  const datosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * tamanoPagina;
    return datosOrdenados.slice(inicio, inicio + tamanoPagina);
  }, [datosOrdenados, paginaActual, tamanoPagina]);

  // Reset paginación cuando cambian filtros/orden/agrupación
  useEffect(() => {
    setPaginaActual(1);
  }, [clienteId, productoFiltro, talla, metodoPago, colegioId, agrupacion, tamanoPagina, sortConfig, ventasCrudas]);

  // Reset orden al cambiar agrupación
  useEffect(() => {
    if (agrupacion === 'ninguna') {
      setSortConfig({ key: 'fecha', direction: 'desc' });
    } else if (agrupacion === 'matrizProductoTalla') {
      setSortConfig({ key: 'totalCantidad', direction: 'desc' });
    } else {
      setSortConfig({ key: 'totalVentas', direction: 'desc' });
    }
  }, [agrupacion]);

  // Mantener página en rango si cambia el total
  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas);
  }, [totalPaginas, paginaActual]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const exportarAExcel = () => {
    if (!datosOrdenados.length) {
      alert('No hay datos para exportar');
      return;
    }

    try {
      let dataParaExcel = [];

      if (agrupacion === 'matrizProductoTalla') {
        dataParaExcel = datosOrdenados.map(prod => {
          const fila = { 'Producto': prod.nombre, 'Referencia': prod.referencia };
          tallasMatriz.forEach(t => { fila[`Talla ${t}`] = prod.tallas[t] || 0; });
          fila['Total Unidades'] = prod.totalCantidad;
          fila['Total Ventas'] = prod.totalVentas;
          return fila;
        });
        const filaTotal = { 'Producto': 'TOTALES', 'Referencia': '' };
        tallasMatriz.forEach(t => { filaTotal[`Talla ${t}`] = totalesPorTalla[t] || 0; });
        filaTotal['Total Unidades'] = totales.cantidadTotal;
        filaTotal['Total Ventas'] = totales.ventasTotal;
        dataParaExcel.push(filaTotal);
      } else if (agrupacion === 'ninguna') {
        dataParaExcel = datosOrdenados.map(venta => ({
          'Fecha': venta.fecha.toLocaleDateString('es-CO'),
          'Fuente': venta.fuente,
          'No. Documento': venta.numeroDocumento,
          'Cliente': venta.clienteNombre,
          'Producto': venta.productoNombre,
          'Referencia': venta.referencia,
          'Talla': venta.talla,
          'Cantidad': venta.cantidad,
          'Precio Unit.': venta.precioUnitario,
          'Subtotal': venta.subtotal,
          'Recaudado': venta.montoRecibido,
          'Costo Unit.': venta.costoUnitario,
          'Costo Total': venta.costoTotal,
          'Utilidad': venta.utilidad,
          'Margen %': venta.margen.toFixed(2),
          'Método Pago': venta.metodoPago,
          'Colegio': venta.colegioNombre
        }));

        dataParaExcel.push({
          'Fecha': '',
          'Fuente': '',
          'No. Documento': '',
          'Cliente': '',
          'Producto': '',
          'Referencia': 'TOTALES',
          'Talla': '',
          'Cantidad': totales.cantidadTotal,
          'Precio Unit.': '',
          'Subtotal': totales.ventasTotal,
          'Recaudado': totales.montoRecibidoTotal,
          'Costo Unit.': '',
          'Costo Total': totales.costoTotal,
          'Utilidad': totales.utilidadTotal,
          'Margen %': totales.margenPromedio.toFixed(2),
          'Método Pago': '',
          'Colegio': ''
        });
      } else {
        dataParaExcel = datosOrdenados.map(grupo => ({
          'Grupo': grupo.nombre,
          'Cantidad Total': grupo.cantidad,
          'Total Ventas': grupo.totalVentas,
          'Recaudado': grupo.montoRecibido,
          'Costo Total': grupo.costoTotal,
          'Utilidad': grupo.utilidad,
          'Margen %': grupo.margen.toFixed(2)
        }));

        dataParaExcel.push({
          'Grupo': 'TOTALES',
          'Cantidad Total': totales.cantidadTotal,
          'Total Ventas': totales.ventasTotal,
          'Recaudado': totales.montoRecibidoTotal,
          'Costo Total': totales.costoTotal,
          'Utilidad': totales.utilidadTotal,
          'Margen %': totales.margenPromedio.toFixed(2)
        });
      }

      // Si el usuario no puede ver dinero (vendedor), eliminar columnas financieras
      // de cada fila antes de exportar. Deja solo cantidades/dimensiones.
      if (!puedeVerDinero) {
        const columnasDinero = new Set([
          'Total Ventas', 'Precio Unit.', 'Subtotal', 'Recaudado',
          'Costo Unit.', 'Costo Total', 'Utilidad', 'Margen %'
        ]);
        dataParaExcel = dataParaExcel.map(fila => {
          const limpia = {};
          Object.keys(fila).forEach(k => {
            if (!columnasDinero.has(k)) limpia[k] = fila[k];
          });
          return limpia;
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Ventas');

      const fileName = `Reporte_Ventas_${formatDateForInput(startDate)}_${formatDateForInput(endDate)}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert('Reporte exportado exitosamente');
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar el reporte');
    }
  };

  // Header sortable
  const SortHeader = ({ columnKey, label, align = 'left' }) => {
    const active = sortConfig.key === columnKey;
    const Icon = active
      ? (sortConfig.direction === 'asc' ? ArrowUp : ArrowDown)
      : ArrowUpDown;
    const alignClass = align === 'right' ? 'justify-end' : 'justify-start';
    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100`}
      >
        <div className={`flex items-center gap-1 ${alignClass}`}>
          <span>{label}</span>
          <Icon size={12} className={active ? '' : 'opacity-40'} />
        </div>
      </th>
    );
  };

  const inicioPag = datosOrdenados.length === 0
    ? 0
    : (paginaActual - 1) * tamanoPagina + 1;
  const finPag = Math.min(paginaActual * tamanoPagina, datosOrdenados.length);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp size={28} style={{ color: '#D50565' }} />
          Reporte de Ventas
        </h1>
        <p className="text-gray-600 mt-1">Analiza las ventas por múltiples criterios</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Filter size={20} style={{ color: '#D50565' }} />
          Filtros
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Fechas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-');
                setStartDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-');
                setEndDate(new Date(year, month - 1, day));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Presets de fecha */}
          <div className="flex flex-wrap gap-2 items-end">
            <button
              onClick={() => setPresetDate('hoy')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Hoy
            </button>
            <button
              onClick={() => setPresetDate('ayer')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Ayer
            </button>
            <button
              onClick={() => setPresetDate('semana')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              7 días
            </button>
            <button
              onClick={() => setPresetDate('mes')}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              30 días
            </button>
          </div>

          {/* Fuente de venta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuente de Venta
            </label>
            <select
              value={fuenteVenta}
              onChange={(e) => setFuenteVenta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todas">Todas</option>
              <option value="pos">POS (Ventas Directas)</option>
              <option value="pedidos">Pedidos (Tienda)</option>
              <option value="pedidosB2B">Pedidos B2B</option>
              <option value="apartados">Apartados</option>
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Todos los clientes</option>
              <option value={CLIENTE_GENERAL_KEY}>Cliente General (sin cliente)</option>
              {clientesOrdenados.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Producto (buscador con autocomplete) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto (ref o nombre)
            </label>
            <input
              type="text"
              list="productos-list"
              value={productoFiltro}
              onChange={(e) => setProductoFiltro(e.target.value)}
              placeholder="Ej: CH-001 o Camiseta"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <datalist id="productos-list">
              {productosOrdenados.map(p => (
                <option key={p.id} value={p.referencia || ''}>
                  {p.nombre}
                </option>
              ))}
            </datalist>
          </div>

          {/* Talla */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Talla
            </label>
            <select
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
              disabled={!ventasCrudas}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:bg-gray-100"
            >
              <option value="">Todas las tallas</option>
              {tallasDisponibles.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {!ventasCrudas && (
              <p className="text-xs text-gray-500 mt-1">Genera el reporte para ver tallas</p>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Nequi">Nequi</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>

          {/* Colegio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colegio
            </label>
            <select
              value={colegioId}
              onChange={(e) => setColegioId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Todos los colegios</option>
              {colegiosOrdenados.map(colegio => (
                <option key={colegio.id} value={colegio.id}>
                  {colegio.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Vista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vista
            </label>
            <select
              value={agrupacion}
              onChange={(e) => setAgrupacion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="matrizProductoTalla">Matriz Producto × Talla (Producción)</option>
              <option value="producto">Totales por Producto</option>
              <option value="talla">Totales por Talla</option>
              <option value="colegio">Totales por Colegio</option>
              <option value="cliente">Totales por Cliente</option>
              <option value="fecha">Totales por Fecha</option>
              <option value="metodoPago">Totales por Método de Pago</option>
              <option value="ninguna">Detalle (lista completa)</option>
            </select>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={generarReporte}
            disabled={loading}
            className="flex-1 px-6 py-3 text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50"
            style={{ backgroundColor: '#D50565' }}
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </button>
          <button
            onClick={exportarAExcel}
            disabled={!ventasCrudas || loading || datosOrdenados.length === 0}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium shadow-md hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={20} />
            Exportar a Excel
          </button>
        </div>

        {filtrosConsultaCambiados && (
          <div className="mt-4 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-center gap-3">
            <span className="text-yellow-700 text-sm font-medium">
              ⚠ Las fechas, fuente o colegio cambiaron. Presiona <strong>Generar Reporte</strong> para aplicar los nuevos valores.
            </span>
          </div>
        )}
        {ventasCrudas && !filtrosConsultaCambiados && (
          <p className="text-xs text-gray-500 mt-3">
            Producto, talla y método de pago se filtran en tiempo real sin volver a consultar la base de datos.
          </p>
        )}
      </div>

      {/* Resultados */}
      {loading && (
        <div className="text-center py-20">
          <p className="text-gray-600">Generando reporte...</p>
        </div>
      )}

      {!loading && ventasCrudas === null && (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <p className="text-gray-600">Configura los filtros y haz clic en "Generar Reporte"</p>
        </div>
      )}

      {!loading && ventasCrudas && (
        <>
          {/* Tarjetas de Resumen */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${puedeVerDinero ? 'lg:grid-cols-5' : 'lg:grid-cols-1'} gap-4 mb-6`}>
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cantidad Total</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {totales.cantidadTotal.toLocaleString()}
                  </p>
                </div>
                <Package size={32} className="text-blue-500" />
              </div>
            </div>

            {puedeVerDinero && (
              <>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Ventas</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(totales.ventasTotal)}
                      </p>
                    </div>
                    <DollarSign size={32} className="text-green-500" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Recaudado</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(totales.montoRecibidoTotal)}
                      </p>
                    </div>
                    <DollarSign size={32} className="text-orange-500" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Utilidad</p>
                      <p className="text-2xl font-bold" style={{ color: '#D50565' }}>
                        {formatCurrency(totales.utilidadTotal)}
                      </p>
                    </div>
                    <TrendingUp size={32} style={{ color: '#D50565' }} />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Margen Promedio</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {totales.margenPromedio.toFixed(2)}%
                      </p>
                    </div>
                    <Calendar size={32} className="text-purple-500" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Contador + tamaño página */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-b bg-gray-50">
              <p className="text-sm text-gray-600">
                {datosOrdenados.length === 0
                  ? 'Sin resultados con los filtros actuales'
                  : `Mostrando ${inicioPag}–${finPag} de ${datosOrdenados.length.toLocaleString()} ${
                      agrupacion === 'ninguna' ? 'registros' :
                      agrupacion === 'matrizProductoTalla' ? 'productos' :
                      'grupos'
                    } · ${totales.cantidadTotal.toLocaleString()} prendas`}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600">Por página:</label>
                <select
                  value={tamanoPagina}
                  onChange={(e) => setTamanoPagina(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">

                {/* ── MODO MATRIZ: Producto × Talla ── */}
                {agrupacion === 'matrizProductoTalla' && (
                  <>
                    <thead className="bg-gray-50">
                      <tr>
                        <SortHeader columnKey="nombre" label="Producto" />
                        <SortHeader columnKey="referencia" label="Ref" />
                        {tallasMatriz.map(t => (
                          <th
                            key={t}
                            onClick={() => handleSort(`talla_${t}`)}
                            className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap"
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span>{t}</span>
                              {sortConfig.key === `talla_${t}`
                                ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                                : <ArrowUpDown size={12} className="opacity-40" />}
                            </div>
                          </th>
                        ))}
                        <SortHeader columnKey="totalCantidad" label="Total" align="right" />
                        {puedeVerDinero && <SortHeader columnKey="totalVentas" label="Ventas" align="right" />}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {datosPaginados.length === 0 ? (
                        <tr>
                          <td colSpan={2 + tallasMatriz.length + (puedeVerDinero ? 2 : 1)} className="px-4 py-10 text-center text-gray-500 text-sm">
                            No hay datos que mostrar
                          </td>
                        </tr>
                      ) : datosPaginados.map((prod, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{prod.nombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{prod.referencia}</td>
                          {tallasMatriz.map(t => (
                            <td key={t} className="px-3 py-3 text-sm text-right">
                              {prod.tallas[t]
                                ? <span className="font-medium text-gray-900">{prod.tallas[t].toLocaleString()}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right">
                            {prod.totalCantidad.toLocaleString()}
                          </td>
                          {puedeVerDinero && (
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                              {formatCurrency(prod.totalVentas)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {datosPaginados.length > 0 && (
                      <tfoot>
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-700">TOTAL</td>
                          {tallasMatriz.map(t => (
                            <td key={t} className="px-3 py-3 text-sm font-bold text-blue-700 text-right">
                              {(totalesPorTalla[t] || 0).toLocaleString()}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right">
                            {totales.cantidadTotal.toLocaleString()}
                          </td>
                          {puedeVerDinero && (
                            <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right whitespace-nowrap">
                              {formatCurrency(totales.ventasTotal)}
                            </td>
                          )}
                        </tr>
                      </tfoot>
                    )}
                  </>
                )}

                {/* ── MODO DETALLE: lista completa ── */}
                {agrupacion === 'ninguna' && (
                  <>
                    <thead className="bg-gray-50">
                      <tr>
                        <SortHeader columnKey="fecha" label="Fecha" />
                        <SortHeader columnKey="fuente" label="Fuente" />
                        <SortHeader columnKey="numeroDocumento" label="No. Doc" />
                        <SortHeader columnKey="clienteNombre" label="Cliente" />
                        <SortHeader columnKey="productoNombre" label="Producto" />
                        <SortHeader columnKey="referencia" label="Ref" />
                        <SortHeader columnKey="talla" label="Talla" />
                        <SortHeader columnKey="cantidad" label="Cant" align="right" />
                        {puedeVerDinero && <SortHeader columnKey="precioUnitario" label="P. Unit" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="subtotal" label="Subtotal" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="montoRecibido" label="Recaudado" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="utilidad" label="Utilidad" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="margen" label="Margen %" align="right" />}
                        <SortHeader columnKey="colegioNombre" label="Colegio" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {datosPaginados.length === 0 ? (
                        <tr>
                          <td colSpan={puedeVerDinero ? 14 : 9} className="px-4 py-10 text-center text-gray-500 text-sm">
                            No hay datos que mostrar
                          </td>
                        </tr>
                      ) : datosPaginados.map((venta, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{venta.fecha.toLocaleDateString('es-CO')}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{venta.fuente}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{venta.numeroDocumento}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{venta.clienteNombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{venta.productoNombre}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{venta.referencia}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{venta.talla}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{venta.cantidad}</td>
                          {puedeVerDinero && <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">{formatCurrency(venta.precioUnitario)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">{formatCurrency(venta.subtotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-orange-600 text-right whitespace-nowrap">{formatCurrency(venta.montoRecibido)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-green-600 text-right whitespace-nowrap">{formatCurrency(venta.utilidad)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm text-gray-600 text-right">{venta.margen.toFixed(2)}%</td>}
                          <td className="px-4 py-3 text-sm text-gray-600">{venta.colegioNombre || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* ── MODO AGRUPADO: totales por dimensión ── */}
                {agrupacion !== 'ninguna' && agrupacion !== 'matrizProductoTalla' && (
                  <>
                    <thead className="bg-gray-50">
                      <tr>
                        <SortHeader
                          columnKey="nombre"
                          label={
                            agrupacion === 'producto' ? 'Producto' :
                            agrupacion === 'cliente' ? 'Cliente' :
                            agrupacion === 'colegio' ? 'Colegio' :
                            agrupacion === 'talla' ? 'Talla' :
                            agrupacion === 'fecha' ? 'Fecha' :
                            agrupacion === 'metodoPago' ? 'Método Pago' : 'Grupo'
                          }
                        />
                        <SortHeader columnKey="cantidad" label="Unidades" align="right" />
                        {puedeVerDinero && <SortHeader columnKey="totalVentas" label="Total Ventas" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="montoRecibido" label="Recaudado" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="costoTotal" label="Costo Total" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="utilidad" label="Utilidad" align="right" />}
                        {puedeVerDinero && <SortHeader columnKey="margen" label="Margen %" align="right" />}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {datosPaginados.length === 0 ? (
                        <tr>
                          <td colSpan={puedeVerDinero ? 7 : 2} className="px-4 py-10 text-center text-gray-500 text-sm">
                            No hay datos que mostrar
                          </td>
                        </tr>
                      ) : datosPaginados.map((grupo, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{grupo.nombre}</td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right">{grupo.cantidad.toLocaleString()}</td>
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">{formatCurrency(grupo.totalVentas)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-orange-600 text-right whitespace-nowrap">{formatCurrency(grupo.montoRecibido)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">{formatCurrency(grupo.costoTotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-medium text-green-600 text-right whitespace-nowrap">{formatCurrency(grupo.utilidad)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm text-gray-600 text-right">{grupo.margen.toFixed(2)}%</td>}
                        </tr>
                      ))}
                    </tbody>
                    {datosPaginados.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="px-4 py-3 text-sm font-bold text-gray-700">TOTAL</td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right">{totales.cantidadTotal.toLocaleString()}</td>
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right whitespace-nowrap">{formatCurrency(totales.ventasTotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right whitespace-nowrap">{formatCurrency(totales.montoRecibidoTotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-bold text-gray-600 text-right whitespace-nowrap">{formatCurrency(totales.costoTotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-bold text-green-600 text-right whitespace-nowrap">{formatCurrency(totales.utilidadTotal)}</td>}
                          {puedeVerDinero && <td className="px-4 py-3 text-sm font-bold text-gray-600 text-right">{totales.margenPromedio.toFixed(2)}%</td>}
                        </tr>
                      </tfoot>
                    )}
                  </>
                )}

              </table>
            </div>

            {/* Controles paginación */}
            {datosOrdenados.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Página {paginaActual} de {totalPaginas}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPaginaActual(1)}
                    disabled={paginaActual === 1}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Primera página"
                  >
                    <ChevronsLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Página anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Página siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={() => setPaginaActual(totalPaginas)}
                    disabled={paginaActual >= totalPaginas}
                    className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Última página"
                  >
                    <ChevronsRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteVentas;
