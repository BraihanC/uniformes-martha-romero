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
// CLIENTES B2B — alta, baja y acceso al portal
// ─────────────────────────────────────────────────────────────

/**
 * Firebase Auth normaliza los emails a minúsculas. Si el documento del cliente
 * guarda otra capitalización: (1) el login del portal no lo encuentra (matchea
 * por igualdad exacta contra `credenciales.email`), y (2) la regla de create de
 * pedidos_b2b (`clienteEmail == request.auth.token.email`) rechaza el pedido.
 * Todo email de cliente B2B se guarda pasando por aquí.
 */
export const normalizarEmailB2B = (email) => String(email ?? '').trim().toLowerCase();

/**
 * ¿El cliente puede entrar al portal?
 * `activo` ausente = activo, para no dejar fuera a los clientes creados antes
 * de que el campo existiera. Solo un `false` explícito bloquea.
 */
export const clientePortalActivo = (cliente) => !!cliente && cliente.activo !== false;

/**
 * Resumen de lo que se perdería al borrar un cliente B2B, y si se puede borrar.
 *
 * Borrar destruye la cuenta de Auth: un cliente con pedidos en curso ya no podría
 * confirmar recepción, y su saldo quedaría sin dueño visible. Por eso el borrado
 * se reserva a clientes SIN historial (altas equivocadas) y para el resto se
 * desactiva, que es reversible y no pierde nada.
 *
 * @param {Array} pedidos - pedidos_b2b del cliente (ya filtrados por clienteId)
 * @returns {{ puedeBorrar, total, enCurso, saldoPendiente, motivo }}
 */
export const evaluarBorradoClienteB2B = (pedidos = []) => {
  const total = pedidos.length;
  const FINALIZADOS = ['Completado', 'Anulado', 'Cancelado'];
  const enCurso = pedidos.filter(
    p => p.anulado !== true && !FINALIZADOS.includes(p.estado)
  ).length;
  const saldoPendiente = pedidos
    .filter(p => p.anulado !== true && p.estado !== 'Anulado' && p.estado !== 'Cancelado')
    .reduce((sum, p) => sum + calcularSaldoPendienteB2B(p), 0);

  if (total > 0) {
    return {
      puedeBorrar: false,
      total,
      enCurso,
      saldoPendiente,
      motivo:
        `Este cliente tiene ${total} pedido(s) registrado(s)` +
        (enCurso > 0 ? `, ${enCurso} de ellos en curso` : '') +
        (saldoPendiente > 0 ? `, y un saldo pendiente de $${saldoPendiente.toLocaleString('es-CO')}` : '') +
        '. Desactívalo en vez de borrarlo: se le revoca el acceso al portal sin perder el histórico.'
    };
  }

  return { puedeBorrar: true, total: 0, enCurso: 0, saldoPendiente: 0, motivo: '' };
};

// ─────────────────────────────────────────────────────────────
// CATÁLOGO POR CLIENTE (prendas compartidas + exclusivas)
// ─────────────────────────────────────────────────────────────

/**
 * Código del "colegio" bajo el que viven las prendas COMPARTIDAS: las que se
 * venden en tienda y también a clientes B2B de cualquier colegio (pantalón
 * England, bicicleteros, medias…). Un producto tiene UN solo `colegio`, así que
 * este código es el bucket de lo transversal.
 */
export const CODIGO_COMPARTIDAS = 'OT';

const normalizarCodigo = (valor) => String(valor ?? '').trim().toUpperCase();

/**
 * ¿El cliente ve una prenda compartida concreta?
 *
 * `clientes_corporativos.productosCompartidos` es la lista blanca de ids de
 * productos compartidos que ESTE cliente compra:
 *  - campo AUSENTE (no es array) → ve TODAS las compartidas. Es el comportamiento
 *    histórico y evita que dar de alta la función cambie lo que ya ve un cliente
 *    existente sin que nadie lo haya decidido.
 *  - array (incluso vacío) → ve SOLO los ids listados. Vacío = ninguna.
 */
export const clienteVeCompartida = (cliente = {}, productoId) => {
  const lista = cliente?.productosCompartidos;
  if (!Array.isArray(lista)) return true;
  return lista.some(id => String(id) === String(productoId));
};

/**
 * ¿El cliente tiene una lista blanca definida para prendas compartidas?
 * Útil en la UI para distinguir "ve todas (sin configurar)" de "ve estas".
 */
export const tieneListaCompartidas = (cliente = {}) =>
  Array.isArray(cliente?.productosCompartidos);

/**
 * Filtra las prendas compartidas según la lista blanca del cliente.
 * Los productos deben traer `id`.
 */
export const filtrarCompartidasPorCliente = (productosCompartidos = [], cliente = {}) => {
  if (!tieneListaCompartidas(cliente)) return [...productosCompartidos];
  return productosCompartidos.filter(p => clienteVeCompartida(cliente, p?.id));
};

/**
 * Arma el catálogo B2B visible para un cliente: sus prendas exclusivas (las del
 * código de su colegio) + las compartidas que tenga habilitadas.
 * ÚNICA fuente de verdad — la usan el portal (Catalogo) y staff (PedidosB2B).
 */
export const construirCatalogoB2B = (productosDelColegio = [], productosCompartidos = [], cliente = {}) => [
  ...productosDelColegio,
  ...filtrarCompartidasPorCliente(productosCompartidos, cliente)
];

/**
 * ¿Este producto se le puede vender a este cliente por el portal?
 * Se evalúa contra los datos OFICIALES del producto (no contra el carrito):
 *  - tiene que ser B2B,
 *  - o es del colegio del cliente, o es compartida y está en su lista blanca.
 * El producto debe traer `id` para poder validar la lista blanca.
 */
export const prendaPermitidaParaCliente = (producto = {}, cliente = {}) => {
  if (producto?.esB2B !== true) return false;

  const colegioProducto = normalizarCodigo(producto.colegio);
  if (!colegioProducto) return false;

  if (colegioProducto === CODIGO_COMPARTIDAS) {
    return clienteVeCompartida(cliente, producto.id);
  }

  const colegioCliente = normalizarCodigo(cliente?.codigoColegio);
  return !!colegioCliente && colegioProducto === colegioCliente;
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
 * Id determinístico de un precio corporativo: un solo documento posible por
 * (cliente, producto). Con id autogenerado, un reintento tras un "error" falso
 * — la persistencia multi-tab rechaza promesas de escrituras que SÍ se
 * aplicaron — crearía un segundo documento para el mismo par, y el catálogo
 * tomaría uno de los dos de forma impredecible. Con id fijo el guardado es
 * idempotente: reintentar pisa el mismo doc.
 */
export const idPrecioCorporativo = (clienteId, productoId) =>
  `${String(clienteId ?? '').trim()}__${String(productoId ?? '').trim()}`;

/**
 * Diff entre los precios propios escritos en la pantalla "Catálogo y precios" y
 * los que ya están guardados en `precios_corporativos`. Decide qué crear, qué
 * actualizar y qué borrar — un error aquí deja precios equivocados o documentos
 * huérfanos que el portal seguiría aplicando.
 *
 * @param {Array}  productos        - productos listados en la pantalla (con id, nombre, precio)
 * @param {Object} preciosInput     - { [productoId]: string } lo escrito en los inputs ('' = sin precio propio)
 * @param {Object} preciosGuardados - { [productoId]: { docId, precioEspecial } } estado actual en Firestore
 * @returns {{ aEscribir: Array, aBorrar: Array<string>, errores: Array<string> }}
 *   - aEscribir: [{ productoId, docId?, referencia, nombre, precioEspecial, precioTienda, sospechoso }]
 *     (sin docId = documento nuevo). `sospechoso` marca precios absurdamente bajos.
 *   - aBorrar:   docIds de precios propios que quedaron vacíos → vuelven al precio de lista
 *   - errores:   valores no válidos; si hay errores no se debe escribir nada
 */
export const calcularCambiosPreciosCorporativos = (productos = [], preciosInput = {}, preciosGuardados = {}) => {
  const aEscribir = [];
  const aBorrar = [];
  const errores = [];

  for (const producto of productos) {
    const guardado = preciosGuardados[producto.id];
    const crudo = String(preciosInput[producto.id] ?? '').trim();

    // Vacío = sin precio propio: se borra el registro y vuelve al precioB2B/precio
    if (crudo === '') {
      if (guardado?.docId) aBorrar.push(guardado.docId);
      continue;
    }

    // Cualquier punto o coma es un error, no un decimal: en pesos no hay
    // centavos, y un input numérico acepta "64.000" que Number() lee como 64
    // — un entero perfectamente válido. Se rechaza el texto crudo antes de
    // convertirlo, que es la única forma de distinguir $64.000 de $64.
    if (/[.,]/.test(crudo)) {
      errores.push(
        `${producto.nombre || producto.id}: "${crudo}" tiene punto o coma — escribe el precio sin separadores (64000, no 64.000).`
      );
      continue;
    }

    const valor = Number(crudo);
    if (!Number.isInteger(valor) || valor <= 0) {
      errores.push(
        `${producto.nombre || producto.id}: "${crudo}" no es un precio válido — usa pesos enteros mayores a 0.`
      );
      continue;
    }

    if (guardado && Number(guardado.precioEspecial) === valor) continue; // sin cambios

    const precioTienda = Number(producto.precio || 0);
    aEscribir.push({
      productoId: producto.id,
      docId: guardado?.docId,
      referencia: producto.referencia || '',
      nombre: producto.nombre || '',
      precioEspecial: valor,
      precioTienda,
      // Salvavidas del separador de miles: un input numérico acepta "64.000" y
      // JavaScript lo lee como 64. Si el precio propio queda por debajo del 20%
      // del de tienda, casi seguro le faltan ceros — se pide confirmación.
      sospechoso: precioTienda > 0 && valor < precioTienda * 0.2
    });
  }

  return { aEscribir, aBorrar, errores };
};

/**
 * Revalida los items del carrito B2B contra el catálogo OFICIAL al confirmar
 * el pedido. El carrito vive en localStorage (editable por el cliente y
 * potencialmente desactualizado) — el pedido SIEMPRE se crea con los precios
 * oficiales del momento; si difieren de los del carrito se reportan las
 * discrepancias para condicionar la auto-aprobación.
 *
 * Si se pasa `cliente`, también valida que cada prenda SIGA siendo vendible a ese
 * cliente (es B2B y es de su colegio o una compartida habilitada). Sin esto, un
 * carrito viejo o de otro cliente en el mismo navegador — el carrito vive en
 * localStorage con clave global — colaría prendas de otro colegio en el pedido.
 *
 * @param {Array}  cartItems     - items del carrito {id, precio, cantidad, descripcion, talla}
 * @param {Object} catalogoPorId - { [productoId]: { producto, precioEspecial } }
 * @param {Object} [opciones]    - { cliente } cliente corporativo dueño del carrito
 * @returns {{ itemsValidados: Array, discrepancias: Array, errores: Array }}
 *   - itemsValidados: items con precio OFICIAL y cantidad saneada (entera > 0)
 *   - discrepancias:  [{ productoId, descripcion, talla, precioCarrito, precioOficial }]
 *   - errores:        mensajes de items inválidos (no existen / no vendibles / cantidad inválida)
 */
export const revalidarCarritoB2B = (cartItems = [], catalogoPorId = {}, opciones = {}) => {
  const itemsValidados = [];
  const discrepancias = [];
  const errores = [];
  const { cliente } = opciones;

  for (const item of cartItems) {
    const entrada = item.id ? catalogoPorId[item.id] : null;
    if (!entrada || !entrada.producto) {
      errores.push(`${item.descripcion || item.id || 'Producto sin nombre'} — ya no existe en el catálogo`);
      continue;
    }

    if (cliente && !prendaPermitidaParaCliente({ ...entrada.producto, id: item.id }, cliente)) {
      errores.push(
        `${item.descripcion || entrada.producto.nombre || item.id} — ya no está disponible para tu colegio`
      );
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
