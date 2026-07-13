import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, History, Clock, RefreshCw } from 'lucide-react';
import { getAlistadaActual, productoB2BCoincideConAsignacion } from '../../utils/pedidosB2BLogic';
import { calcularEstadoItemPOS } from '../../utils/stockLogic';

const CuentasPorPagar = () => {
  const [cuentasPorSatelite, setCuentasPorSatelite] = useState([]);
  const [historialPorSatelite, setHistorialPorSatelite] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSatelite, setExpandedSatelite] = useState(null);
  const [expandedHistorial, setExpandedHistorial] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingAnulacion, setProcessingAnulacion] = useState(false);
  const [processingCostos, setProcessingCostos] = useState(false);
  const [entradasSinCosto, setEntradasSinCosto] = useState(0);
  const [activeTab, setActiveTab] = useState('pendientes'); // 'pendientes' o 'historial'

  useEffect(() => {
    fetchCuentasPorPagar();
  }, []);

  const fetchCuentasPorPagar = async () => {
    setLoading(true);
    try {
      // 1. Obtener todos los satélites
      const satelitesSnapshot = await getDocs(collection(db, 'satelites'));
      const satelitesData = satelitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 2. Obtener TODAS las entradas de satélite (pagadas y no pagadas)
      const qTodas = query(
        collection(db, 'stockEntries'),
        where('tipoEntrada', '==', 'satelite')
      );
      const todasEntradasSnapshot = await getDocs(qTodas);
      const todasEntradas = todasEntradasSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(entrada => !entrada.anulada); // Excluir entradas anuladas

      // 3. Separar entradas pendientes y pagadas
      const entradasPendientes = todasEntradas.filter(e => e.pagado === false || e.pagado === undefined);
      const entradasPagadas = todasEntradas.filter(e => e.pagado === true);

      // 4. Agrupar PENDIENTES por satélite
      const cuentasMap = new Map();
      entradasPendientes.forEach(entrada => {
        const sateliteId = entrada.sateliteId;
        if (!cuentasMap.has(sateliteId)) {
          cuentasMap.set(sateliteId, {
            sateliteId: sateliteId,
            entradas: [],
            totalAdeudado: 0
          });
        }
        const cuenta = cuentasMap.get(sateliteId);
        cuenta.entradas.push(entrada);
        cuenta.totalAdeudado += entrada.costoTotal || 0;
      });

      // Ordenar entradas de cada satélite por fecha (más reciente primero)
      cuentasMap.forEach(cuenta => {
        cuenta.entradas.sort((a, b) => {
          const fechaA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const fechaB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return fechaB - fechaA;
        });
      });

      // 5. Convertir a array y agregar información del satélite
      const cuentasArray = Array.from(cuentasMap.values()).map(cuenta => {
        const satelite = satelitesData.find(s => s.id === cuenta.sateliteId);
        return {
          ...cuenta,
          sateliteNombre: satelite?.nombre || 'Satélite desconocido',
          sateliteCodigo: satelite?.codigo || 'N/A'
        };
      });
      cuentasArray.sort((a, b) => b.totalAdeudado - a.totalAdeudado);
      setCuentasPorSatelite(cuentasArray);

      // 6. Agrupar HISTORIAL (pagadas) por satélite - TODOS los satélites
      const historialMap = new Map();

      // Inicializar todos los satélites en el historial
      satelitesData.forEach(sat => {
        historialMap.set(sat.id, {
          sateliteId: sat.id,
          sateliteNombre: sat.nombre || 'Sin nombre',
          sateliteCodigo: sat.codigo || 'N/A',
          entradasPagadas: [],
          totalPagado: 0,
          entradasPendientesCount: 0,
          totalPendiente: 0
        });
      });

      // Agregar entradas pagadas
      entradasPagadas.forEach(entrada => {
        const sateliteId = entrada.sateliteId;
        if (historialMap.has(sateliteId)) {
          const historial = historialMap.get(sateliteId);
          historial.entradasPagadas.push(entrada);
          historial.totalPagado += entrada.costoTotal || 0;
        }
      });

      // Agregar conteo de pendientes
      entradasPendientes.forEach(entrada => {
        const sateliteId = entrada.sateliteId;
        if (historialMap.has(sateliteId)) {
          const historial = historialMap.get(sateliteId);
          historial.entradasPendientesCount += 1;
          historial.totalPendiente += entrada.costoTotal || 0;
        }
      });

      // Ordenar entradas pagadas por fecha de pago (más reciente primero)
      historialMap.forEach(historial => {
        historial.entradasPagadas.sort((a, b) => {
          const fechaA = a.fechaPago?.toDate ? a.fechaPago.toDate() : (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0));
          const fechaB = b.fechaPago?.toDate ? b.fechaPago.toDate() : (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0));
          return fechaB - fechaA;
        });
      });

      // Convertir a array y ordenar por nombre
      const historialArray = Array.from(historialMap.values())
        .sort((a, b) => a.sateliteNombre.localeCompare(b.sateliteNombre));

      setHistorialPorSatelite(historialArray);

      // Contar entradas sin costo (para mostrar botón de actualización)
      const sinCosto = todasEntradas.filter(e => !e.costoTotal || e.costoTotal === 0).length;
      setEntradasSinCosto(sinCosto);

    } catch (error) {
      console.error('Error al cargar cuentas por pagar:', error);
      alert('Error al cargar las cuentas por pagar.');
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar costos de entradas que no tienen valor
  const handleActualizarCostos = async () => {
    const confirmarInicio = window.confirm(
      '⚠️ ACTUALIZAR COSTOS DE ENTRADAS\n\n' +
      'Este proceso buscará las entradas de satélite que tienen costo $0 ' +
      'y les asignará el costo actual del producto.\n\n' +
      '¿Deseas continuar?'
    );

    if (!confirmarInicio) return;

    setProcessingCostos(true);
    try {
      // 1. Obtener todas las entradas de satélite
      const qEntradas = query(
        collection(db, 'stockEntries'),
        where('tipoEntrada', '==', 'satelite')
      );
      const entradasSnapshot = await getDocs(qEntradas);

      // 2. Filtrar las que no tienen costo
      const entradasSinCostoList = entradasSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => !e.anulada && (!e.costoTotal || e.costoTotal === 0));

      if (entradasSinCostoList.length === 0) {
        alert('✅ ¡No hay entradas que necesiten actualización!');
        return;
      }

      // 3. Obtener todos los productos
      const productosSnapshot = await getDocs(collection(db, 'products'));
      const productosMap = new Map();
      productosSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        productosMap.set(docSnap.id, data);
        // También indexar por referencia+talla
        if (data.referencia) {
          productosMap.set(`ref_${data.referencia}_${data.talla || ''}`, { ...data, id: docSnap.id });
        }
      });

      // 4. Preparar actualizaciones
      const actualizaciones = [];
      const sinCostoSatelite = [];

      for (const entrada of entradasSinCostoList) {
        let producto = productosMap.get(entrada.productId);

        // Buscar por referencia si no se encontró por ID
        if (!producto && entrada.referencia) {
          producto = productosMap.get(`ref_${entrada.referencia}_${entrada.talla || ''}`);
        }

        if (!producto) continue;

        const costoSatelite = producto.costoSatelite || 0;
        if (costoSatelite === 0) {
          sinCostoSatelite.push(entrada);
          continue;
        }

        const cantidad = entrada.cantidad || 0;
        const nuevoCostoTotal = costoSatelite * cantidad;

        actualizaciones.push({
          entrada,
          costoUnitario: costoSatelite,
          costoTotal: nuevoCostoTotal
        });
      }

      // Mostrar productos sin costoSatelite configurado
      if (sinCostoSatelite.length > 0) {
        const productosUnicos = [...new Set(sinCostoSatelite.map(e => `${e.referencia} - ${e.nombre}`))];
        console.log('⚠️ Productos sin costoSatelite:', productosUnicos);

        let mensajeProductos = '⚠️ PRODUCTOS SIN COSTO CONFIGURADO:\n\n';
        productosUnicos.slice(0, 10).forEach(p => {
          mensajeProductos += `• ${p}\n`;
        });
        if (productosUnicos.length > 10) {
          mensajeProductos += `... y ${productosUnicos.length - 10} más\n`;
        }
        mensajeProductos += '\n👉 Configura estos costos en:\nConfiguración > Gestión de Costos';

        if (actualizaciones.length === 0) {
          alert(mensajeProductos);
          return;
        } else {
          // Hay algunos que sí se pueden actualizar, mostrar aviso
          alert(mensajeProductos + '\n\n✅ Se actualizarán los demás productos.');
        }
      }

      if (actualizaciones.length === 0) {
        alert('⚠️ No se encontraron entradas que se puedan actualizar.');
        return;
      }

      // 5. Mostrar resumen y confirmar
      const totalAPagar = actualizaciones.reduce((sum, a) => sum + a.costoTotal, 0);
      const confirmarAplicar = window.confirm(
        `📊 RESUMEN DE ACTUALIZACIÓN\n\n` +
        `• Entradas a actualizar: ${actualizaciones.length}\n` +
        `• Total a registrar: $${totalAPagar.toLocaleString('es-CO')}\n\n` +
        `¿Aplicar estos cambios?`
      );

      if (!confirmarAplicar) return;

      // 6. Aplicar en batches
      const batchSize = 400;
      for (let i = 0; i < actualizaciones.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = actualizaciones.slice(i, i + batchSize);

        for (const { entrada, costoUnitario, costoTotal } of chunk) {
          const entradaRef = doc(db, 'stockEntries', entrada.id);
          batch.update(entradaRef, { costoUnitario, costoTotal });
        }

        await batch.commit();
      }

      // 7. Actualizar transacciones asociadas
      for (const { entrada, costoUnitario, costoTotal } of actualizaciones) {
        const transQuery = query(
          collection(db, 'transactions'),
          where('entradaId', '==', entrada.id),
          where('tipo', '==', 'entrada_satelite')
        );
        const transSnapshot = await getDocs(transQuery);

        if (!transSnapshot.empty) {
          const batch = writeBatch(db);
          transSnapshot.docs.forEach(transDoc => {
            const transRef = doc(db, 'transactions', transDoc.id);
            batch.update(transRef, {
              monto: -costoTotal,
              costoUnitario
            });
          });
          await batch.commit();
        }
      }

      alert(
        `✅ ACTUALIZACIÓN COMPLETADA\n\n` +
        `• Entradas actualizadas: ${actualizaciones.length}\n` +
        `• Total registrado: $${totalAPagar.toLocaleString('es-CO')}`
      );

      // Recargar datos
      await fetchCuentasPorPagar();

    } catch (error) {
      console.error('Error al actualizar costos:', error);
      alert('❌ Error al actualizar los costos: ' + error.message);
    } finally {
      setProcessingCostos(false);
    }
  };

  const toggleExpandSatelite = (sateliteId) => {
    if (expandedSatelite === sateliteId) {
      setExpandedSatelite(null);
    } else {
      setExpandedSatelite(sateliteId);
    }
  };

  const toggleExpandHistorial = (sateliteId) => {
    if (expandedHistorial === sateliteId) {
      setExpandedHistorial(null);
    } else {
      setExpandedHistorial(sateliteId);
    }
  };

  const handleMarcarComoPagado = async (sateliteId, entradaIds) => {
    // Paso 1: Preguntar de dónde sale el dinero
    const origenDinero = window.prompt(
      '¿De dónde sale el dinero para este pago?\n\n' +
      '1 = CAJA (efectivo del local - aparecerá en Cierre de Caja)\n' +
      '2 = CUENTA PERSONAL (transferencia/efectivo Martha - NO aparece en Cierre de Caja)\n\n' +
      'Ingresa el número (1 o 2):'
    );

    if (!origenDinero) return; // Cancelado

    let origenDineroTexto;
    let afectaCaja;
    if (origenDinero === '1') {
      origenDineroTexto = 'Caja';
      afectaCaja = true;
    } else if (origenDinero === '2') {
      origenDineroTexto = 'Cuenta Personal';
      afectaCaja = false;
    } else {
      alert('Opción inválida. Debe ser 1 o 2.');
      return;
    }

    // Paso 2: Preguntar método de pago
    const metodoPago = window.prompt(
      `Origen: ${origenDineroTexto}\n\n` +
      'Ahora selecciona el método de pago:\n\n' +
      '1 = Efectivo\n' +
      '2 = Transferencia\n\n' +
      'Ingresa el número (1 o 2):'
    );

    if (!metodoPago) return; // Cancelado

    let metodoPagoTexto;
    if (metodoPago === '1') {
      metodoPagoTexto = 'Efectivo';
    } else if (metodoPago === '2') {
      metodoPagoTexto = 'Transferencia';
    } else {
      alert('Opción inválida. Debe ser 1 o 2.');
      return;
    }

    const confirmacion = window.confirm(
      `¿Confirmas el pago?\n\n` +
      `• Origen del dinero: ${origenDineroTexto}\n` +
      `• Método de pago: ${metodoPagoTexto}\n` +
      `${afectaCaja ? '• APARECERÁ en el Cierre de Caja' : '• NO aparecerá en el Cierre de Caja'}\n\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmacion) return;

    setProcessingPayment(true);
    try {
      const batch = writeBatch(db);

      // Para cada entrada, buscar su transacción asociada y actualizarla
      for (const entradaId of entradaIds) {
        // Leer datos actuales de la entrada (necesarios para crear transacción si falta)
        const entradaRef = doc(db, 'stockEntries', entradaId);
        const entradaSnap = await getDoc(entradaRef);
        const entradaData = entradaSnap.exists() ? entradaSnap.data() : {};

        // Actualizar entrada como pagada
        batch.update(entradaRef, {
          pagado: true,
          fechaPago: serverTimestamp(),
          metodoPago: metodoPagoTexto,
          origenDinero: origenDineroTexto,
          afectaCaja: afectaCaja
        });

        // Buscar y actualizar la transacción asociada
        const transQuery = query(
          collection(db, 'transactions'),
          where('entradaId', '==', entradaId),
          where('tipo', '==', 'entrada_satelite')
        );
        const transSnapshot = await getDocs(transQuery);

        if (!transSnapshot.empty) {
          // Actualizar la transacción con el método real y origen del dinero
          transSnapshot.forEach(transDoc => {
            const transRef = doc(db, 'transactions', transDoc.id);
            const updateData = {
              metodoPago: metodoPagoTexto,
              origenDinero: origenDineroTexto,
              afectaCaja: afectaCaja,
              fechaPago: serverTimestamp()
            };
            // Si afecta caja, alinear `fecha` al momento del pago para que el cierre
            // de caja la cuente en el día en que realmente salió el dinero.
            if (afectaCaja) {
              updateData.fecha = serverTimestamp();
            }
            batch.update(transRef, updateData);
          });
        } else if (afectaCaja && (entradaData.costoTotal || 0) > 0) {
          // La entrada no tiene transacción (fue registrada cuando el costo era $0
          // y se actualizó después). Como afecta caja, crearla ahora para que
          // aparezca correctamente en el cierre del día del pago.
          const newTransRef = doc(collection(db, 'transactions'));
          batch.set(newTransRef, {
            tipo: 'entrada_satelite',
            monto: -(entradaData.costoTotal),
            metodoPago: metodoPagoTexto,
            afectaCaja: true,
            origenDinero: origenDineroTexto,
            entradaId: entradaId,
            descripcion: `Entrada de satélite: ${entradaData.nombre || ''} (${entradaData.cantidad || 0} uds) - ${entradaData.sateliteNombre || ''}`,
            productId: entradaData.productId || '',
            productoNombre: entradaData.nombre || '',
            sateliteId: entradaData.sateliteId || '',
            sateliteNombre: entradaData.sateliteNombre || '',
            cantidad: entradaData.cantidad || 0,
            costoUnitario: entradaData.costoUnitario || 0,
            userId: entradaData.userId || '',
            fecha: serverTimestamp(),
            fechaPago: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();

      alert(`✅ ¡Entradas marcadas como pagadas!\n\n• Método: ${metodoPagoTexto}\n• Origen: ${origenDineroTexto}`);

      // Recargar datos
      await fetchCuentasPorPagar();
      setExpandedSatelite(null);
    } catch (error) {
      console.error('Error al marcar como pagado:', error);
      alert('Error al procesar el pago. Intenta de nuevo.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAnularEntrada = async (entrada) => {
    // Construir mensaje de confirmación con detalles
    const detallesAnulacion = `
Esta acción ANULARÁ la entrada y revertirá los siguientes cambios:

📦 Producto: ${entrada.nombre}
📋 Referencia: ${entrada.referencia}
🔢 Cantidad a revertir: ${entrada.cantidad} unidades

📊 Cambios en Inventario:
   • STOCK TOTAL: -${entrada.cantidad} unidades
   ${entrada.cantidadAsignada > 0 ? `• RES. PEDIDOS: -${entrada.cantidadAsignada} unidades` : ''}

${entrada.asignaciones && entrada.asignaciones.length > 0 ? `📋 Pedidos Afectados:
${entrada.asignaciones.map(asig =>
  `   • Pedido #${asig.numeroPedido || asig.pedidoId.slice(-6)}: ${asig.cantidad} item(s) ${asig.clienteNombre ? `(${asig.clienteNombre})` : ''} volverán a "En Producción"`
).join('\n')}` : ''}

⚠️ Esta acción NO se puede deshacer.

¿Estás seguro de anular esta entrada?
    `.trim();

    const confirmacion = window.confirm(detallesAnulacion);
    if (!confirmacion) return;

    setProcessingAnulacion(true);
    try {
      const batch = writeBatch(db);

      // Guard de doble anulación: releer la entrada fresca. El botón se oculta
      // en la UI, pero dos pantallas desincronizadas podían anular dos veces y
      // revertir el stock doble.
      const entradaRef = doc(db, 'stockEntries', entrada.id);
      const entradaSnap = await getDoc(entradaRef);
      if (!entradaSnap.exists() || entradaSnap.data().anulada === true) {
        alert('⚠️ Esta entrada ya fue anulada (o ya no existe). Recarga la página para actualizar la lista.');
        return;
      }

      // Bug 4: revertir TODAS las asignaciones (parciales + completas). Las
      // reservas del producto se descuentan con lo EFECTIVAMENTE revertido en
      // cada pedido, no con los montos nominales de la entrada.
      let cantidadReservadaPedidos = 0;
      let cantidadReservadaB2B = 0;

      // 1. Revertir cambios en los pedidos — todas las asignaciones, no solo las completas.
      // Bug 10: agrupar por pedido y aplicar todas las reversiones sobre UNA sola
      // lectura/escritura por documento. Con 2+ asignaciones al mismo pedido, cada
      // batch.update pisaba al anterior (la relectura no ve writes staged del batch)
      // y se perdía una reversión mientras las reservas se decrementaban por ambas.
      if (entrada.asignaciones && entrada.asignaciones.length > 0) {
        const asignacionesPorPedido = new Map();
        for (const asig of entrada.asignaciones) {
          const tipo = asig.tipo || 'pedido';
          const key = `${tipo}:${asig.pedidoId}`;
          if (!asignacionesPorPedido.has(key)) {
            asignacionesPorPedido.set(key, { tipo, pedidoId: asig.pedidoId, asigs: [] });
          }
          asignacionesPorPedido.get(key).asigs.push(asig);
        }

        // Reconstruye los identificadores para el matching. Las entradas viejas no
        // los persistían, así que caemos a los datos top-level de la entrada.
        const conMatching = (asig) => (asig.referencia || asig.productoId || asig.descripcion)
          ? asig
          : {
              ...asig,
              referencia: entrada.referencia,
              talla: entrada.talla,
              productoId: entrada.productId,
              descripcion: entrada.nombre
            };

        for (const { tipo, pedidoId, asigs } of asignacionesPorPedido.values()) {
          if (tipo === 'pedido') {
            // PEDIDO POS — buscar item por referencia+talla y recalcular estado
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);
            if (!pedidoSnap.exists()) continue;

            const pedidoData = pedidoSnap.data();
            // Pedido anulado/cancelado: su anulación YA liberó la reserva del
            // producto. Volver a restarla dejaría stockReservadoPedidos negativo
            // → disponible inflado → sobreventa.
            if (pedidoData.anulado === true ||
                pedidoData.estadoGeneral === 'Anulado' ||
                pedidoData.estadoGeneral === 'Cancelado') {
              continue;
            }

            const updatedItems = [...(pedidoData.items || [])];
            let huboCambios = false;

            for (const asig of asigs) {
              const asigForMatching = conMatching(asig);

              // Match con talla coercida + filtro anulado. Preferimos el row con
              // cantidadLista pendiente de revertir; si no hay, cae al primer match.
              // Se excluye 'Cambio de Talla': el item muerto retiene cantidadLista
              // pero su reserva ya se liberó al hacer el cambio.
              const matchItem = (item) =>
                !item.anulado &&
                item.estadoItem !== 'Cambio de Talla' &&
                item.referencia === asigForMatching.referencia &&
                String(item.talla) === String(asigForMatching.talla);

              let itemIndex = updatedItems.findIndex(item =>
                matchItem(item) && (item.cantidadLista || 0) > 0
              );
              if (itemIndex === -1) {
                itemIndex = updatedItems.findIndex(matchItem);
              }
              if (itemIndex === -1) continue;

              const item = updatedItems[itemIndex];
              const cantidadListaActual = item.cantidadLista || 0;
              const nuevaCantidadLista = Math.max(0, cantidadListaActual - asig.cantidad);
              // Solo lo realmente descontado del item libera reserva — si el
              // item ya fue entregado (lista=0), no hay nada que revertir.
              const revertidoEfectivo = cantidadListaActual - nuevaCantidadLista;
              if (revertidoEfectivo <= 0) continue;

              const nuevoEstado = calcularEstadoItemPOS({
                cantidad: item.cantidad,
                cantidadLista: nuevaCantidadLista,
                cantidadEntregada: item.cantidadEntregada || 0
              });

              updatedItems[itemIndex] = {
                ...item,
                cantidadLista: nuevaCantidadLista,
                estadoItem: nuevoEstado
              };
              huboCambios = true;
              cantidadReservadaPedidos += revertidoEfectivo;
            }

            if (huboCambios) {
              batch.update(pedidoRef, {
                items: updatedItems,
                updatedAt: serverTimestamp()
              });
            }
          } else if (tipo === 'pedido_b2b') {
            // PEDIDO B2B (PORTAL)
            const pedidoRef = doc(db, 'pedidos_b2b', pedidoId);
            const pedidoSnap = await getDoc(pedidoRef);
            if (!pedidoSnap.exists()) continue;

            const pedidoData = pedidoSnap.data();
            // Igual que POS: la anulación del pedido B2B ya liberó su reserva.
            if (pedidoData.anulado === true || pedidoData.estado === 'Anulado') {
              continue;
            }

            const productosActualizados = [...(pedidoData.productos || [])];
            let huboCambios = false;

            for (const asig of asigs) {
              const asigForMatching = conMatching(asig);

              // Preferimos el row con alistamiento pendiente de revertir. Si todos
              // los matches están en 0 (porque ya se hizo envío que consumió la
              // alistada), cae al primer match para mantener compat.
              let prodIndex = productosActualizados.findIndex(p =>
                productoB2BCoincideConAsignacion(p, asigForMatching) &&
                getAlistadaActual(p) > 0
              );
              if (prodIndex === -1) {
                prodIndex = productosActualizados.findIndex(p =>
                  productoB2BCoincideConAsignacion(p, asigForMatching)
                );
              }
              if (prodIndex === -1) continue;

              const producto = productosActualizados[prodIndex];
              const cantidadEnviadaProd = producto.cantidadEnviada || 0;
              const alistadaVieja = producto.cantidadAlistadaActual ?? Math.max(0, (producto.cantidadAlistada || 0) - cantidadEnviadaProd);
              const nuevaAlistadaActual = Math.max(0, alistadaVieja - asig.cantidad);
              const nuevaAlistadaTotal = Math.max(0, (producto.cantidadAlistadaTotal ?? (producto.cantidadAlistada || 0)) - asig.cantidad);
              const totalPreparado = nuevaAlistadaActual + cantidadEnviadaProd;

              productosActualizados[prodIndex] = {
                ...producto,
                cantidadAlistadaActual: nuevaAlistadaActual,
                cantidadAlistadaTotal: nuevaAlistadaTotal,
                cantidadAlistada: totalPreparado, // compat
                estadoProduccion: totalPreparado >= producto.cantidad ? 'alistado' : (totalPreparado > 0 ? 'en_produccion' : 'pendiente')
              };
              huboCambios = true;
              // Solo lo realmente descontado de la alistada libera reserva
              cantidadReservadaB2B += alistadaVieja - nuevaAlistadaActual;
            }

            if (huboCambios) {
              batch.update(pedidoRef, {
                productos: productosActualizados,
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      }

      // 2. Revertir stock del producto con montos efectivos y piso en 0 (lectura fresca).
      // Bug 3: solo revertir lo que realmente entró al stockTotal — las defectuosas
      // nunca se sumaron. Para entradas legacy (sin cantidadBuena) caemos a cantidad.
      const productRef = doc(db, 'products', entrada.productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const prodData = productSnap.data() || {};
        // Piso en 0: si parte de lo entrado ya salió (venta/entrega), no dejar
        // stockTotal ni reservas en negativo.
        const cantidadParaRevertir = Math.min(entrada.cantidadBuena ?? entrada.cantidad, prodData.stockTotal || 0);
        const reservaPedidosARevertir = Math.min(cantidadReservadaPedidos, prodData.stockReservadoPedidos || 0);
        const reservaB2BARevertir = Math.min(cantidadReservadaB2B, prodData.stockReservadoB2B || 0);

        const productUpdate = {
          stockTotal: increment(-cantidadParaRevertir),
          updatedAt: serverTimestamp()
        };
        if (reservaPedidosARevertir > 0) {
          productUpdate.stockReservadoPedidos = increment(-reservaPedidosARevertir);
        }
        if (reservaB2BARevertir > 0) {
          productUpdate.stockReservadoB2B = increment(-reservaB2BARevertir);
        }
        batch.update(productRef, productUpdate);
      }

      // 3. Marcar la entrada como anulada
      batch.update(entradaRef, {
        anulada: true,
        fechaAnulacion: serverTimestamp(),
        motivoAnulacion: 'Entrada incorrecta - Producto equivocado'
      });

      // Ejecutar todas las operaciones
      await batch.commit();

      alert('✅ Entrada anulada exitosamente.\n\nLos cambios han sido revertidos:\n- Stock del producto actualizado\n- Items de pedidos devueltos a "En Producción"');

      // Recargar datos
      await fetchCuentasPorPagar();
    } catch (error) {
      console.error('Error al anular entrada:', error);
      alert('❌ Error al anular la entrada. Por favor, intenta de nuevo.\n\nDetalles: ' + error.message);
    } finally {
      setProcessingAnulacion(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const totalGeneral = cuentasPorSatelite.reduce((sum, cuenta) => sum + cuenta.totalAdeudado, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Cargando cuentas por pagar...</p>
      </div>
    );
  }

  const totalHistorialPagado = historialPorSatelite.reduce((sum, h) => sum + h.totalPagado, 0);

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cuentas por Pagar a Satélites</h2>
          <p className="text-gray-600 mt-1">Gestiona los pagos pendientes a talleres satélite.</p>
        </div>
        {/* Botón para actualizar costos si hay entradas sin valor */}
        {entradasSinCosto > 0 && (
          <button
            onClick={handleActualizarCostos}
            disabled={processingCostos}
            className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw size={18} className={processingCostos ? 'animate-spin' : ''} />
            {processingCostos ? 'Actualizando...' : `Actualizar Costos (${entradasSinCosto})`}
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pendientes')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'pendientes'
              ? 'bg-pink-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Clock size={18} />
          Pendientes ({cuentasPorSatelite.length})
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'historial'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <History size={18} />
          Historial ({historialPorSatelite.length} satélites)
        </button>
      </div>

      {/* Resumen General - Solo en pestaña Pendientes */}
      {activeTab === 'pendientes' && (
        <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-pink-100 text-sm">Total Adeudado a Satélites</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totalGeneral)}</p>
            </div>
            <div className="text-right">
              <p className="text-pink-100 text-sm">Satélites con Saldo Pendiente</p>
              <p className="text-3xl font-bold mt-1">{cuentasPorSatelite.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resumen Historial - Solo en pestaña Historial */}
      {activeTab === 'historial' && (
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-green-100 text-sm">Total Pagado a Satélites</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totalHistorialPagado)}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-sm">Total de Satélites</p>
              <p className="text-3xl font-bold mt-1">{historialPorSatelite.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Cuentas por Satélite - Pendientes */}
      {activeTab === 'pendientes' && (
        cuentasPorSatelite.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">¡No hay cuentas pendientes!</h3>
          <p className="text-gray-600">Todos los pagos a satélites están al día.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cuentasPorSatelite.map((cuenta) => (
            <div key={cuenta.sateliteId} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header - Resumen del Satélite */}
              <div
                onClick={() => toggleExpandSatelite(cuenta.sateliteId)}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {cuenta.sateliteNombre}
                  </h3>
                  <p className="text-sm text-gray-500">Código: {cuenta.sateliteCodigo}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Adeudado</p>
                    <p className="text-xl font-bold text-pink-600">
                      {formatCurrency(cuenta.totalAdeudado)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cuenta.entradas.length} entrada(s) pendiente(s)
                    </p>
                  </div>
                  {expandedSatelite === cuenta.sateliteId ? (
                    <ChevronUp className="text-gray-400" />
                  ) : (
                    <ChevronDown className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Detalle de Entradas (Expandible) */}
              {expandedSatelite === cuenta.sateliteId && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-3">Detalle de Entradas Pendientes</h4>

                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-lg overflow-hidden">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Referencia</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Cantidad</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Costo Unit.</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Total</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cuenta.entradas.map((entrada) => (
                          <tr key={entrada.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatDate(entrada.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {entrada.nombre}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {entrada.referencia}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {entrada.cantidad}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {formatCurrency(entrada.costoUnitario)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(entrada.costoTotal)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleAnularEntrada(entrada)}
                                disabled={processingAnulacion}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Anular esta entrada"
                              >
                                <XCircle size={14} />
                                Anular
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan="6" className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                            Total a Pagar:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-pink-600 text-right">
                            {formatCurrency(cuenta.totalAdeudado)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Botón para Marcar como Pagado */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleMarcarComoPagado(
                        cuenta.sateliteId,
                        cuenta.entradas.map(e => e.id)
                      )}
                      disabled={processingPayment}
                      style={{ backgroundColor: '#D50565' }}
                      className="px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      {processingPayment ? 'Procesando...' : 'Marcar como Pagado'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )
      )}

      {/* Lista de Historial por Satélite */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {historialPorSatelite.map((historial) => (
            <div key={historial.sateliteId} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Header - Resumen del Satélite */}
              <div
                onClick={() => toggleExpandHistorial(historial.sateliteId)}
                className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {historial.sateliteNombre}
                  </h3>
                  <p className="text-sm text-gray-500">Código: {historial.sateliteCodigo}</p>
                </div>
                <div className="flex items-center gap-6">
                  {/* Total Pagado */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Pagado</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(historial.totalPagado)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {historial.entradasPagadas.length} entrada(s)
                    </p>
                  </div>
                  {expandedHistorial === historial.sateliteId ? (
                    <ChevronUp className="text-gray-400" />
                  ) : (
                    <ChevronDown className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Detalle de Entradas Pagadas (Expandible) */}
              {expandedHistorial === historial.sateliteId && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-3">Historial de Pagos</h4>

                  {historial.entradasPagadas.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No hay pagos registrados para este satélite.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white rounded-lg overflow-hidden">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Fecha Entrada</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Fecha Pago</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Producto</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Cantidad</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Total</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Método</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Origen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {historial.entradasPagadas.map((entrada) => (
                            <tr key={entrada.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {formatDate(entrada.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-sm text-green-600 font-medium">
                                {formatDate(entrada.fechaPago)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {entrada.nombre || entrada.referencia || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                {entrada.cantidad}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right">
                                {formatCurrency(entrada.costoTotal || 0)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">
                                {entrada.metodoPago || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  entrada.origenDinero === 'Caja'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {entrada.origenDinero || 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-green-50">
                          <tr>
                            <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
                              Total Pagado:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">
                              {formatCurrency(historial.totalPagado)}
                            </td>
                            <td colSpan="2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CuentasPorPagar;
