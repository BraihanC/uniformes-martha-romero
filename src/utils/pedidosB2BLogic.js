/**
 * pedidosB2BLogic.js
 * Lógica pura de cálculo para pedidos B2B: alistamiento, envíos, pendientes, matching.
 * Funciones sin efectos secundarios ni dependencias externas (sin Firebase, sin React).
 * 100% testables con: npm test
 */

// ─────────────────────────────────────────────────────────────
// HELPER DE COMPATIBILIDAD
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene la cantidad alistada para el envío ACTUAL (no acumulada).
 * Compatible con pedidos viejos que solo tienen cantidadAlistada (acumulativa).
 */
export const getAlistadaActual = (producto) => {
  let valor;
  if (producto.cantidadAlistadaActual !== undefined) {
    valor = producto.cantidadAlistadaActual;
  } else {
    valor = Math.max(0, (producto.cantidadAlistada || 0) - (producto.cantidadEnviada || 0));
  }
  // Cap: nunca más que pendientes + reposición por discrepancia
  if (producto.cantidad !== undefined) {
    const cantidadEnviada = producto.cantidadEnviada || 0;
    let maxPosible = Math.max(0, producto.cantidad - cantidadEnviada);
    // Si hay discrepancia, permitir alistamiento extra para reponer
    const cantidadRecibida = producto.cantidadRecibida || 0;
    if (cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada && cantidadRecibida < producto.cantidad) {
      maxPosible += (cantidadEnviada - cantidadRecibida);
    }
    return Math.min(valor, maxPosible);
  }
  return valor;
};

// ─────────────────────────────────────────────────────────────
// CÁLCULOS DE ALISTAMIENTO
// ─────────────────────────────────────────────────────────────

/**
 * Calcula cuántas unidades se pueden alistar para ESTE envío.
 * Incluye pendientes originales + reposición por discrepancias.
 */
export const calcularMaxAlistar = (producto) => {
  const cantidadEnviada = producto.cantidadEnviada || 0;
  const alistadaActual = getAlistadaActual(producto);
  const cantidadRecibida = producto.cantidadRecibida || 0;
  const hayDiscrepancia = cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada && cantidadRecibida < producto.cantidad;
  const pendientesOriginal = Math.max(0, producto.cantidad - cantidadEnviada - alistadaActual);
  const discrepanciaTotal = hayDiscrepancia
    ? cantidadEnviada - cantidadRecibida
    : 0;
  // Restar alistadas que cubren la discrepancia
  const alistadaSobrante = Math.max(0, alistadaActual - Math.max(0, producto.cantidad - cantidadEnviada));
  const pendientesPorDiscrepancia = Math.max(0, discrepanciaTotal - alistadaSobrante);
  return pendientesOriginal + pendientesPorDiscrepancia;
};

/**
 * Calcula las cantidades pendientes desglosadas.
 */
export const calcularPendientes = (producto) => {
  const cantidadEnviada = producto.cantidadEnviada || 0;
  const alistadaActual = getAlistadaActual(producto);
  const cantidadRecibida = producto.cantidadRecibida || 0;
  const hayDiscrepancia = cantidadRecibida > 0 && cantidadRecibida < cantidadEnviada && cantidadRecibida < producto.cantidad;

  const pendientesOriginal = Math.max(0, producto.cantidad - cantidadEnviada - alistadaActual);
  const discrepanciaTotal = hayDiscrepancia ? (cantidadEnviada - cantidadRecibida) : 0;
  // Restar alistadas de la discrepancia (las alistadas cubren primero pendientes originales, luego discrepancia)
  const alistadaSobrante = Math.max(0, alistadaActual - Math.max(0, producto.cantidad - cantidadEnviada));
  const pendientesPorDiscrepancia = Math.max(0, discrepanciaTotal - alistadaSobrante);

  return {
    pendientesOriginal,
    pendientesPorDiscrepancia,
    total: pendientesOriginal + pendientesPorDiscrepancia
  };
};

// ─────────────────────────────────────────────────────────────
// SIMULACIÓN DE OPERACIONES (puras, sin I/O)
// ─────────────────────────────────────────────────────────────

/**
 * Simula el alistamiento de un producto.
 * @returns {Object} Producto actualizado (copia)
 */
export const simularAlistamiento = (producto, cantidad) => {
  const cantidadEnviada = producto.cantidadEnviada || 0;
  const alistadaActual = getAlistadaActual(producto);
  const alistadaTotal = producto.cantidadAlistadaTotal ?? (producto.cantidadAlistada || 0);

  const nuevaAlistadaActual = alistadaActual + cantidad;
  const nuevaAlistadaTotal = alistadaTotal + cantidad;
  const totalPreparado = nuevaAlistadaActual + cantidadEnviada;
  const nuevoEstado = totalPreparado >= producto.cantidad ? 'alistado' : 'en_produccion';

  return {
    ...producto,
    cantidadAlistadaActual: nuevaAlistadaActual,
    cantidadAlistadaTotal: nuevaAlistadaTotal,
    cantidadAlistada: totalPreparado,
    estadoProduccion: nuevoEstado
  };
};

/**
 * Simula el envío de productos alistados.
 * @returns {{ producto: Object, cantidadEnviada: number, registroEnvio: Object }}
 */
export const simularEnvio = (producto, envioNumero, fecha) => {
  const alistadaActual = getAlistadaActual(producto);
  if (alistadaActual <= 0) {
    return { producto, cantidadEnviada: 0, registroEnvio: null };
  }

  const nuevaCantidadEnviada = (producto.cantidadEnviada || 0) + alistadaActual;
  const nuevoEstado = nuevaCantidadEnviada >= producto.cantidad ? 'enviado' : 'en_produccion';

  const registroEnvio = {
    envioNumero,
    fecha: fecha || new Date().toISOString(),
    cantidadEnviada: alistadaActual,
    cantidadAcumulada: nuevaCantidadEnviada,
    tipo: nuevaCantidadEnviada >= producto.cantidad ? 'completo' : 'parcial'
  };

  const historialEnvios = [...(producto.historialEnvios || []), registroEnvio];

  return {
    producto: {
      ...producto,
      cantidadEnviada: nuevaCantidadEnviada,
      cantidadAlistadaActual: 0,
      cantidadAlistadaTotal: producto.cantidadAlistadaTotal ?? (producto.cantidadAlistada || 0),
      cantidadAlistada: nuevaCantidadEnviada,
      estadoProduccion: nuevoEstado,
      historialEnvios
    },
    cantidadEnviada: alistadaActual,
    registroEnvio
  };
};

/**
 * Simula la recepción por parte del cliente.
 * @returns {{ producto: Object, hayDiscrepancia: boolean }}
 */
export const simularRecepcion = (producto, cantidadRecibida) => {
  const cantidadEnviada = producto.cantidadEnviada || 0;
  const nuevaCantidadRecibida = (producto.cantidadRecibida || 0) + cantidadRecibida;
  const pendienteRecibir = cantidadEnviada - (producto.cantidadRecibida || 0);
  const hayDiscrepancia = cantidadRecibida < pendienteRecibir;
  const nuevoEstado = nuevaCantidadRecibida >= cantidadEnviada ? 'recibido' : producto.estadoProduccion;

  return {
    producto: {
      ...producto,
      cantidadRecibida: nuevaCantidadRecibida,
      estadoProduccion: nuevoEstado
    },
    hayDiscrepancia
  };
};

// ─────────────────────────────────────────────────────────────
// MATCHING (para EntradaSatelite)
// ─────────────────────────────────────────────────────────────

/**
 * Verifica si un producto del pedido B2B coincide con un producto del inventario.
 */
export const productoCoincide = (productoPedido, productoInventario) => {
  if (productoPedido.anulado) return false;

  const codigoMatch = !!(
    (productoPedido.codigo && productoPedido.codigo === productoInventario.referencia) ||
    (productoPedido.productoId && productoPedido.productoId === productoInventario.id) ||
    (productoPedido.codigo && productoInventario.codigo && productoPedido.codigo === productoInventario.codigo)
  );

  const tallaMatch = String(productoPedido.talla) === String(productoInventario.talla);

  return codigoMatch && tallaMatch;
};

/**
 * Matching usado por EntradaSatelite/EntradaProveedor para localizar productos en
 * un pedido B2B que correspondan a un producto del inventario que está entrando.
 * Extiende productoCoincide con un fallback por descripción para datos legacy.
 */
export const productoB2BCoincideConInventario = (productoPedido, productoInventario) => {
  if (productoPedido.anulado) return false;

  const tallaMatch = String(productoPedido.talla) === String(productoInventario.talla);
  if (!tallaMatch) return false;

  return !!(
    (productoPedido.codigo && productoPedido.codigo === productoInventario.referencia) ||
    (productoPedido.productoId && productoPedido.productoId === productoInventario.id) ||
    (productoPedido.codigo && productoInventario.codigo && productoPedido.codigo === productoInventario.codigo) ||
    (productoPedido.descripcion && productoInventario.nombre && productoPedido.descripcion === productoInventario.nombre)
  );
};

/**
 * Matching usado en la fase de batch (PASO 4) para re-localizar dentro del documento
 * del pedido el item que corresponde a una asignación calculada en PASO 1.
 */
export const productoB2BCoincideConAsignacion = (producto, asig) => {
  if (producto.anulado) return false;
  if (String(producto.talla) !== String(asig.talla)) return false;
  return !!(
    (producto.productoId && asig.productoId && producto.productoId === asig.productoId) ||
    (producto.codigo && asig.referencia && producto.codigo === asig.referencia) ||
    (producto.descripcion && asig.descripcion && producto.descripcion === asig.descripcion)
  );
};

/**
 * Variante ESTRICTA del matching anterior: solo identidad real (productoId o
 * código), sin el fallback por descripción. Para matching en dos pasadas:
 * primero exacto, y solo si no hay match se intenta el laxo — evita que dos
 * productos DISTINTOS con la misma descripción+talla se crucen.
 */
export const productoB2BCoincideExacto = (producto, asig) => {
  if (producto.anulado) return false;
  if (String(producto.talla) !== String(asig.talla)) return false;
  return !!(
    (producto.productoId && asig.productoId && producto.productoId === asig.productoId) ||
    (producto.codigo && asig.referencia && producto.codigo === asig.referencia)
  );
};

/**
 * Verifica si un producto tiene unidades pendientes de alistar.
 */
export const tienePendientes = (producto) => {
  if (producto.anulado) return false;
  const { total } = calcularPendientes(producto);
  return total > 0;
};

// ─────────────────────────────────────────────────────────────
// ESTADO DEL PEDIDO
// ─────────────────────────────────────────────────────────────

/**
 * Determina si un envío sería completo o parcial.
 */
export const esEnvioCompleto = (productos) => {
  return productos.every(p => {
    if (p.anulado) return true;
    const alistadaActual = getAlistadaActual(p);
    const totalEnviadoDespues = (p.cantidadEnviada || 0) + alistadaActual;
    return totalEnviadoDespues >= p.cantidad;
  });
};

/**
 * ¿El pedido quedó completamente recibido? Solo entonces debe pasar a
 * 'Completado' automáticamente al confirmar una recepción en el portal.
 *
 * La versión anterior comparaba recibida >= enviada por producto: un producto
 * JAMÁS enviado cumplía trivialmente (0 >= 0), así que recibir un envío
 * parcial marcaba 'Completado' un pedido con productos aún en producción —
 * que además quedaban en limbo (el alistamiento automático de entradas
 * excluye pedidos 'Completado') y el pedido quedaba inoperable para staff.
 *
 * Completo = todos los productos ACTIVOS (no anulados) recibieron la cantidad
 * PEDIDA. Sin productos activos no hay auto-completado (eso lo decide staff).
 */
export const pedidoCompletamenteRecibido = (productos = []) => {
  const activos = productos.filter(p => !p.anulado);
  if (activos.length === 0) return false;
  return activos.every(p => (p.cantidadRecibida || 0) >= (p.cantidad || 0));
};

/**
 * Calcula el saldo pendiente de un pedido B2B.
 */
export const calcularSaldoPendienteB2B = (pedido) => {
  const total = pedido.total || (pedido.productos || []).reduce((sum, p) => {
    return sum + ((p.cantidad || 0) * (p.precioUnitario || 0));
  }, 0);
  const abonado = (pedido.abonos || []).reduce((sum, a) => sum + (a.monto || 0), 0);
  return Math.max(0, total - abonado);
};

// ─────────────────────────────────────────────────────────────
// PRECIOS DEL PORTAL
// ─────────────────────────────────────────────────────────────

/**
 * Resuelve el precio corporativo OFICIAL de un producto para un cliente:
 * precio especial del cliente si existe, si no precioB2B, si no precio base.
 * Réplica de la resolución del catálogo del portal (Catalogo.jsx), normalizada
 * a número: un precioEspecial guardado como string ("52000") daría discrepancia
 * falsa permanente al comparar contra el precio numérico del carrito.
 */
export const resolverPrecioOficialB2B = (producto = {}, precioEspecial) =>
  Number(precioEspecial || producto.precioB2B || producto.precio || 0) || 0;

/**
 * Revalida los items del carrito B2B contra el catálogo OFICIAL al confirmar
 * el pedido. El carrito vive en localStorage (editable por el cliente y
 * potencialmente desactualizado) — el pedido SIEMPRE se crea con los precios
 * oficiales del momento; si difieren de los del carrito se reportan las
 * discrepancias para condicionar la auto-aprobación.
 *
 * @param {Array}  cartItems     - items del carrito {id, precio, cantidad, descripcion, talla}
 * @param {Object} catalogoPorId - { [productoId]: { producto, precioEspecial } }
 * @returns {{ itemsValidados: Array, discrepancias: Array, errores: Array }}
 *   - itemsValidados: items con precio OFICIAL y cantidad saneada (entera > 0)
 *   - discrepancias:  [{ productoId, descripcion, talla, precioCarrito, precioOficial }]
 *   - errores:        mensajes de items inválidos (no existen / cantidad inválida)
 */
export const revalidarCarritoB2B = (cartItems = [], catalogoPorId = {}) => {
  const itemsValidados = [];
  const discrepancias = [];
  const errores = [];

  for (const item of cartItems) {
    const entrada = item.id ? catalogoPorId[item.id] : null;
    if (!entrada || !entrada.producto) {
      errores.push(`${item.descripcion || item.id || 'Producto sin nombre'} — ya no existe en el catálogo`);
      continue;
    }

    const cantidad = Number(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      errores.push(`${item.descripcion || item.id} — cantidad inválida (${item.cantidad})`);
      continue;
    }

    const precioOficial = resolverPrecioOficialB2B(entrada.producto, entrada.precioEspecial);
    const precioCarrito = Number(item.precio) || 0;

    if (precioCarrito !== precioOficial) {
      discrepancias.push({
        productoId: item.id,
        descripcion: item.descripcion || entrada.producto.nombre || '',
        talla: item.talla || '',
        precioCarrito,
        precioOficial
      });
    }

    itemsValidados.push({ ...item, precio: precioOficial, cantidad });
  }

  return { itemsValidados, discrepancias, errores };
};
