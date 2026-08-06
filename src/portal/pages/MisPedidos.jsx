import { useState, useEffect, useMemo } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, addDoc, runTransaction } from 'firebase/firestore';
import { Package, Calendar, DollarSign, FileText, ChevronDown, ChevronUp, CreditCard, Filter, Download, X, Search, FileSpreadsheet, CheckCircle, AlertTriangle, ShoppingBag, Printer, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { pedidoCompletamenteRecibido } from '../../utils/pedidosB2BLogic';
import { bloquearSinConexion } from '../../utils/conexion';

const MisPedidos = () => {
  const { clienteCorporativo, currentUser } = usePortalAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPedido, setExpandedPedido] = useState(null);

  // Estados de filtros
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPago, setFiltroPago] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [ordenamiento, setOrdenamiento] = useState('fecha-desc');

  // Estados para confirmación de recepción
  const [showConfirmarRecepcionModal, setShowConfirmarRecepcionModal] = useState(false);
  const [productoConfirmar, setProductoConfirmar] = useState(null);
  const [cantidadRecibida, setCantidadRecibida] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [confirmandoRecepcion, setConfirmandoRecepcion] = useState(false);

  // Estados para filtros dentro del pedido expandido
  const [filtroProductosPedido, setFiltroProductosPedido] = useState('');
  const [soloConPendientesPedido, setSoloConPendientesPedido] = useState(false);

  useEffect(() => {
    if (clienteCorporativo && currentUser?.email) {
      fetchPedidos();
    }
  }, [clienteCorporativo, currentUser]);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const pedidosRef = collection(db, 'pedidos_b2b');
      // Security: las reglas de Firestore exigen que la query filtre por
      // clienteEmail (el mismo campo contra el que evalúan ownership).
      // Filtrar por clienteId hace que la regla rechace la query completa.
      const q = query(
        pedidosRef,
        where('clienteEmail', '==', currentUser.email),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      const pedidosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPedidos(pedidosData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      alert('Error al cargar pedidos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatDateShort = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const getEstadoBadgeColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'En Preparación':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Enviado Parcial':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Enviado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Despachado':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Entregado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Completado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Anulado':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const esAnulado = (pedido) => pedido?.estado === 'Anulado' || pedido?.anulado === true;

  const calcularTotalAbonado = (abonos) => {
    if (!abonos || abonos.length === 0) return 0;
    return abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0);
  };

  const calcularEstadoPago = (pedido) => {
    if (esAnulado(pedido)) return 'Anulado';
    const total = pedido.total || 0;
    const totalAbonado = calcularTotalAbonado(pedido.abonos);
    if (totalAbonado === 0) return 'Sin Pagar';
    if (totalAbonado >= total) return 'Pagado';
    return 'Pago Parcial';
  };

  const getEstadoPagoBadgeColor = (estadoPago) => {
    switch (estadoPago) {
      case 'Pagado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pago Parcial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Sin Pagar':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Anulado':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const togglePedido = (pedidoId) => {
    // Si se está colapsando el pedido, limpiar filtros
    if (expandedPedido === pedidoId) {
      setFiltroProductosPedido('');
      setSoloConPendientesPedido(false);
      setExpandedPedido(null);
    } else {
      setExpandedPedido(pedidoId);
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstado('');
    setFiltroPago('');
    setFechaDesde('');
    setFechaHasta('');
    setMontoMin('');
    setMontoMax('');
    setBusqueda('');
    setOrdenamiento('fecha-desc');
  };

  const handleConfirmarRecepcion = async () => {
    // Corre dentro de un runTransaction sobre el pedido.
    if (bloquearSinConexion('confirmar la recepción')) return;

    // Prevenir doble clic
    if (confirmandoRecepcion) {
      return;
    }

    const cantidad = parseInt(cantidadRecibida);
    const cantidadEnviada = productoConfirmar.cantidadEnviada || 0;
    const cantidadYaRecibida = productoConfirmar.cantidadRecibida || 0;
    const cantidadPendiente = cantidadEnviada - cantidadYaRecibida;

    if (!cantidad || cantidad <= 0) {
      alert('⚠️ Por favor ingresa la cantidad de unidades que REALMENTE recibiste');
      return;
    }

    if (cantidad > cantidadPendiente) {
      alert(`❌ No puedes confirmar más de ${cantidadPendiente} unidades.\n\nEnviadas: ${cantidadEnviada}\nYa recibidas: ${cantidadYaRecibida}\nPendientes: ${cantidadPendiente}`);
      return;
    }

    // Mostrar resumen de confirmación para evitar errores
    const resumen = `
📦 CONFIRMAR RECEPCIÓN
━━━━━━━━━━━━━━━━━━━━━
Producto: ${productoConfirmar.descripcion}
Talla: ${productoConfirmar.talla}

📊 CANTIDADES:
• Enviadas: ${cantidadEnviada}
• Ya recibidas: ${cantidadYaRecibida}
• Recibes ahora: ${cantidad}
• Total recibido: ${cantidadYaRecibida + cantidad} de ${cantidadEnviada}

${observaciones.trim() ? `📝 OBSERVACIONES:\n${observaciones.trim()}\n\n` : ''}${cantidad < cantidadPendiente ? '⚠️ ATENCIÓN: Estás reportando MENOS unidades de las enviadas.\n' : ''}
¿Confirmas que recibiste ${cantidad} unidad${cantidad !== 1 ? 'es' : ''}?`;

    if (!window.confirm(resumen)) {
      return;
    }

    // Activar estado de carga para prevenir doble clic
    setConfirmandoRecepcion(true);

    try {
      const pedidoRef = doc(db, 'pedidos_b2b', productoConfirmar.pedidoId);

      // Usar transacción para leer datos frescos y evitar race conditions
      const resultado = await runTransaction(db, async (transaction) => {
        const pedidoSnap = await transaction.get(pedidoRef);
        if (!pedidoSnap.exists()) {
          throw new Error('El pedido ya no existe');
        }

        const pedidoData = pedidoSnap.data();
        const productosFrescos = pedidoData.productos || [];

        // Validar que el índice sigue siendo válido
        if (productoConfirmar.index >= productosFrescos.length) {
          throw new Error('El producto ya no existe en el pedido');
        }

        // Re-validar con datos frescos
        const productoFresco = productosFrescos[productoConfirmar.index];
        const cantidadEnviadaFresca = productoFresco.cantidadEnviada || 0;
        const cantidadYaRecibidaFresca = productoFresco.cantidadRecibida || 0;
        const cantidadPendienteFresca = cantidadEnviadaFresca - cantidadYaRecibidaFresca;

        if (cantidad > cantidadPendienteFresca) {
          throw new Error(`Solo quedan ${cantidadPendienteFresca} unidades pendientes por recibir (datos actualizados).`);
        }

        const productosActualizados = productosFrescos.map((p, idx) => {
          if (idx === productoConfirmar.index) {
            const nuevaCantidadRecibida = (p.cantidadRecibida || 0) + cantidad;
            const cantidadEnviadaProducto = p.cantidadEnviada || 0;
            const discrepanciaActual = cantidad < (cantidadEnviadaProducto - (p.cantidadRecibida || 0));

            const registroRecepcion = {
              fecha: new Date().toISOString(),
              cantidadReportada: cantidad,
              cantidadAcumulada: nuevaCantidadRecibida,
              cantidadEnviadaAlMomento: cantidadEnviadaProducto,
              observaciones: observaciones.trim() || null,
              discrepancia: discrepanciaActual,
              clienteNombre: clienteCorporativo.nombre,
              clienteId: clienteCorporativo.id
            };

            const historialExistente = p.historialRecepciones || [];

            return {
              ...p,
              cantidadRecibida: nuevaCantidadRecibida,
              estadoProduccion: nuevaCantidadRecibida >= cantidadEnviadaProducto ? 'recibido' : p.estadoProduccion,
              fechaRecepcion: new Date(),
              observacionesRecepcion: observaciones.trim() || null,
              historialRecepciones: [...historialExistente, registroRecepcion]
            };
          }
          return p;
        });

        // 'Completado' SOLO cuando todo lo PEDIDO fue recibido (helper puro
        // con tests). El chequeo anterior (recibida >= enviada) se cumplía
        // trivialmente para productos nunca enviados y completaba pedidos
        // con productos aún en producción.
        const todosRecibidos = pedidoCompletamenteRecibido(productosActualizados);

        transaction.update(pedidoRef, {
          productos: productosActualizados,
          estado: todosRecibidos ? 'Completado' : pedidoData.estado,
          updatedAt: serverTimestamp()
        });

        return { numeroPedido: pedidoData.numeroPedido };
      });

      // Crear notificación para admin si hay discrepancia o hay observaciones
      const discrepancia = cantidad < cantidadPendiente;
      const fechaHoraActual = new Date();
      const fechaFormateada = fechaHoraActual.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const horaFormateada = fechaHoraActual.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      if (discrepancia || observaciones.trim()) {
        const cantidadYaRecibidaAntes = productoConfirmar.cantidadRecibida || 0;
        const nuevaCantidadTotal = cantidadYaRecibidaAntes + cantidad;

        await addDoc(collection(db, 'notificaciones_admin'), {
          tipo: 'recepcion_producto',
          titulo: discrepancia ? '⚠️ Discrepancia en Recepción' : '📝 Producto Recibido con Observaciones',
          mensaje: `${clienteCorporativo.nombre} reporta recepción de ${productoConfirmar.descripcion} (Talla: ${productoConfirmar.talla}): ${cantidad}/${cantidadEnviada - cantidadYaRecibidaAntes} unidades pendientes. Total recibido: ${nuevaCantidadTotal}/${cantidadEnviada}. ${observaciones.trim() ? '\n\nObservaciones: ' + observaciones.trim() : ''}`,
          leida: false,
          pedidoId: productoConfirmar.pedidoId,
          numeroPedido: resultado.numeroPedido,
          clienteId: clienteCorporativo.id,
          clienteNombre: clienteCorporativo.nombre,
          // Datos estructurados completos del producto
          productoDescripcion: productoConfirmar.descripcion,
          productoTalla: productoConfirmar.talla,
          productoCodigo: productoConfirmar.codigo,
          productoIndex: productoConfirmar.index,
          // Cantidades detalladas
          cantidadReportadaAhora: cantidad,
          cantidadRecibidaAnterior: cantidadYaRecibidaAntes,
          cantidadRecibidaTotal: nuevaCantidadTotal,
          cantidadEnviada: cantidadEnviada,
          cantidadPedidaOriginal: productoConfirmar.cantidad,
          // Observaciones y discrepancia
          observaciones: observaciones.trim() || null,
          hayDiscrepancia: discrepancia,
          unidadesFaltantes: discrepancia ? (cantidadEnviada - cantidadYaRecibidaAntes) - cantidad : 0,
          // Fecha y hora detalladas
          fechaRecepcion: fechaFormateada,
          horaRecepcion: horaFormateada,
          fechaRecepcionISO: fechaHoraActual.toISOString(),
          createdAt: serverTimestamp()
        });
      }

      alert(`Recepción confirmada: ${cantidad} unidad(es) de ${productoConfirmar.descripcion}`);
      setShowConfirmarRecepcionModal(false);
      setCantidadRecibida('');
      setObservaciones('');
      setProductoConfirmar(null);
      fetchPedidos();
    } catch (error) {
      console.error('Error al confirmar recepción:', error);
      alert('Error al confirmar recepción: ' + error.message);
    } finally {
      // Resetear estado de carga para permitir nuevas confirmaciones
      setConfirmandoRecepcion(false);
    }
  };

  // Aplicar filtros y ordenamiento
  const pedidosFiltrados = useMemo(() => {
    let resultado = [...pedidos];

    // Filtro por búsqueda (número de pedido)
    if (busqueda.trim()) {
      resultado = resultado.filter(p =>
        String(p.numeroPedido || '').includes(busqueda) ||
        p.id.toLowerCase().includes(busqueda.toLowerCase())
      );
    }

    // Filtro por estado
    if (filtroEstado) {
      resultado = resultado.filter(p => p.estado === filtroEstado);
    }

    // Filtro por estado de pago
    if (filtroPago) {
      resultado = resultado.filter(p => calcularEstadoPago(p) === filtroPago);
    }

    // Filtro por fecha desde
    if (fechaDesde) {
      const fechaDesdeDate = new Date(fechaDesde);
      resultado = resultado.filter(p => {
        if (!p.createdAt) return false;
        const pedidoDate = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        return pedidoDate >= fechaDesdeDate;
      });
    }

    // Filtro por fecha hasta
    if (fechaHasta) {
      const fechaHastaDate = new Date(fechaHasta);
      fechaHastaDate.setHours(23, 59, 59, 999);
      resultado = resultado.filter(p => {
        if (!p.createdAt) return false;
        const pedidoDate = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        return pedidoDate <= fechaHastaDate;
      });
    }

    // Filtro por monto mínimo
    if (montoMin) {
      const min = parseFloat(montoMin);
      resultado = resultado.filter(p => p.total >= min);
    }

    // Filtro por monto máximo
    if (montoMax) {
      const max = parseFloat(montoMax);
      resultado = resultado.filter(p => p.total <= max);
    }

    // Ordenamiento
    resultado.sort((a, b) => {
      switch (ordenamiento) {
        case 'fecha-desc':
          return (b.createdAt?.toDate?.() || new Date(b.createdAt || 0)) - (a.createdAt?.toDate?.() || new Date(a.createdAt || 0));
        case 'fecha-asc':
          return (a.createdAt?.toDate?.() || new Date(a.createdAt || 0)) - (b.createdAt?.toDate?.() || new Date(b.createdAt || 0));
        case 'monto-desc':
          return (b.total || 0) - (a.total || 0);
        case 'monto-asc':
          return (a.total || 0) - (b.total || 0);
        default:
          return 0;
      }
    });

    return resultado;
  }, [pedidos, busqueda, filtroEstado, filtroPago, fechaDesde, fechaHasta, montoMin, montoMax, ordenamiento]);

  // Exportar a Excel (CSV)
  const exportarExcel = () => {
    if (pedidosFiltrados.length === 0) {
      alert('No hay pedidos para exportar');
      return;
    }

    // Crear CSV
    let csv = 'Pedido,Fecha,Estado,Estado Pago,Total,Abonado,Saldo,Productos\n';

    pedidosFiltrados.forEach(pedido => {
      const totalAbonado = calcularTotalAbonado(pedido.abonos);
      const saldo = pedido.total - totalAbonado;
      const productos = pedido.productos?.map(p => `${p.descripcion} (${p.talla})`).join('; ') || '';

      csv += `"#${String(pedido.numeroPedido || 0).padStart(4, '0')}",`;
      csv += `"${formatDateShort(pedido.createdAt)}",`;
      csv += `"${pedido.estado}",`;
      csv += `"${calcularEstadoPago(pedido)}",`;
      csv += `"${formatCurrency(pedido.total)}",`;
      csv += `"${formatCurrency(totalAbonado)}",`;
      csv += `"${formatCurrency(saldo)}",`;
      csv += `"${productos}"\n`;
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos_${clienteCorporativo.nombre}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Estado de Cuenta en PDF
  const exportarEstadoCuenta = () => {
    if (pedidosFiltrados.length === 0) {
      alert('No hay pedidos para exportar');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    const colorPrimario = [213, 5, 101];
    const colorGris = [100, 100, 100];
    const colorNegro = [0, 0, 0];

    // Para los totales del estado de cuenta, ignorar pedidos anulados (no son deuda real)
    const pedidosParaTotales = pedidosFiltrados.filter(p => !esAnulado(p));
    const totalComprado = pedidosParaTotales.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalAbonado = pedidosParaTotales.reduce((sum, p) => sum + calcularTotalAbonado(p.abonos), 0);
    const saldoTotal = totalComprado - totalAbonado;

    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(...colorPrimario);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE CUENTA', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    doc.setFontSize(12);
    doc.setTextColor(...colorNegro);
    doc.text(clienteCorporativo?.nombre || '', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    doc.setFontSize(9);
    doc.setTextColor(...colorGris);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Resumen General
    doc.setFillColor(213, 5, 101);
    doc.rect(margin, yPosition - 5, pageWidth - (2 * margin), 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RESUMEN GENERAL', margin + 2, yPosition);
    yPosition += 10;

    doc.setTextColor(...colorNegro);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text('Total Comprado:', margin + 5, yPosition);
    doc.text(formatCurrency(totalComprado), pageWidth - margin - 5, yPosition, { align: 'right' });
    yPosition += 6;

    doc.text('Total Abonado:', margin + 5, yPosition);
    doc.setTextColor(0, 150, 0);
    doc.text(formatCurrency(totalAbonado), pageWidth - margin - 5, yPosition, { align: 'right' });
    yPosition += 6;

    doc.setTextColor(...colorPrimario);
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo Pendiente:', margin + 5, yPosition);
    doc.setFontSize(12);
    doc.text(formatCurrency(saldoTotal), pageWidth - margin - 5, yPosition, { align: 'right' });
    yPosition += 12;

    // Detalle de Pedidos
    doc.setFillColor(213, 5, 101);
    doc.rect(margin, yPosition - 5, pageWidth - (2 * margin), 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DETALLE DE PEDIDOS', margin + 2, yPosition);
    yPosition += 10;

    pedidosFiltrados.forEach((pedido, index) => {
      const pedidoAnulado = esAnulado(pedido);
      const totalAbonadoPedido = pedidoAnulado ? 0 : calcularTotalAbonado(pedido.abonos);
      const totalPedidoMostrar = pedidoAnulado ? 0 : (pedido.total || 0);
      const saldoPedido = totalPedidoMostrar - totalAbonadoPedido;

      // Verificar si necesitamos nueva página
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
      }

      // Fondo del pedido
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition - 3, pageWidth - (2 * margin), 35, 'F');
      }

      doc.setTextColor(...colorNegro);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Pedido #${String(pedido.numeroPedido || 0).padStart(4, '0')}`, margin + 3, yPosition);
      yPosition += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Fecha: ${formatDateShort(pedido.createdAt)}`, margin + 5, yPosition);
      doc.text(`Estado: ${pedido.estado}`, margin + 70, yPosition);
      yPosition += 5;

      doc.text(`Total:`, margin + 5, yPosition);
      doc.text(formatCurrency(pedido.total), margin + 40, yPosition);
      yPosition += 5;

      doc.setTextColor(0, 150, 0);
      doc.text(`Abonado:`, margin + 5, yPosition);
      doc.text(formatCurrency(totalAbonadoPedido), margin + 40, yPosition);
      yPosition += 5;

      doc.setTextColor(...colorPrimario);
      doc.setFont('helvetica', 'bold');
      doc.text(`Saldo:`, margin + 5, yPosition);
      doc.text(formatCurrency(saldoPedido), margin + 40, yPosition);
      yPosition += 8;

      doc.setTextColor(...colorNegro);
      doc.setFont('helvetica', 'normal');
    });

    // ── HISTORIAL DE ABONOS (todos los abonos de todos los pedidos no anulados) ──
    const fechaMs = (f) => {
      if (!f) return 0;
      if (typeof f.toDate === 'function') return f.toDate().getTime();
      if (f.seconds) return f.seconds * 1000;
      const d = new Date(f);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const todosLosAbonos = [];
    pedidosParaTotales.forEach(p => {
      (p.abonos || []).forEach(a => {
        todosLosAbonos.push({
          numeroPedido: p.numeroPedido || 0,
          monto: a.monto || 0,
          fecha: a.fecha,
          notas: a.notas || ''
        });
      });
    });
    todosLosAbonos.sort((a, b) => fechaMs(a.fecha) - fechaMs(b.fecha));

    if (todosLosAbonos.length > 0) {
      if (yPosition > pageHeight - 50) { doc.addPage(); yPosition = margin; }
      yPosition += 2;
      doc.setFillColor(213, 5, 101);
      doc.rect(margin, yPosition - 5, pageWidth - (2 * margin), 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('HISTORIAL DE ABONOS', margin + 2, yPosition);
      yPosition += 10;

      // Encabezados de columna
      doc.setTextColor(...colorGris);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha', margin + 5, yPosition);
      doc.text('Pedido', margin + 45, yPosition);
      doc.text('Notas', margin + 75, yPosition);
      doc.text('Monto', pageWidth - margin - 5, yPosition, { align: 'right' });
      yPosition += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
      yPosition += 3;

      doc.setTextColor(...colorNegro);
      doc.setFont('helvetica', 'normal');
      todosLosAbonos.forEach(a => {
        if (yPosition > pageHeight - 25) { doc.addPage(); yPosition = margin; }
        doc.text(formatDateShort(a.fecha), margin + 5, yPosition);
        doc.text(`#${String(a.numeroPedido).padStart(4, '0')}`, margin + 45, yPosition);
        doc.text((a.notas || '').substring(0, 35), margin + 75, yPosition);
        doc.setTextColor(0, 150, 0);
        doc.text(formatCurrency(a.monto), pageWidth - margin - 5, yPosition, { align: 'right' });
        doc.setTextColor(...colorNegro);
        yPosition += 5;
      });

      // Total abonado de la sección
      yPosition += 1;
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, yPosition - 1, pageWidth - margin, yPosition - 1);
      yPosition += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL ABONADO', margin + 5, yPosition);
      doc.setTextColor(0, 150, 0);
      doc.text(formatCurrency(totalAbonado), pageWidth - margin - 5, yPosition, { align: 'right' });
      doc.setTextColor(...colorNegro);
      yPosition += 6;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colorPrimario);
      doc.setFontSize(10);
      doc.text('SALDO PENDIENTE', margin + 5, yPosition);
      doc.text(formatCurrency(saldoTotal), pageWidth - margin - 5, yPosition, { align: 'right' });
      doc.setTextColor(...colorNegro);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...colorGris);
    doc.setFont('helvetica', 'italic');
    const footerText = `Documento generado el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Guardar
    doc.save(`Estado_Cuenta_${clienteCorporativo?.nombre || 'Cliente'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Generar PDF del pedido en formato carta
  const generarPDFPedido = (pedido) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter' // 216mm x 279mm (8.5" x 11")
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Colores
    const colorPrimario = [213, 5, 101]; // #D50565
    const colorGris = [100, 100, 100];
    const colorNegro = [0, 0, 0];

    // Encabezado - Título
    doc.setFontSize(22);
    doc.setTextColor(...colorPrimario);
    doc.setFont('helvetica', 'bold');
    doc.text('PEDIDO DE UNIFORMES', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Número de pedido
    doc.setFontSize(16);
    doc.text(`#${String(pedido.numeroPedido || 0).padStart(4, '0')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Información del cliente y pedido
    doc.setFontSize(10);
    doc.setTextColor(...colorNegro);
    doc.setFont('helvetica', 'normal');

    const fechaPedido = pedido.createdAt ? formatDate(pedido.createdAt) : 'N/A';

    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(clienteCorporativo?.nombre || '', margin + 20, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaPedido, margin + 20, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Estado:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(pedido.estado || 'N/A', margin + 20, yPosition);
    yPosition += 10;

    // Línea separadora
    doc.setDrawColor(...colorPrimario);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Tabla de productos - Encabezado
    doc.setFillColor(213, 5, 101);
    doc.rect(margin, yPosition - 5, pageWidth - (2 * margin), 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Descripción', margin + 2, yPosition);
    doc.text('Talla', pageWidth - margin - 75, yPosition);
    doc.text('Cant.', pageWidth - margin - 50, yPosition);
    doc.text('Precio Unit.', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 8;

    // Productos
    doc.setTextColor(...colorNegro);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const productos = pedido.productos || [];
    let subtotalGeneral = 0;

    productos.forEach((producto, index) => {
      // Verificar si necesitamos una nueva página
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      // Fondo alternado para filas
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPosition - 4, pageWidth - (2 * margin), 7, 'F');
      }

      // Descripción del producto (truncada si es muy larga)
      const descripcion = producto.descripcion || '';
      const maxLength = 45;
      const descripcionMostrar = descripcion.length > maxLength
        ? descripcion.substring(0, maxLength) + '...'
        : descripcion;

      doc.text(descripcionMostrar, margin + 2, yPosition);
      doc.text(producto.talla || '-', pageWidth - margin - 60, yPosition);
      doc.text(String(producto.cantidad || 0), pageWidth - margin - 40, yPosition);

      const precioUnitario = producto.precioUnitario || producto.precio || 0;
      const subtotal = precioUnitario * (producto.cantidad || 0);
      subtotalGeneral += subtotal;

      doc.text(formatCurrency(precioUnitario), pageWidth - margin - 2, yPosition, { align: 'right' });

      yPosition += 7;
    });

    yPosition += 5;

    // Línea separadora antes del total
    doc.setDrawColor(...colorGris);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Total del pedido
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...colorPrimario);
    doc.text('TOTAL:', pageWidth - margin - 60, yPosition);
    doc.setFontSize(14);
    doc.text(formatCurrency(pedido.total || 0), pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 10;

    // Notas del pedido (si existen)
    if (pedido.notas && pedido.notas.trim()) {
      yPosition += 5;
      doc.setFontSize(10);
      doc.setTextColor(...colorNegro);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas:', margin, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const notasLineas = doc.splitTextToSize(pedido.notas, pageWidth - (2 * margin));
      doc.text(notasLineas, margin, yPosition);
      yPosition += (notasLineas.length * 5);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...colorGris);
    doc.setFont('helvetica', 'italic');
    const footerText = `Generado el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Guardar PDF
    const nombreArchivo = `Pedido_${String(pedido.numeroPedido || 0).padStart(4, '0')}_${clienteCorporativo?.nombre || 'Cliente'}.pdf`;
    doc.save(nombreArchivo);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#D50565' }}></div>
          <p className="text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  const filtrosActivos = filtroEstado || filtroPago || fechaDesde || fechaHasta || montoMin || montoMax || busqueda;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Package size={28} />
              Mis Pedidos
            </h1>
            <p className="text-gray-600">
              {clienteCorporativo?.nombre}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {pedidosFiltrados.length} de {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                filtrosActivos
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={filtrosActivos ? { backgroundColor: '#D50565' } : {}}
            >
              <Filter size={18} />
              Filtros
              {filtrosActivos && <span className="bg-white text-pink-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">!</span>}
            </button>

            <button
              onClick={exportarEstadoCuenta}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <FileText size={18} />
              Estado de Cuenta (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Panel de Filtros */}
      {showFiltros && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Filtros Avanzados</h3>
            <button
              onClick={() => setShowFiltros(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Búsqueda */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Pedido
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Número de pedido..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            {/* Estado Pedido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado del Pedido
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Preparación">En Preparación</option>
                <option value="Enviado Parcial">Enviado Parcial</option>
                <option value="Enviado">Enviado</option>
                <option value="Despachado">Despachado</option>
                <option value="Entregado">Entregado</option>
                <option value="Completado">Completado</option>
                <option value="Anulado">Anulado</option>
              </select>
            </div>

            {/* Estado Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado de Pago
              </label>
              <select
                value={filtroPago}
                onChange={(e) => setFiltroPago(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Todos</option>
                <option value="Sin Pagar">Sin Pagar</option>
                <option value="Pago Parcial">Pago Parcial</option>
                <option value="Pagado">Pagado</option>
              </select>
            </div>

            {/* Ordenamiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ordenar por
              </label>
              <select
                value={ordenamiento}
                onChange={(e) => setOrdenamiento(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="fecha-desc">Fecha (más reciente)</option>
                <option value="fecha-asc">Fecha (más antiguo)</option>
                <option value="monto-desc">Monto (mayor a menor)</option>
                <option value="monto-asc">Monto (menor a mayor)</option>
              </select>
            </div>

            {/* Fecha Desde */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Monto Mínimo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Mínimo
              </label>
              <input
                type="number"
                value={montoMin}
                onChange={(e) => setMontoMin(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Monto Máximo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Máximo
              </label>
              <input
                type="number"
                value={montoMax}
                onChange={(e) => setMontoMax(e.target.value)}
                placeholder="999999999"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {filtrosActivos && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={limpiarFiltros}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista de Pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {pedidos.length === 0 ? 'No hay pedidos registrados' : 'No se encontraron pedidos con los filtros aplicados'}
          </h3>
          <p className="text-gray-500">
            {pedidos.length === 0 ? 'Cuando realices un pedido, aparecerá aquí' : 'Intenta cambiar los criterios de búsqueda'}
          </p>
          {pedidos.length > 0 && (
            <button
              onClick={limpiarFiltros}
              className="mt-4 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#D50565' }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => (
            <div
              key={pedido.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {/* Header del Pedido */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div
                    className="flex-1 cursor-pointer hover:bg-gray-50 -m-6 p-6 rounded-lg transition-colors"
                    onClick={() => togglePedido(pedido.id)}
                  >
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-800">
                        Pedido #{String(pedido.numeroPedido || 0).padStart(4, '0')}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getEstadoBadgeColor(
                          pedido.estado
                        )}`}
                      >
                        {pedido.estado}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getEstadoPagoBadgeColor(
                          calcularEstadoPago(pedido)
                        )}`}
                      >
                        <CreditCard size={12} />
                        {calcularEstadoPago(pedido)}
                      </span>
                      {pedido.origenPedido === 'tienda' && (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 bg-indigo-100 text-indigo-800 border-indigo-300"
                        >
                          <ShoppingBag size={12} />
                          Creado en Tienda
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{formatDate(pedido.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package size={16} />
                        <span>
                          {pedido.productos?.length || 0}{' '}
                          {pedido.productos?.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} />
                        <span className="font-semibold" style={{ color: '#D50565' }}>
                          {formatCurrency(pedido.total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generarPDFPedido(pedido);
                      }}
                      className="p-2 text-white rounded-lg hover:opacity-90 transition-colors"
                      style={{ backgroundColor: '#D50565' }}
                      title="Imprimir PDF"
                    >
                      <Printer size={20} />
                    </button>
                    <button
                      onClick={() => togglePedido(pedido.id)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      {expandedPedido === pedido.id ? (
                        <ChevronUp size={24} className="text-gray-600" />
                      ) : (
                        <ChevronDown size={24} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Detalles del Pedido (Expandible) */}
              {expandedPedido === pedido.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  {/* Aviso si el pedido fue anulado */}
                  {esAnulado(pedido) && (
                    <div className="mb-4 p-4 rounded-lg bg-red-50 border-2 border-red-200">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-bold text-red-900 mb-1">
                            Pedido Anulado
                          </p>
                          <p className="text-sm text-red-800">
                            Este pedido fue anulado{pedido.fechaAnulacion ? ` el ${formatDateShort(pedido.fechaAnulacion)}` : ''}. No genera deuda y los abonos fueron devueltos.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Banner de productos con pendientes — no aplica a anulados */}
                  {!esAnulado(pedido) && (() => {
                    const productosConPendientes = pedido.productos?.filter(p => {
                      const cantidadPedida = p.cantidad || 0;
                      const cantidadRecibida = p.cantidadRecibida || 0;
                      const cantidadFaltante = Math.max(0, cantidadPedida - cantidadRecibida);
                      // Producto tiene pendientes si falta recibir unidades del pedido original
                      return cantidadFaltante > 0;
                    }) || [];

                    const totalUnidadesPendientes = productosConPendientes.reduce((sum, p) => {
                      const cantidadPedida = p.cantidad || 0;
                      const cantidadRecibida = p.cantidadRecibida || 0;
                      const cantidadFaltante = Math.max(0, cantidadPedida - cantidadRecibida);
                      return sum + cantidadFaltante;
                    }, 0);

                    if (productosConPendientes.length > 0) {
                      return (
                        <div className="mb-4 p-4 rounded-lg bg-orange-50 border-2 border-orange-200">
                          <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-bold text-orange-900 mb-1">
                                📦 Tienes {productosConPendientes.length} producto{productosConPendientes.length !== 1 ? 's' : ''} con unidades pendientes
                              </p>
                              <p className="text-sm text-orange-800">
                                Te {totalUnidadesPendientes !== 1 ? 'faltan' : 'falta'} recibir <span className="font-semibold">{totalUnidadesPendientes} unidad{totalUnidadesPendientes !== 1 ? 'es' : ''}</span> para completar tu pedido.
                                {productosConPendientes.some(p => {
                                  const cantidadEnviada = p.cantidadEnviada || 0;
                                  const cantidadRecibida = p.cantidadRecibida || 0;
                                  return cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada && cantidadRecibida < (p.cantidad || 0);
                                }) && ' Estamos preparando las prendas faltantes para enviártelas a la brevedad.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Productos con Estado de Envío */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Package size={18} />
                      Productos
                    </h4>

                    {/* Filtros de productos */}
                    <div className="mb-4 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          value={filtroProductosPedido}
                          onChange={(e) => setFiltroProductosPedido(e.target.value)}
                          placeholder="Buscar producto por descripción, código o talla..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                      </div>

                      {/* Checkbox para mostrar solo productos con pendientes */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={soloConPendientesPedido}
                          onChange={(e) => setSoloConPendientesPedido(e.target.checked)}
                          className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                        />
                        <span className="text-sm text-gray-700 font-medium">Solo productos con pendientes</span>
                      </label>

                      {(filtroProductosPedido || soloConPendientesPedido) && (
                        <p className="text-xs text-gray-500">
                          Mostrando {pedido.productos?.filter(p => {
                            // Filtro por búsqueda de texto
                            if (filtroProductosPedido.trim()) {
                              const busqueda = filtroProductosPedido.toLowerCase().trim();
                              const descripcion = (p.descripcion || '').toLowerCase();
                              const codigo = (p.codigo || '').toLowerCase();
                              const talla = (p.talla || '').toLowerCase();
                              const coincideBusqueda = descripcion.includes(busqueda) || codigo.includes(busqueda) || talla.includes(busqueda);
                              if (!coincideBusqueda) return false;
                            }

                            // Filtro por pendientes
                            if (soloConPendientesPedido) {
                              const cantidadPedida = p.cantidad || 0;
                              const cantidadRecibida = p.cantidadRecibida || 0;
                              const cantidadFaltante = Math.max(0, cantidadPedida - cantidadRecibida);
                              if (cantidadFaltante === 0) return false;
                            }

                            return true;
                          }).length || 0} de {pedido.productos?.length || 0} productos
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {pedido.productos?.map((producto, originalIndex) => ({ ...producto, _originalIndex: originalIndex }))
                      .filter(producto => {
                        // Filtro por búsqueda de texto
                        if (filtroProductosPedido.trim()) {
                          const busqueda = filtroProductosPedido.toLowerCase().trim();
                          const descripcion = (producto.descripcion || '').toLowerCase();
                          const codigo = (producto.codigo || '').toLowerCase();
                          const talla = (producto.talla || '').toLowerCase();
                          const coincideBusqueda = descripcion.includes(busqueda) || codigo.includes(busqueda) || talla.includes(busqueda);
                          if (!coincideBusqueda) return false;
                        }

                        // Filtro por pendientes
                        if (soloConPendientesPedido) {
                          const cantidadPedida = producto.cantidad || 0;
                          const cantidadRecibida = producto.cantidadRecibida || 0;
                          const cantidadFaltante = Math.max(0, cantidadPedida - cantidadRecibida);
                          if (cantidadFaltante === 0) return false;
                        }

                        return true;
                      }).map((producto) => {
                        const cantidadPedida = producto.cantidad || 0;
                        const cantidadEnviada = producto.cantidadEnviada || 0;
                        const cantidadRecibida = producto.cantidadRecibida || 0;

                        // Pendientes de recepción: lo que falta confirmar de lo enviado
                        const cantidadPendienteRecibir = cantidadEnviada - cantidadRecibida;

                        // Pendientes del pedido original: lo que falta para completar lo que pidió
                        const cantidadFaltantePedido = Math.max(0, cantidadPedida - cantidadRecibida);

                        // Hay discrepancia activa si recibió menos de lo enviado Y aún no tiene todo lo que pidió
                        const hayDiscrepancia = cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada && cantidadRecibida < cantidadPedida;

                        // El pedido está completo cuando recibió todo lo que pidió originalmente
                        const pedidoCompleto = cantidadRecibida >= cantidadPedida;

                        return (
                          <div
                            key={producto._originalIndex}
                            className="bg-white p-4 rounded-lg border border-gray-200"
                          >
                            {/* Header del Producto */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                  {producto.descripcion}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                  Talla: {producto.talla} • Código: {producto.codigo}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-800">
                                  {formatCurrency(producto.subtotal)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(producto.precioUnitario)} c/u
                                </p>
                              </div>
                            </div>

                            {/* Cantidades - Solo mostrar si hay productos enviados */}
                            {cantidadEnviada > 0 && (
                              <div className="grid grid-cols-4 gap-2 mb-3">
                                <div className="bg-gray-50 rounded-lg p-2 text-center border">
                                  <p className="text-xs text-gray-500">Pedidas</p>
                                  <p className="text-base font-bold text-gray-800">{cantidadPedida}</p>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
                                  <p className="text-xs text-purple-600">Enviadas</p>
                                  <p className="text-base font-bold text-purple-700">{cantidadEnviada}</p>
                                </div>
                                <div className={`rounded-lg p-2 text-center border ${
                                  cantidadRecibida > 0
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  <p className={`text-xs ${cantidadRecibida > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                    Recibidas
                                  </p>
                                  <p className={`text-base font-bold ${cantidadRecibida > 0 ? 'text-green-700' : 'text-gray-600'}`}>
                                    {cantidadRecibida}
                                  </p>
                                </div>
                                <div className={`rounded-lg p-2 text-center border ${
                                  cantidadFaltantePedido > 0
                                    ? 'bg-orange-50 border-orange-200'
                                    : pedidoCompleto
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  <p className={`text-xs ${
                                    cantidadFaltantePedido > 0
                                      ? 'text-orange-600'
                                      : pedidoCompleto
                                      ? 'text-green-600'
                                      : 'text-gray-500'
                                  }`}>
                                    Pendientes
                                  </p>
                                  <p className={`text-base font-bold ${
                                    cantidadFaltantePedido > 0
                                      ? 'text-orange-700'
                                      : pedidoCompleto
                                      ? 'text-green-700'
                                      : 'text-gray-600'
                                  }`}>
                                    {cantidadFaltantePedido}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Historial completo de recepciones */}
                            {producto.historialRecepciones && producto.historialRecepciones.length > 0 && (() => {
                              // Calcular offset: si la primera entrada tiene más acumuladas que reportadas, hubo recepciones previas
                              const primeraEntrada = producto.historialRecepciones[0];
                              const recepcionesPrevias = primeraEntrada.cantidadAcumulada - primeraEntrada.cantidadReportada > 0 ? 1 : 0;
                              return (
                              <div className="mb-3 p-3 rounded-lg border bg-gray-50 border-gray-200">
                                <p className="font-semibold mb-2 text-gray-700 text-xs flex items-center gap-1">
                                  📋 Mi Historial de Recepciones ({producto.historialRecepciones.length + recepcionesPrevias})
                                </p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {producto.historialRecepciones.map((registro, idx) => {
                                    const fechaRegistro = new Date(registro.fecha);
                                    return (
                                      <div
                                        key={idx}
                                        className={`p-2 rounded border text-xs ${
                                          registro.discrepancia
                                            ? 'bg-yellow-50 border-yellow-200'
                                            : 'bg-green-50 border-green-200'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium">
                                            {registro.discrepancia ? '⚠️' : '✅'} Recepción #{idx + 1 + recepcionesPrevias}
                                          </span>
                                          <span className="text-gray-500">
                                            {fechaRegistro.toLocaleDateString('es-CO')} {fechaRegistro.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="text-gray-700">
                                          <strong>Recibí:</strong> {registro.cantidadReportada} unidades
                                          <span className="text-gray-500 ml-1">(Total: {registro.cantidadAcumulada}/{registro.cantidadEnviadaAlMomento})</span>
                                        </p>
                                        {registro.observaciones && (
                                          <p className={`mt-1 p-1 rounded ${registro.discrepancia ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                                            <strong>Mis observaciones:</strong> {registro.observaciones}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              );
                            })()}

                            {/* Observaciones de recepción (compatibilidad con datos anteriores sin historial) */}
                            {!producto.historialRecepciones && producto.observacionesRecepcion && (
                              <div className={`mb-3 p-3 rounded-lg border flex items-start gap-2 ${
                                hayDiscrepancia
                                  ? 'bg-yellow-50 border-yellow-200'
                                  : 'bg-blue-50 border-blue-200'
                              }`}>
                                {hayDiscrepancia ? (
                                  <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className={`text-xs flex-1 ${hayDiscrepancia ? 'text-yellow-800' : 'text-blue-800'}`}>
                                  <p className="font-semibold mb-1">
                                    {hayDiscrepancia ? '⚠️ Observaciones de Recepción' : 'Observaciones de Recepción'}
                                  </p>
                                  <p>{producto.observacionesRecepcion}</p>
                                  {hayDiscrepancia && (
                                    <p className="mt-2 font-medium text-yellow-700">
                                      Recibidas: {cantidadRecibida} de {cantidadEnviada} unidades enviadas
                                    </p>
                                  )}
                                  {producto.fechaRecepcion && (
                                    <p className="text-gray-500 mt-1">
                                      Fecha: {(producto.fechaRecepcion.toDate ? producto.fechaRecepcion.toDate() : new Date(producto.fechaRecepcion)).toLocaleString('es-CO')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Mensaje informativo sobre productos pendientes por discrepancia */}
                            {!pedidoCompleto && cantidadFaltantePedido > 0 && hayDiscrepancia && (
                              <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
                                <ShoppingBag size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-blue-800 flex-1">
                                  <p className="font-semibold mb-1">📦 Productos Pendientes en Preparación</p>
                                  <p>
                                    Estamos alistando <span className="font-bold">{cantidadFaltantePedido} unidad{cantidadFaltantePedido !== 1 ? 'es' : ''}</span> adicional{cantidadFaltantePedido !== 1 ? 'es' : ''} para completar tu pedido.
                                    Te notificaremos cuando {cantidadFaltantePedido !== 1 ? 'estén' : 'esté'} {cantidadFaltantePedido !== 1 ? 'listas' : 'lista'} para envío.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Mensaje de pedido completo */}
                            {pedidoCompleto && cantidadRecibida > 0 && (
                              <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                                <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-green-800 flex-1">
                                  <p className="font-semibold">✅ Pedido Completo</p>
                                  <p>Has recibido todas las {cantidadPedida} unidades que pediste de este producto.</p>
                                </div>
                              </div>
                            )}

                            {/* Botón Confirmar Recepción — no aplica a pedidos anulados */}
                            {cantidadPendienteRecibir > 0 && !pedidoCompleto && !esAnulado(pedido) && (
                              <button
                                onClick={() => {
                                  setProductoConfirmar({
                                    ...producto,
                                    index: producto._originalIndex,
                                    pedidoId: pedido.id
                                  });
                                  setCantidadRecibida(''); // IMPORTANTE: No pre-llenar, el cliente debe escribir manualmente
                                  setObservaciones('');
                                  setShowConfirmarRecepcionModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-colors"
                                style={{ backgroundColor: '#D50565' }}
                              >
                                <CheckCircle size={16} />
                                Confirmar Recepción ({cantidadPendienteRecibir} unidad{cantidadPendienteRecibir !== 1 ? 'es' : ''})
                              </button>
                            )}

                            {/* Badge de producto completamente recibido */}
                            {pedidoCompleto && (
                              <div className="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg py-2">
                                <CheckCircle size={14} />
                                Producto completamente recibido
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Historial de Abonos */}
                  {pedido.abonos && pedido.abonos.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <DollarSign size={18} />
                        Historial de Abonos
                      </h4>
                      <div className="space-y-2">
                        {pedido.abonos.map((abono, index) => (
                          <div
                            key={index}
                            className="bg-green-50 border border-green-200 p-3 rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-green-800">
                                  {formatCurrency(abono.monto)}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {formatDate(abono.fecha)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">{abono.notas}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notas */}
                  {pedido.notas && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText size={18} />
                        Notas
                      </h4>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <p className="text-gray-700 whitespace-pre-wrap">{pedido.notas}</p>
                      </div>
                    </div>
                  )}

                  {/* Resumen Financiero — para anulados, mostrar historial original */}
                  <div className="bg-white p-4 rounded-lg border-2" style={{ borderColor: esAnulado(pedido) ? '#999' : '#D50565' }}>
                    {esAnulado(pedido) ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Total Original:</span>
                          <span className="font-semibold text-gray-500 line-through">
                            {formatCurrency(pedido.totalOriginal || 0)}
                          </span>
                        </div>
                        {pedido.abonosOriginales && pedido.abonosOriginales.length > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Abonado (devuelto):</span>
                            <span className="font-semibold text-gray-500 line-through">
                              {formatCurrency(
                                pedido.abonosOriginales.reduce((sum, a) => sum + (a.monto || 0), 0)
                              )}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-lg font-bold text-gray-800">Saldo:</span>
                          <span className="text-2xl font-bold text-gray-500">
                            {formatCurrency(0)}
                          </span>
                        </div>
                      </div>
                    ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Total del Pedido:</span>
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(pedido.total)}
                        </span>
                      </div>
                      {pedido.abonos && pedido.abonos.length > 0 && (
                        <>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Total Abonado:</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(
                                pedido.abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-lg font-bold text-gray-800">Saldo Pendiente:</span>
                            <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                              {formatCurrency(
                                pedido.total - pedido.abonos.reduce((sum, abono) => sum + (abono.monto || 0), 0)
                              )}
                            </span>
                          </div>
                        </>
                      )}
                      {(!pedido.abonos || pedido.abonos.length === 0) && (
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-lg font-bold text-gray-800">Saldo Pendiente:</span>
                          <span className="text-2xl font-bold" style={{ color: '#D50565' }}>
                            {formatCurrency(pedido.total)}
                          </span>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Confirmar Recepción */}
      {showConfirmarRecepcionModal && productoConfirmar && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b px-4 md:px-6 py-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">Confirmar Recepción</h2>
              <button
                onClick={() => {
                  setShowConfirmarRecepcionModal(false);
                  setCantidadRecibida('');
                  setObservaciones('');
                  setProductoConfirmar(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {/* Info del Producto */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  {productoConfirmar.descripcion}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Talla:</span>
                    <span className="ml-2 font-medium">{productoConfirmar.talla}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Código:</span>
                    <span className="ml-2 font-medium">{productoConfirmar.codigo}</span>
                  </div>
                </div>
              </div>

              {/* Estado Actual */}
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2 text-sm">Estado de Envío</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-600">Pedidas</p>
                    <p className="font-bold text-gray-800">{productoConfirmar.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Enviadas</p>
                    <p className="font-bold text-purple-700">{productoConfirmar.cantidadEnviada || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ya Recibidas</p>
                    <p className="font-bold text-green-700">{productoConfirmar.cantidadRecibida || 0}</p>
                  </div>
                </div>
              </div>

              {/* Instrucciones claras */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-sm text-blue-800 font-medium">
                  ⚠️ IMPORTANTE: Ingresa SOLO la cantidad que recibiste en esta entrega.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Si recibiste menos de lo enviado, escribe el número exacto que llegó.
                </p>
              </div>

              {/* Cantidad Recibida */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Cuántas unidades recibiste? *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={cantidadRecibida}
                    onChange={(e) => setCantidadRecibida(e.target.value)}
                    min="1"
                    max={(productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)}
                    placeholder="Escribe la cantidad aquí"
                    className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setCantidadRecibida(((productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)).toString())}
                    className="px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 whitespace-nowrap"
                  >
                    Todas ({(productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)})
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 font-medium">
                  Pendientes por recibir: {(productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)} unidades
                </p>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Productos recibidos en perfecto estado, alguna unidad con defecto, etc."
                  rows={3}
                  className="w-full px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si hay alguna diferencia con lo enviado o problema con los productos, descríbelo aquí
                </p>
              </div>

              {/* Advertencia de discrepancia */}
              {parseInt(cantidadRecibida) > 0 &&
               parseInt(cantidadRecibida) < ((productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)) && (
                <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-yellow-900 text-sm">⚠️ DISCREPANCIA DETECTADA</p>
                      <p className="text-xs text-yellow-800 mt-1">
                        Estás reportando que recibiste <span className="font-bold">{parseInt(cantidadRecibida)}</span> unidad{parseInt(cantidadRecibida) !== 1 ? 'es' : ''},
                        pero se enviaron <span className="font-bold">{(productoConfirmar.cantidadEnviada || 0) - (productoConfirmar.cantidadRecibida || 0)}</span>.
                      </p>
                      <p className="text-xs text-yellow-700 mt-2 font-medium bg-yellow-100 p-2 rounded">
                        👉 Por favor explica en OBSERVACIONES por qué faltaron unidades (ej: "Solo llegaron 2 de 4 enviadas")
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowConfirmarRecepcionModal(false);
                    setCantidadRecibida('');
                    setObservaciones('');
                    setProductoConfirmar(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarRecepcion}
                  disabled={confirmandoRecepcion || !cantidadRecibida || parseInt(cantidadRecibida) <= 0}
                  className="w-full sm:flex-1 px-4 py-2 text-sm md:text-base text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#D50565' }}
                >
                  {confirmandoRecepcion ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    'Confirmar Recepción'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MisPedidos;
