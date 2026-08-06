import { describe, it, expect } from 'vitest';
import {
  getAlistadaActual,
  calcularMaxAlistar,
  calcularPendientes,
  simularAlistamiento,
  simularEnvio,
  simularRecepcion,
  productoCoincide,
  productoB2BCoincideConInventario,
  productoB2BCoincideConAsignacion,
  productoB2BCoincideExacto,
  tienePendientes,
  esEnvioCompleto,
  pedidoCompletamenteRecibido,
  calcularSaldoPendienteB2B,
  resolverPrecioOficialB2B,
  revalidarCarritoB2B,
  CODIGO_COMPARTIDAS,
  clienteVeCompartida,
  tieneListaCompartidas,
  filtrarCompartidasPorCliente,
  construirCatalogoB2B,
  prendaPermitidaParaCliente,
  calcularCambiosPreciosCorporativos,
  idPrecioCorporativo,
  normalizarEmailB2B,
  clientePortalActivo,
  evaluarBorradoClienteB2B
} from './pedidosB2BLogic';

// ─────────────────────────────────────────────────────────────
// getAlistadaActual
// ─────────────────────────────────────────────────────────────
describe('getAlistadaActual', () => {
  it('usa cantidadAlistadaActual si existe', () => {
    expect(getAlistadaActual({ cantidadAlistadaActual: 3, cantidadAlistada: 10, cantidadEnviada: 5 })).toBe(3);
  });

  it('devuelve 0 si cantidadAlistadaActual es 0', () => {
    expect(getAlistadaActual({ cantidadAlistadaActual: 0, cantidadAlistada: 8, cantidadEnviada: 8 })).toBe(0);
  });

  it('calcula desde campo viejo: cantidadAlistada - cantidadEnviada', () => {
    expect(getAlistadaActual({ cantidadAlistada: 8, cantidadEnviada: 5 })).toBe(3);
  });

  it('nunca retorna negativo', () => {
    expect(getAlistadaActual({ cantidadAlistada: 3, cantidadEnviada: 5 })).toBe(0);
  });

  it('maneja producto sin campos', () => {
    expect(getAlistadaActual({})).toBe(0);
  });

  it('maneja producto con solo cantidadAlistada', () => {
    expect(getAlistadaActual({ cantidadAlistada: 5 })).toBe(5);
  });

  it('capea sobrealistamiento legacy: cantidadAlistada > cantidad', () => {
    // Dato real: cantidadAlistada=6, cantidadEnviada=1, cantidad=4
    // Inferida sería 6-1=5, pero max posible es 4-1=3
    expect(getAlistadaActual({ cantidad: 4, cantidadAlistada: 6, cantidadEnviada: 1 })).toBe(3);
  });

  it('capea sobrealistamiento legacy sin envíos', () => {
    // cantidadAlistada=7 pero solo se pidieron 4
    expect(getAlistadaActual({ cantidad: 4, cantidadAlistada: 7 })).toBe(4);
  });

  it('capea cantidadAlistadaActual corrupta en Firestore', () => {
    // Dato real en Firestore: cantidadAlistadaActual=5 pero cantidad=4, enviadas=0
    // El campo nuevo YA existe pero con valor incorrecto
    expect(getAlistadaActual({ cantidad: 4, cantidadAlistadaActual: 5, cantidadEnviada: 0 })).toBe(4);
  });

  it('capea cantidadAlistadaActual corrupta con envíos previos', () => {
    // cantidadAlistadaActual=5 pero cantidad=4, enviadas=1 → max posible = 3
    expect(getAlistadaActual({ cantidad: 4, cantidadAlistadaActual: 5, cantidadEnviada: 1 })).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularMaxAlistar
// ─────────────────────────────────────────────────────────────
describe('calcularMaxAlistar', () => {
  it('producto nuevo: max = cantidad total', () => {
    expect(calcularMaxAlistar({ cantidad: 10 })).toBe(10);
  });

  it('producto parcialmente alistado (ciclo actual)', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadAlistadaActual: 3,
      cantidadEnviada: 0
    })).toBe(7);
  });

  it('producto con envío previo + alistamiento nuevo', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadEnviada: 5,
      cantidadAlistadaActual: 2
    })).toBe(3); // 10 - 5 - 2
  });

  it('producto completamente enviado: max = 0', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadEnviada: 10,
      cantidadAlistadaActual: 0
    })).toBe(0);
  });

  it('incluye pendientes por discrepancia', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadEnviada: 10,
      cantidadRecibida: 8, // recibió 8 de 10 enviadas
      cantidadAlistadaActual: 0
    })).toBe(2); // 0 original + 2 discrepancia
  });

  it('discrepancia + pendientes originales', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadEnviada: 5,
      cantidadRecibida: 3, // recibió 3 de 5 enviadas
      cantidadAlistadaActual: 0
    })).toBe(7); // 5 original + 2 discrepancia
  });

  it('compatibilidad con campo viejo', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadAlistada: 8, // viejo: acumulado
      cantidadEnviada: 5
      // cantidadAlistadaActual undefined → se calcula como 8-5=3
    })).toBe(2); // 10 - 5 - 3 = 2
  });

  it('no permite más de lo necesario con discrepancia parcial', () => {
    expect(calcularMaxAlistar({
      cantidad: 10,
      cantidadEnviada: 10,
      cantidadRecibida: 10, // recibió todo
      cantidadAlistadaActual: 0
    })).toBe(0); // no hay discrepancia
  });
});

// ─────────────────────────────────────────────────────────────
// calcularPendientes
// ─────────────────────────────────────────────────────────────
describe('calcularPendientes', () => {
  it('producto nuevo: todo pendiente', () => {
    const r = calcularPendientes({ cantidad: 10 });
    expect(r.pendientesOriginal).toBe(10);
    expect(r.pendientesPorDiscrepancia).toBe(0);
    expect(r.total).toBe(10);
  });

  it('parcialmente enviado, nada alistado', () => {
    const r = calcularPendientes({ cantidad: 10, cantidadEnviada: 5, cantidadAlistadaActual: 0 });
    expect(r.pendientesOriginal).toBe(5);
    expect(r.total).toBe(5);
  });

  it('parcialmente alistado para este envío', () => {
    const r = calcularPendientes({ cantidad: 10, cantidadEnviada: 5, cantidadAlistadaActual: 3 });
    expect(r.pendientesOriginal).toBe(2);
    expect(r.total).toBe(2);
  });

  it('con discrepancia activa', () => {
    const r = calcularPendientes({
      cantidad: 10,
      cantidadEnviada: 10,
      cantidadRecibida: 7,
      cantidadAlistadaActual: 0
    });
    expect(r.pendientesOriginal).toBe(0);
    expect(r.pendientesPorDiscrepancia).toBe(3);
    expect(r.total).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// simularAlistamiento
// ─────────────────────────────────────────────────────────────
describe('simularAlistamiento', () => {
  it('primer alistamiento de producto nuevo', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadAlistadaTotal: 0, cantidadEnviada: 0 };
    const result = simularAlistamiento(prod, 5);
    expect(result.cantidadAlistadaActual).toBe(5);
    expect(result.cantidadAlistadaTotal).toBe(5);
    expect(result.cantidadAlistada).toBe(5); // compat
    expect(result.estadoProduccion).toBe('en_produccion');
  });

  it('alistamiento completo', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadAlistadaTotal: 0, cantidadEnviada: 0 };
    const result = simularAlistamiento(prod, 10);
    expect(result.cantidadAlistadaActual).toBe(10);
    expect(result.estadoProduccion).toBe('alistado');
  });

  it('alistamiento tras envío previo', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadAlistadaTotal: 5, cantidadEnviada: 5, cantidadAlistada: 5 };
    const result = simularAlistamiento(prod, 3);
    expect(result.cantidadAlistadaActual).toBe(3);
    expect(result.cantidadAlistadaTotal).toBe(8);
    expect(result.cantidadAlistada).toBe(8); // 3 + 5 enviadas
    expect(result.estadoProduccion).toBe('en_produccion');
  });

  it('alistamiento completa pedido con envío previo', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadAlistadaTotal: 5, cantidadEnviada: 5, cantidadAlistada: 5 };
    const result = simularAlistamiento(prod, 5);
    expect(result.cantidadAlistadaActual).toBe(5);
    expect(result.cantidadAlistada).toBe(10);
    expect(result.estadoProduccion).toBe('alistado');
  });

  it('no muta el producto original', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadAlistadaTotal: 0, cantidadEnviada: 0 };
    simularAlistamiento(prod, 5);
    expect(prod.cantidadAlistadaActual).toBe(0);
  });

  it('compatibilidad con campo viejo', () => {
    const prod = { cantidad: 10, cantidadAlistada: 5, cantidadEnviada: 5 };
    // cantidadAlistadaActual undefined → se calcula como 5-5=0
    const result = simularAlistamiento(prod, 3);
    expect(result.cantidadAlistadaActual).toBe(3);
    expect(result.cantidadAlistadaTotal).toBe(8); // 5 viejo + 3 nuevo
  });
});

// ─────────────────────────────────────────────────────────────
// simularEnvio
// ─────────────────────────────────────────────────────────────
describe('simularEnvio', () => {
  it('envío parcial: resetea cantidadAlistadaActual', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 5, cantidadEnviada: 0, cantidadAlistadaTotal: 5 };
    const { producto, cantidadEnviada, registroEnvio } = simularEnvio(prod, 1, '2026-02-25');
    expect(producto.cantidadAlistadaActual).toBe(0); // RESET
    expect(producto.cantidadEnviada).toBe(5);
    expect(cantidadEnviada).toBe(5);
    expect(registroEnvio.envioNumero).toBe(1);
    expect(registroEnvio.tipo).toBe('parcial');
    expect(producto.estadoProduccion).toBe('en_produccion');
  });

  it('envío completo', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 10, cantidadEnviada: 0, cantidadAlistadaTotal: 10 };
    const { producto, registroEnvio } = simularEnvio(prod, 1, '2026-02-25');
    expect(producto.cantidadEnviada).toBe(10);
    expect(producto.cantidadAlistadaActual).toBe(0);
    expect(producto.estadoProduccion).toBe('enviado');
    expect(registroEnvio.tipo).toBe('completo');
  });

  it('segundo envío completa el pedido', () => {
    const prod = {
      cantidad: 10,
      cantidadAlistadaActual: 5,
      cantidadEnviada: 5,
      cantidadAlistadaTotal: 10,
      historialEnvios: [{ envioNumero: 1, cantidadEnviada: 5, cantidadAcumulada: 5, tipo: 'parcial', fecha: '2026-02-20' }]
    };
    const { producto, registroEnvio } = simularEnvio(prod, 2, '2026-02-25');
    expect(producto.cantidadEnviada).toBe(10);
    expect(producto.estadoProduccion).toBe('enviado');
    expect(registroEnvio.envioNumero).toBe(2);
    expect(registroEnvio.tipo).toBe('completo');
    expect(producto.historialEnvios).toHaveLength(2);
  });

  it('no envía si no hay nada alistado', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 0, cantidadEnviada: 5 };
    const { producto, cantidadEnviada, registroEnvio } = simularEnvio(prod, 1);
    expect(cantidadEnviada).toBe(0);
    expect(registroEnvio).toBeNull();
    expect(producto.cantidadEnviada).toBe(5);
  });

  it('no muta el producto original', () => {
    const prod = { cantidad: 10, cantidadAlistadaActual: 5, cantidadEnviada: 0, cantidadAlistadaTotal: 5 };
    simularEnvio(prod, 1);
    expect(prod.cantidadAlistadaActual).toBe(5);
    expect(prod.cantidadEnviada).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// simularRecepcion
// ─────────────────────────────────────────────────────────────
describe('simularRecepcion', () => {
  it('recepción completa sin discrepancia', () => {
    const prod = { cantidad: 10, cantidadEnviada: 5, cantidadRecibida: 0, estadoProduccion: 'enviado' };
    const { producto, hayDiscrepancia } = simularRecepcion(prod, 5);
    expect(producto.cantidadRecibida).toBe(5);
    expect(hayDiscrepancia).toBe(false);
    expect(producto.estadoProduccion).toBe('recibido');
  });

  it('recepción parcial con discrepancia', () => {
    const prod = { cantidad: 10, cantidadEnviada: 5, cantidadRecibida: 0, estadoProduccion: 'enviado' };
    const { producto, hayDiscrepancia } = simularRecepcion(prod, 3);
    expect(producto.cantidadRecibida).toBe(3);
    expect(hayDiscrepancia).toBe(true);
    expect(producto.estadoProduccion).toBe('enviado'); // no cambia porque no recibió todo
  });

  it('segunda recepción completa el envío', () => {
    const prod = { cantidad: 10, cantidadEnviada: 10, cantidadRecibida: 5, estadoProduccion: 'enviado' };
    const { producto, hayDiscrepancia } = simularRecepcion(prod, 5);
    expect(producto.cantidadRecibida).toBe(10);
    expect(hayDiscrepancia).toBe(false);
    expect(producto.estadoProduccion).toBe('recibido');
  });
});

// ─────────────────────────────────────────────────────────────
// productoCoincide (matching para EntradaSatelite)
// ─────────────────────────────────────────────────────────────
describe('productoCoincide', () => {
  it('coincide por codigo = referencia', () => {
    expect(productoCoincide(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });

  it('coincide por productoId = id', () => {
    expect(productoCoincide(
      { productoId: 'abc123', talla: '10' },
      { id: 'abc123', talla: '10' }
    )).toBe(true);
  });

  it('coincide por codigo = codigo', () => {
    expect(productoCoincide(
      { codigo: 'COD001', talla: 'S' },
      { codigo: 'COD001', talla: 'S' }
    )).toBe(true);
  });

  it('no coincide si talla diferente', () => {
    expect(productoCoincide(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'L' }
    )).toBe(false);
  });

  it('no coincide si código diferente', () => {
    expect(productoCoincide(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF002', talla: 'M' }
    )).toBe(false);
  });

  it('excluye productos anulados', () => {
    expect(productoCoincide(
      { codigo: 'REF001', talla: 'M', anulado: true },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(false);
  });

  it('talla como número vs string', () => {
    expect(productoCoincide(
      { codigo: 'REF001', talla: 10 },
      { referencia: 'REF001', talla: '10' }
    )).toBe(true);
  });

  it('no coincide sin ningún identificador', () => {
    expect(productoCoincide(
      { talla: 'M' },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// tienePendientes
// ─────────────────────────────────────────────────────────────
describe('tienePendientes', () => {
  it('producto nuevo tiene pendientes', () => {
    expect(tienePendientes({ cantidad: 10 })).toBe(true);
  });

  it('producto completamente enviado no tiene pendientes', () => {
    expect(tienePendientes({ cantidad: 10, cantidadEnviada: 10, cantidadAlistadaActual: 0 })).toBe(false);
  });

  it('producto con discrepancia tiene pendientes', () => {
    expect(tienePendientes({ cantidad: 10, cantidadEnviada: 10, cantidadRecibida: 8, cantidadAlistadaActual: 0 })).toBe(true);
  });

  it('producto anulado no tiene pendientes', () => {
    expect(tienePendientes({ cantidad: 10, anulado: true })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// productoB2BCoincideConInventario
// Matching usado en EntradaSatelite/EntradaProveedor para localizar
// productos de un pedido B2B que correspondan al producto que entra al
// inventario. Extiende productoCoincide con un fallback por descripción.
// ─────────────────────────────────────────────────────────────
describe('productoB2BCoincideConInventario', () => {
  it('coincide por codigo === referencia del inventario', () => {
    expect(productoB2BCoincideConInventario(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });

  it('coincide por productoId === id del inventario', () => {
    expect(productoB2BCoincideConInventario(
      { productoId: 'abc123', talla: '10' },
      { id: 'abc123', talla: '10' }
    )).toBe(true);
  });

  it('coincide por codigo === codigo del inventario', () => {
    expect(productoB2BCoincideConInventario(
      { codigo: 'COD001', talla: 'S' },
      { codigo: 'COD001', talla: 'S' }
    )).toBe(true);
  });

  it('coincide por descripcion === nombre (fallback legacy)', () => {
    // Pedido B2B viejo sin codigo ni productoId, solo descripcion
    expect(productoB2BCoincideConInventario(
      { descripcion: 'Camisa Manga Larga Azul', talla: 'M' },
      { nombre: 'Camisa Manga Larga Azul', talla: 'M' }
    )).toBe(true);
  });

  it('NO coincide si talla difiere — el fallback de descripción no la rescata', () => {
    expect(productoB2BCoincideConInventario(
      { descripcion: 'Camisa Manga Larga', talla: 'M' },
      { nombre: 'Camisa Manga Larga', talla: 'L' }
    )).toBe(false);
  });

  it('no coincide si ningún identificador matchea aunque la talla sea la misma', () => {
    expect(productoB2BCoincideConInventario(
      { codigo: 'REF001', descripcion: 'A', talla: 'M' },
      { referencia: 'REF002', nombre: 'B', talla: 'M' }
    )).toBe(false);
  });

  it('excluye productos anulados aun cuando el identificador coincida', () => {
    expect(productoB2BCoincideConInventario(
      { codigo: 'REF001', talla: 'M', anulado: true },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(false);
  });

  it('coerciona talla número vs string', () => {
    expect(productoB2BCoincideConInventario(
      { codigo: 'REF001', talla: 10 },
      { referencia: 'REF001', talla: '10' }
    )).toBe(true);
  });

  it('no coincide sin ningún identificador en el pedido', () => {
    expect(productoB2BCoincideConInventario(
      { talla: 'M' },
      { referencia: 'REF001', nombre: 'X', talla: 'M' }
    )).toBe(false);
  });

  it('paridad con productoCoincide cuando no aplica el fallback de descripción', () => {
    // Si el match clásico funciona, ambos deben dar true.
    const productoPedido = { codigo: 'REF001', talla: 'M' };
    const productoInventario = { referencia: 'REF001', talla: 'M' };
    expect(productoB2BCoincideConInventario(productoPedido, productoInventario))
      .toBe(productoCoincide(productoPedido, productoInventario));
  });

  it('extiende productoCoincide en el caso de descripción legacy', () => {
    // productoCoincide rechaza (sin fallback), productoB2BCoincideConInventario acepta.
    const productoPedido = { descripcion: 'Falda Plisada', talla: 'S' };
    const productoInventario = { nombre: 'Falda Plisada', talla: 'S' };
    expect(productoCoincide(productoPedido, productoInventario)).toBe(false);
    expect(productoB2BCoincideConInventario(productoPedido, productoInventario)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// productoB2BCoincideConAsignacion
// Matching usado en la fase de batch (PASO 4 de EntradaSatelite/Proveedor)
// para re-localizar el item del pedido contra los identificadores
// guardados en la asignación calculada en PASO 1.
// ─────────────────────────────────────────────────────────────
describe('productoB2BCoincideConAsignacion', () => {
  it('coincide por productoId guardado en la asignación', () => {
    expect(productoB2BCoincideConAsignacion(
      { productoId: 'abc123', talla: 'M' },
      { productoId: 'abc123', talla: 'M' }
    )).toBe(true);
  });

  it('coincide por codigo (producto) === referencia (asignación)', () => {
    // En la asignación guardamos `referencia` (puede venir de item.referencia
    // o item.codigo en EntradaSatelite:322). El item B2B guarda `codigo`.
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });

  it('coincide por descripcion === descripcion (fallback)', () => {
    expect(productoB2BCoincideConAsignacion(
      { descripcion: 'Saco Cuello V', talla: 'L' },
      { descripcion: 'Saco Cuello V', talla: 'L' }
    )).toBe(true);
  });

  it('rechaza productos anulados', () => {
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 'M', anulado: true },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(false);
  });

  it('coerciona talla cuando viene número vs string entre asignación y pedido', () => {
    // Persistimos `talla: String(a.talla)` en stockEntries.asignaciones para
    // tolerar pedidos que guardaron talla como número.
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 10 },
      { referencia: 'REF001', talla: '10' }
    )).toBe(true);
  });

  it('no coincide si la talla difiere aunque el identificador esté', () => {
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'L' }
    )).toBe(false);
  });

  it('no coincide cuando asignación legacy no trae ningún identificador', () => {
    // stockEntries legacy persistían solo pedidoId/numeroPedido/cantidad/tipo.
    // Sin productoId/referencia/descripcion, esta función no debería matchear.
    // El caller en Inventory/CuentasPorPagar reconstruye el asig desde
    // entrada.referencia/talla/productId/nombre antes de invocar.
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 'M' },
      { talla: 'M' }
    )).toBe(false);
  });

  it('ignora identificadores undefined/null en la asignación', () => {
    // Asignación con productoId vacío pero referencia válida — sólo
    // debe matchear por el campo que sí tiene valor.
    expect(productoB2BCoincideConAsignacion(
      { codigo: 'REF001', talla: 'M' },
      { productoId: '', referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });

  it('un identificador correcto basta — no exige que todos coincidan', () => {
    // Si productoId NO coincide pero codigo SÍ, debe matchear.
    expect(productoB2BCoincideConAsignacion(
      { productoId: 'distinto', codigo: 'REF001', talla: 'M' },
      { productoId: 'abc123', referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// productoB2BCoincideExacto
// Variante estricta (sin fallback por descripción) para matching en dos
// pasadas: evita que dos productos DISTINTOS con la misma descripción+talla
// se crucen en el envío (el decremento de stock iría al ref equivocado).
// Usada en PedidosB2B.handleEnviarProductosAlistados.
// ─────────────────────────────────────────────────────────────
describe('productoB2BCoincideExacto', () => {
  it('coincide por productoId', () => {
    expect(productoB2BCoincideExacto(
      { productoId: 'abc123', talla: 'M' },
      { productoId: 'abc123', talla: 'M' }
    )).toBe(true);
  });

  it('coincide por codigo (producto) === referencia (asignación)', () => {
    expect(productoB2BCoincideExacto(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(true);
  });

  it('NO coincide solo por descripción — esa es la diferencia con el matching laxo', () => {
    // Dos productos distintos con la misma descripción+talla no deben cruzarse.
    expect(productoB2BCoincideExacto(
      { descripcion: 'Saco Cuello V', talla: 'L' },
      { descripcion: 'Saco Cuello V', talla: 'L' }
    )).toBe(false);
  });

  it('rechaza productos anulados', () => {
    expect(productoB2BCoincideExacto(
      { codigo: 'REF001', talla: 'M', anulado: true },
      { referencia: 'REF001', talla: 'M' }
    )).toBe(false);
  });

  it('no coincide si la talla difiere aunque el identificador esté', () => {
    expect(productoB2BCoincideExacto(
      { codigo: 'REF001', talla: 'M' },
      { referencia: 'REF001', talla: 'L' }
    )).toBe(false);
  });

  it('coerciona talla número vs string', () => {
    expect(productoB2BCoincideExacto(
      { codigo: 'REF001', talla: 10 },
      { referencia: 'REF001', talla: '10' }
    )).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Regresión: selección con capacidad pendiente
// Cubre el "Bug A" — al re-localizar el item en el batch, el findIndex
// debe rechazar rows duplicados sin capacidad (cantidadAlistadaActual
// ya cubre todo lo pendiente) para no caer en el row equivocado.
// Esta combinación se usa en EntradaSatelite.jsx:441 y EntradaProveedor.jsx:423.
// ─────────────────────────────────────────────────────────────
describe('regresión: lookup con capacidad pendiente (Bug A)', () => {
  const findRowConCapacidad = (productos, asig) =>
    productos.findIndex(p =>
      productoB2BCoincideConAsignacion(p, asig) && calcularMaxAlistar(p) > 0
    );

  it('prefiere el row con pendientes cuando hay duplicado completo y duplicado parcial', () => {
    const productos = [
      // Row 0: mismo codigo+talla pero ya completamente alistado/enviado
      { codigo: 'REF001', talla: 'M', cantidad: 5, cantidadAlistadaActual: 5, cantidadEnviada: 0 },
      // Row 1: mismo codigo+talla con pendientes
      { codigo: 'REF001', talla: 'M', cantidad: 10, cantidadAlistadaActual: 0, cantidadEnviada: 0 }
    ];
    const asig = { referencia: 'REF001', talla: 'M', cantidad: 3 };

    expect(findRowConCapacidad(productos, asig)).toBe(1);
  });

  it('devuelve -1 si todos los matches están completos (caller hace fallback)', () => {
    const productos = [
      { codigo: 'REF001', talla: 'M', cantidad: 5, cantidadAlistadaActual: 5, cantidadEnviada: 0 },
      { codigo: 'REF001', talla: 'M', cantidad: 10, cantidadAlistadaActual: 10, cantidadEnviada: 0 }
    ];
    const asig = { referencia: 'REF001', talla: 'M', cantidad: 3 };

    expect(findRowConCapacidad(productos, asig)).toBe(-1);
  });

  it('ignora rows que no matchean el identificador aunque tengan capacidad', () => {
    const productos = [
      { codigo: 'OTRO', talla: 'M', cantidad: 10, cantidadAlistadaActual: 0 }, // matchea talla pero no codigo
      { codigo: 'REF001', talla: 'M', cantidad: 10, cantidadAlistadaActual: 0 }
    ];
    const asig = { referencia: 'REF001', talla: 'M', cantidad: 3 };

    expect(findRowConCapacidad(productos, asig)).toBe(1);
  });

  it('respeta capacidad por discrepancia: row "completo" en alistada pero con discrepancia activa sigue teniendo capacidad', () => {
    const productos = [
      // Ya alistó todo localmente, pero el cliente reportó discrepancia → hay
      // capacidad para reponer las unidades faltantes.
      {
        codigo: 'REF001',
        talla: 'M',
        cantidad: 10,
        cantidadAlistadaActual: 0,
        cantidadEnviada: 10,
        cantidadRecibida: 7 // 3 de discrepancia
      }
    ];
    const asig = { referencia: 'REF001', talla: 'M', cantidad: 2 };

    expect(findRowConCapacidad(productos, asig)).toBe(0);
  });

  it('rechaza rows anulados aunque tengan capacidad numérica', () => {
    const productos = [
      { codigo: 'REF001', talla: 'M', cantidad: 10, cantidadAlistadaActual: 0, anulado: true },
      { codigo: 'REF001', talla: 'M', cantidad: 5, cantidadAlistadaActual: 0 }
    ];
    const asig = { referencia: 'REF001', talla: 'M', cantidad: 3 };

    expect(findRowConCapacidad(productos, asig)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// esEnvioCompleto
// ─────────────────────────────────────────────────────────────
describe('esEnvioCompleto', () => {
  it('envío completo si todo alistado cubre la cantidad', () => {
    expect(esEnvioCompleto([
      { cantidad: 5, cantidadAlistadaActual: 5, cantidadEnviada: 0 },
      { cantidad: 3, cantidadAlistadaActual: 3, cantidadEnviada: 0 }
    ])).toBe(true);
  });

  it('envío parcial si falta alistar', () => {
    expect(esEnvioCompleto([
      { cantidad: 5, cantidadAlistadaActual: 5, cantidadEnviada: 0 },
      { cantidad: 3, cantidadAlistadaActual: 1, cantidadEnviada: 0 }
    ])).toBe(false);
  });

  it('envío completo con envío previo + alistamiento actual', () => {
    expect(esEnvioCompleto([
      { cantidad: 10, cantidadAlistadaActual: 5, cantidadEnviada: 5 }
    ])).toBe(true);
  });

  it('ignora productos anulados', () => {
    expect(esEnvioCompleto([
      { cantidad: 5, cantidadAlistadaActual: 5, cantidadEnviada: 0 },
      { cantidad: 3, cantidadAlistadaActual: 0, cantidadEnviada: 0, anulado: true }
    ])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// pedidoCompletamenteRecibido
// ─────────────────────────────────────────────────────────────
describe('pedidoCompletamenteRecibido', () => {
  it('true si todos los productos activos recibieron la cantidad pedida', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 5, cantidadRecibida: 5 },
      { cantidad: 3, cantidadEnviada: 3, cantidadRecibida: 3 }
    ])).toBe(true);
  });

  it('true si recibida supera lo pedido (dato raro pero cubierto)', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 6, cantidadRecibida: 6 }
    ])).toBe(true);
  });

  it('false si un producto activo recibió menos de lo pedido', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 5, cantidadRecibida: 3 }
    ])).toBe(false);
  });

  it('false con envío parcial recibido: un producto completo y otro sin enviar', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 5, cantidadRecibida: 5 },
      { cantidad: 3, cantidadEnviada: 0, cantidadRecibida: 0 }
    ])).toBe(false);
  });

  it('excluye productos anulados: activo completo + anulado sin recibir → true', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 5, cantidadRecibida: 5 },
      { cantidad: 3, cantidadEnviada: 0, cantidadRecibida: 0, anulado: true }
    ])).toBe(true);
  });

  it('false si todos los productos están anulados (no hay auto-completado)', () => {
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadRecibida: 0, anulado: true },
      { cantidad: 3, cantidadRecibida: 0, anulado: true }
    ])).toBe(false);
  });

  it('false con array vacío', () => {
    expect(pedidoCompletamenteRecibido([])).toBe(false);
  });

  it('false sin argumento (default [])', () => {
    expect(pedidoCompletamenteRecibido()).toBe(false);
  });

  it('producto activo sin campos cuenta como completo (0 >= 0)', () => {
    // Comportamiento actual: sin cantidad ni cantidadRecibida, 0 >= 0 → true.
    // Un producto así no bloquea el auto-completado.
    expect(pedidoCompletamenteRecibido([{}])).toBe(true);
  });

  it('true si la recibida cubre lo pedido aunque la enviada sea mayor (discrepancia repuesta)', () => {
    // Se enviaron 7 (5 + 2 de reposición) pero el cliente confirmó las 5 pedidas.
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 7, cantidadRecibida: 5 }
    ])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Regresión: auto-completado con productos jamás enviados
// La versión anterior comparaba recibida >= enviada por producto: un
// producto NUNCA enviado cumplía trivialmente (0 >= 0) y recibir un
// envío parcial marcaba 'Completado' un pedido con productos aún en
// producción, dejándolos en limbo (el alistamiento automático de
// entradas excluye pedidos 'Completado').
// ─────────────────────────────────────────────────────────────
describe('regresión: producto nunca enviado no debe auto-completar el pedido', () => {
  it('producto sin enviar ni recibir (0 de 5) → false', () => {
    // La versión vieja daba true: recibida(0) >= enviada(0).
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 0, cantidadRecibida: 0 }
    ])).toBe(false);
  });

  it('recepción de envío parcial: producto A completo + producto B en producción → false', () => {
    // Escenario real del bug: el cliente confirma la recepción del primer
    // envío (producto A) y el pedido NO debe pasar a 'Completado' porque
    // el producto B sigue en producción sin un solo envío.
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5, cantidadEnviada: 5, cantidadRecibida: 5 },
      { cantidad: 3, cantidadEnviada: 0, cantidadRecibida: 0 }
    ])).toBe(false);
  });

  it('producto legacy sin campos de envío/recepción pero con cantidad pedida → false', () => {
    // Doc viejo sin cantidadEnviada/cantidadRecibida: 0 >= 5 es false.
    expect(pedidoCompletamenteRecibido([
      { cantidad: 5 }
    ])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularSaldoPendienteB2B
// ─────────────────────────────────────────────────────────────
describe('calcularSaldoPendienteB2B', () => {
  it('saldo completo sin abonos', () => {
    expect(calcularSaldoPendienteB2B({ total: 500000, abonos: [] })).toBe(500000);
  });

  it('saldo parcial con abonos', () => {
    expect(calcularSaldoPendienteB2B({
      total: 500000,
      abonos: [{ monto: 200000 }]
    })).toBe(300000);
  });

  it('saldo 0 si abonos cubren total', () => {
    expect(calcularSaldoPendienteB2B({
      total: 500000,
      abonos: [{ monto: 500000 }]
    })).toBe(0);
  });

  it('nunca retorna negativo', () => {
    expect(calcularSaldoPendienteB2B({
      total: 500000,
      abonos: [{ monto: 600000 }]
    })).toBe(0);
  });

  it('calcula total desde productos si no hay campo total', () => {
    expect(calcularSaldoPendienteB2B({
      productos: [
        { cantidad: 5, precioUnitario: 20000 },
        { cantidad: 3, precioUnitario: 30000 }
      ],
      abonos: [{ monto: 50000 }]
    })).toBe(140000); // (100000 + 90000) - 50000
  });
});

// ─────────────────────────────────────────────────────────────
// ESCENARIOS DE NEGOCIO COMPLETOS
// ─────────────────────────────────────────────────────────────
describe('Escenario completo: 3 entregas parciales', () => {
  // Pedido: 10 camisas
  const productoInicial = {
    cantidad: 10,
    cantidadAlistadaActual: 0,
    cantidadAlistadaTotal: 0,
    cantidadAlistada: 0,
    cantidadEnviada: 0,
    cantidadRecibida: 0,
    estadoProduccion: 'pendiente',
    historialEnvios: []
  };

  it('Entrega 1: alistar 4, enviar 4, recibir 4', () => {
    // Alistar 4
    let prod = simularAlistamiento(productoInicial, 4);
    expect(prod.cantidadAlistadaActual).toBe(4);
    expect(calcularMaxAlistar(prod)).toBe(6); // quedan 6 por alistar

    // Enviar
    const envio1 = simularEnvio(prod, 1, '2026-02-20');
    prod = envio1.producto;
    expect(prod.cantidadEnviada).toBe(4);
    expect(prod.cantidadAlistadaActual).toBe(0); // RESET
    expect(prod.historialEnvios).toHaveLength(1);
    expect(prod.historialEnvios[0].cantidadEnviada).toBe(4);
    expect(prod.historialEnvios[0].tipo).toBe('parcial');
    expect(calcularMaxAlistar(prod)).toBe(6); // quedan 6

    // Recibir
    const recep1 = simularRecepcion(prod, 4);
    prod = recep1.producto;
    expect(prod.cantidadRecibida).toBe(4);
    expect(recep1.hayDiscrepancia).toBe(false);

    // Entrega 2: alistar 3, enviar 3
    prod = simularAlistamiento(prod, 3);
    expect(prod.cantidadAlistadaActual).toBe(3);
    expect(calcularMaxAlistar(prod)).toBe(3); // 10 - 4 - 3 = 3

    const envio2 = simularEnvio(prod, 2, '2026-02-22');
    prod = envio2.producto;
    expect(prod.cantidadEnviada).toBe(7);
    expect(prod.cantidadAlistadaActual).toBe(0);
    expect(prod.historialEnvios).toHaveLength(2);
    expect(prod.historialEnvios[1].cantidadEnviada).toBe(3);

    // Recibir 3
    const recep2 = simularRecepcion(prod, 3);
    prod = recep2.producto;
    expect(prod.cantidadRecibida).toBe(7);

    // Entrega 3: alistar 3 restantes, enviar completo
    prod = simularAlistamiento(prod, 3);
    expect(prod.cantidadAlistadaActual).toBe(3);
    expect(calcularMaxAlistar(prod)).toBe(0); // todo cubierto

    const envio3 = simularEnvio(prod, 3, '2026-02-25');
    prod = envio3.producto;
    expect(prod.cantidadEnviada).toBe(10);
    expect(prod.estadoProduccion).toBe('enviado');
    expect(prod.historialEnvios).toHaveLength(3);
    expect(prod.historialEnvios[2].tipo).toBe('completo');

    // Recibir últimas 3
    const recep3 = simularRecepcion(prod, 3);
    prod = recep3.producto;
    expect(prod.cantidadRecibida).toBe(10);
    expect(prod.estadoProduccion).toBe('recibido');
  });
});

describe('Escenario: discrepancia en recepción', () => {
  it('cliente reporta que recibió menos → se habilita reposición', () => {
    let prod = {
      cantidad: 10,
      cantidadAlistadaActual: 0,
      cantidadAlistadaTotal: 5,
      cantidadAlistada: 5,
      cantidadEnviada: 5,
      cantidadRecibida: 0,
      estadoProduccion: 'en_produccion',
      historialEnvios: [{ envioNumero: 1, cantidadEnviada: 5, cantidadAcumulada: 5, tipo: 'parcial', fecha: '2026-02-20' }]
    };

    // Cliente recibe solo 3 de 5
    const recep = simularRecepcion(prod, 3);
    prod = recep.producto;
    expect(recep.hayDiscrepancia).toBe(true);
    expect(prod.cantidadRecibida).toBe(3);

    // Ahora max alistar debe incluir: 5 pendientes originales + 2 reposición
    expect(calcularMaxAlistar(prod)).toBe(7);

    // Alistar 7 (5 originales + 2 reposición)
    prod = simularAlistamiento(prod, 7);
    expect(prod.cantidadAlistadaActual).toBe(7);
    // Ya se alistaron 7 (5 originales + 2 reposición), no se puede alistar más
    // pendientesOriginal = max(0, 10-5-7) = 0, discrepancia = 2 - 2 alistadas sobrantes = 0
    expect(calcularMaxAlistar(prod)).toBe(0);

    // Enviar 7
    const envio2 = simularEnvio(prod, 2, '2026-02-25');
    prod = envio2.producto;
    expect(prod.cantidadEnviada).toBe(12); // 5 + 7
    expect(prod.historialEnvios).toHaveLength(2);
  });

  it('discrepancia se resuelve cuando cliente recibe todo lo que pidió', () => {
    // Pidió 3, enviaron 2, recibió 1 (discrepancia)
    let prod = {
      cantidad: 3,
      cantidadAlistadaActual: 0,
      cantidadAlistadaTotal: 2,
      cantidadAlistada: 2,
      cantidadEnviada: 2,
      cantidadRecibida: 1,
      estadoProduccion: 'en_produccion'
    };

    // Discrepancia activa: recibida(1) < enviada(2) && recibida(1) < cantidad(3)
    expect(calcularMaxAlistar(prod)).toBe(2); // 1 original + 1 discrepancia

    // Alistar 2 (1 pendiente + 1 reposición) y enviar
    prod = simularAlistamiento(prod, 2);
    const { producto: prodEnviado } = simularEnvio(prod, 2, '2026-02-26');
    prod = prodEnviado;
    expect(prod.cantidadEnviada).toBe(4); // 2 + 2

    // Cliente recibe 2 de esta entrega → total recibidas = 3 = cantidad pedida
    const recep = simularRecepcion(prod, 2);
    prod = recep.producto;
    expect(prod.cantidadRecibida).toBe(3);

    // Discrepancia RESUELTA: recibida(3) >= cantidad(3)
    // Aunque enviada(4) > recibida(3), ya tiene todo lo que pidió
    expect(calcularMaxAlistar(prod)).toBe(0); // no más reposición
    const pendientes = calcularPendientes(prod);
    expect(pendientes.pendientesPorDiscrepancia).toBe(0);
    expect(pendientes.total).toBe(0);
    expect(tienePendientes(prod)).toBe(false);
  });
});

describe('Escenario: compatibilidad con pedido viejo (sin campos nuevos)', () => {
  it('funciona correctamente con solo cantidadAlistada', () => {
    // Pedido viejo: cantidadAlistada=8, cantidadEnviada=5
    // Significa que hay 3 listas para enviar ahora
    const prod = {
      cantidad: 10,
      cantidadAlistada: 8,
      cantidadEnviada: 5,
      cantidadRecibida: 0
    };

    expect(getAlistadaActual(prod)).toBe(3);
    expect(calcularMaxAlistar(prod)).toBe(2); // 10 - 5 - 3 = 2

    // Alistar 2 más
    const alistado = simularAlistamiento(prod, 2);
    expect(alistado.cantidadAlistadaActual).toBe(5); // 3 viejo + 2 nuevo
    expect(alistado.cantidadAlistadaTotal).toBe(10); // 8 viejo + 2 nuevo

    // Enviar
    const { producto } = simularEnvio(alistado, 2, '2026-02-25');
    expect(producto.cantidadEnviada).toBe(10);
    expect(producto.cantidadAlistadaActual).toBe(0);
    expect(producto.estadoProduccion).toBe('enviado');
  });
});

// ─────────────────────────────────────────────────────────────
// resolverPrecioOficialB2B (precios del portal)
// ─────────────────────────────────────────────────────────────
describe('resolverPrecioOficialB2B', () => {
  it('precio especial del cliente gana sobre precioB2B y precio base', () => {
    expect(resolverPrecioOficialB2B({ precioB2B: 52000, precio: 60000 }, 45000)).toBe(45000);
  });

  it('normaliza a número un precioEspecial guardado como string', () => {
    // Un "52000" (string) en precios_corporativos daría discrepancia falsa
    // permanente al comparar contra el precio numérico del carrito.
    expect(resolverPrecioOficialB2B({ precioB2B: 60000 }, '52000')).toBe(52000);
  });

  it('valor no numérico cae a 0 en vez de propagar NaN', () => {
    expect(resolverPrecioOficialB2B({}, 'abc')).toBe(0);
  });

  it('sin precio especial usa precioB2B', () => {
    expect(resolverPrecioOficialB2B({ precioB2B: 52000, precio: 60000 }, undefined)).toBe(52000);
  });

  it('sin precio especial ni precioB2B cae al precio base', () => {
    expect(resolverPrecioOficialB2B({ precio: 60000 }, undefined)).toBe(60000);
  });

  it('sin ningún precio devuelve 0', () => {
    expect(resolverPrecioOficialB2B({}, undefined)).toBe(0);
  });

  it('maneja producto undefined (default {})', () => {
    expect(resolverPrecioOficialB2B()).toBe(0);
  });

  it('precioB2B = 0 cae al precio base (cadena de ||)', () => {
    expect(resolverPrecioOficialB2B({ precioB2B: 0, precio: 60000 }, undefined)).toBe(60000);
  });

  it('CASO SUTIL: precioEspecial = 0 NO gana, cae al fallback', () => {
    // La función usa || (réplica exacta del catálogo del portal, Catalogo.jsx:113),
    // así que un precio especial de 0 se trata como "sin precio especial" y cae
    // a precioB2B. Es comportamiento HEREDADO INTENCIONAL: la resolución del
    // pedido debe coincidir con lo que el cliente ve en el catálogo.
    expect(resolverPrecioOficialB2B({ precioB2B: 52000, precio: 60000 }, 0)).toBe(52000);
  });
});

// ─────────────────────────────────────────────────────────────
// revalidarCarritoB2B (revalidación de precios al confirmar pedido)
// ─────────────────────────────────────────────────────────────
describe('revalidarCarritoB2B', () => {
  const catalogo = {
    'prod-1': { producto: { nombre: 'Camisa Colegio A', precioB2B: 52000, precio: 60000 } },
    'prod-2': { producto: { nombre: 'Pantalón Colegio A', precioB2B: 38000, precio: 42000 }, precioEspecial: 35000 }
  };

  it('carrito con precio correcto → itemsValidados con ese precio, sin discrepancias ni errores', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa Colegio A', talla: '10', precio: 52000, cantidad: 3 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toHaveLength(1);
    expect(res.itemsValidados[0].precio).toBe(52000);
    expect(res.itemsValidados[0].cantidad).toBe(3);
    expect(res.discrepancias).toEqual([]);
    expect(res.errores).toEqual([]);
  });

  it('precio manipulado en el carrito → el pedido lleva el precio OFICIAL y se reporta discrepancia', () => {
    // Escenario del bug: el carrito vive en localStorage y el cliente puede editarlo
    const cart = [{ id: 'prod-1', descripcion: 'Camisa Colegio A', talla: '12', precio: 1000, cantidad: 2 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toHaveLength(1);
    expect(res.itemsValidados[0].precio).toBe(52000); // NO el precio del carrito
    expect(res.discrepancias).toEqual([{
      productoId: 'prod-1',
      descripcion: 'Camisa Colegio A',
      talla: '12',
      precioCarrito: 1000,
      precioOficial: 52000
    }]);
    expect(res.errores).toEqual([]);
  });

  it('precio desactualizado (subió el catálogo) → mismo mecanismo: precio oficial + discrepancia', () => {
    // El cliente armó el carrito ayer a 52000; hoy el precio oficial es 58000
    const catalogoActualizado = {
      'prod-1': { producto: { nombre: 'Camisa Colegio A', precioB2B: 58000, precio: 60000 } }
    };
    const cart = [{ id: 'prod-1', descripcion: 'Camisa Colegio A', talla: '10', precio: 52000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogoActualizado);
    expect(res.itemsValidados[0].precio).toBe(58000);
    expect(res.discrepancias).toHaveLength(1);
    expect(res.discrepancias[0].precioCarrito).toBe(52000);
    expect(res.discrepancias[0].precioOficial).toBe(58000);
  });

  it('producto que ya no está en el catálogo → error y NO entra a itemsValidados', () => {
    const cart = [{ id: 'prod-borrado', descripcion: 'Falda descontinuada', precio: 30000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.discrepancias).toEqual([]);
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toContain('Falda descontinuada');
    expect(res.errores[0]).toContain('ya no existe en el catálogo');
  });

  it('entrada del catálogo sin producto → error (no se puede resolver precio)', () => {
    const catalogoCorrupto = { 'prod-1': { precioEspecial: 45000 } }; // sin .producto
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 45000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogoCorrupto);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
  });

  it('item sin id → error', () => {
    const cart = [{ descripcion: 'Item huérfano', precio: 10000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toContain('Item huérfano');
  });

  it('item sin id ni descripción → error con "Producto sin nombre"', () => {
    const res = revalidarCarritoB2B([{ precio: 10000, cantidad: 1 }], catalogo);
    expect(res.errores[0]).toContain('Producto sin nombre');
  });

  it('cantidad 0 → error y NO entra a itemsValidados', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: 0 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toContain('cantidad inválida');
  });

  it('cantidad negativa → error', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: -2 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
  });

  it('cantidad decimal (2.5) → error', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: 2.5 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toContain('2.5');
  });

  it('cantidad string no numérico ("abc") → error', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: 'abc' }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(1);
  });

  it('cantidad como string numérico entero ("3") → VÁLIDA, se sanea a número 3', () => {
    // Number('3') = 3 es entero → pasa la validación y el item sale con cantidad numérica
    const cart = [{ id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: '3' }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.errores).toEqual([]);
    expect(res.itemsValidados).toHaveLength(1);
    expect(res.itemsValidados[0].cantidad).toBe(3); // número, no '3'
  });

  it('precioEspecial del cliente gana sobre precioB2B en la validación', () => {
    // prod-2 tiene precioB2B=38000 pero el cliente tiene especial=35000
    const cart = [{ id: 'prod-2', descripcion: 'Pantalón Colegio A', talla: '14', precio: 38000, cantidad: 2 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados[0].precio).toBe(35000); // el especial, no precioB2B
    expect(res.discrepancias).toHaveLength(1); // carrito traía 38000
    expect(res.discrepancias[0].precioOficial).toBe(35000);
  });

  it('item validado conserva el resto de sus campos (spread)', () => {
    const cart = [{ id: 'prod-1', descripcion: 'Camisa Colegio A', talla: '8', color: 'Blanco', precio: 52000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados[0].talla).toBe('8');
    expect(res.itemsValidados[0].color).toBe('Blanco');
    expect(res.itemsValidados[0].descripcion).toBe('Camisa Colegio A');
  });

  it('mezcla: item válido + item con discrepancia + item con error → cada uno en su lista', () => {
    const cart = [
      { id: 'prod-1', descripcion: 'Camisa Colegio A', talla: '10', precio: 52000, cantidad: 2 },   // válido
      { id: 'prod-2', descripcion: 'Pantalón Colegio A', talla: '12', precio: 1000, cantidad: 1 },   // discrepancia
      { id: 'prod-x', descripcion: 'Producto fantasma', precio: 5000, cantidad: 1 }                  // error
    ];
    const res = revalidarCarritoB2B(cart, catalogo);

    expect(res.itemsValidados).toHaveLength(2); // el válido y el de discrepancia (con precio corregido)
    expect(res.itemsValidados[0].precio).toBe(52000);
    expect(res.itemsValidados[1].precio).toBe(35000); // oficial (especial del cliente)

    expect(res.discrepancias).toHaveLength(1);
    expect(res.discrepancias[0].productoId).toBe('prod-2');
    expect(res.discrepancias[0].precioCarrito).toBe(1000);
    expect(res.discrepancias[0].precioOficial).toBe(35000);

    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toContain('Producto fantasma');
  });

  it('carrito vacío → resultado vacío', () => {
    expect(revalidarCarritoB2B([], catalogo)).toEqual({ itemsValidados: [], discrepancias: [], errores: [] });
  });

  it('sin argumentos (defaults) → resultado vacío', () => {
    expect(revalidarCarritoB2B()).toEqual({ itemsValidados: [], discrepancias: [], errores: [] });
  });

  it('catálogo vacío → todos los items salen como error', () => {
    const cart = [
      { id: 'prod-1', descripcion: 'Camisa', precio: 52000, cantidad: 1 },
      { id: 'prod-2', descripcion: 'Pantalón', precio: 38000, cantidad: 2 }
    ];
    const res = revalidarCarritoB2B(cart, {});
    expect(res.itemsValidados).toEqual([]);
    expect(res.errores).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// regresión: precio del carrito manipulable en localStorage
// ─────────────────────────────────────────────────────────────
describe('regresión: el pedido B2B nunca debe crearse con el precio del carrito', () => {
  it('aunque el carrito traiga precio 0, el item validado sale con el oficial', () => {
    // Bug original: el pedido se creaba con item.precio tal cual venía de
    // localStorage. Un carrito editado con precio 0 generaba pedidos gratis.
    const catalogo = { 'p1': { producto: { nombre: 'Chaqueta', precioB2B: 95000 } } };
    const cart = [{ id: 'p1', descripcion: 'Chaqueta', talla: 'M', precio: 0, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo);

    expect(res.itemsValidados[0].precio).toBe(95000);
    expect(res.discrepancias).toEqual([{
      productoId: 'p1',
      descripcion: 'Chaqueta',
      talla: 'M',
      precioCarrito: 0,
      precioOficial: 95000
    }]);
  });

  it('item sin campo precio se trata como precioCarrito 0 → discrepancia, no crash', () => {
    const catalogo = { 'p1': { producto: { nombre: 'Chaqueta', precioB2B: 95000 } } };
    const cart = [{ id: 'p1', descripcion: 'Chaqueta', cantidad: 1 }]; // sin precio
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.itemsValidados[0].precio).toBe(95000);
    expect(res.discrepancias[0].precioCarrito).toBe(0);
  });

  it('el total del pedido se calcula sobre precios oficiales, no del carrito', () => {
    const catalogo = {
      'p1': { producto: { precioB2B: 50000 }, precioEspecial: 45000 },
      'p2': { producto: { precioB2B: 30000 } }
    };
    const cart = [
      { id: 'p1', descripcion: 'A', precio: 100, cantidad: 2 },  // manipulado
      { id: 'p2', descripcion: 'B', precio: 30000, cantidad: 3 } // correcto
    ];
    const { itemsValidados } = revalidarCarritoB2B(cart, catalogo);
    const total = itemsValidados.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
    expect(total).toBe(45000 * 2 + 30000 * 3); // 180000, jamás 100*2 + 30000*3
  });
});

// ─────────────────────────────────────────────────────────────
// CATÁLOGO POR CLIENTE — prendas compartidas y exclusivas
// ─────────────────────────────────────────────────────────────

// Prendas compartidas reales del negocio: viven en el colegio 'OT' y las ve
// cualquier cliente B2B salvo que se le defina una lista blanca.
const COMPARTIDAS = [
  { id: 'ot-england-10', colegio: 'OT', esB2B: true, nombre: 'PANTALON EN DIARIO TALLA 10' },
  { id: 'ot-england-12', colegio: 'OT', esB2B: true, nombre: 'PANTALON EN DIARIO TALLA 12' },
  { id: 'ot-bici-8', colegio: 'OT', esB2B: true, nombre: 'BICICLETERO OT TALLA 8 AZUL' }
];

const EXCLUSIVAS_GAR = [
  { id: 'gar-blusa-12', colegio: 'GAR', esB2B: true, nombre: 'BLUSA GAR DIARIO TALLA 12' }
];

describe('clienteVeCompartida', () => {
  it('sin lista blanca (campo ausente) ve TODAS las compartidas — compat con clientes existentes', () => {
    expect(clienteVeCompartida({ codigoColegio: 'GAR' }, 'ot-england-10')).toBe(true);
    expect(clienteVeCompartida({}, 'lo-que-sea')).toBe(true);
  });

  it('con lista blanca solo ve los ids listados', () => {
    const cliente = { productosCompartidos: ['ot-england-10'] };
    expect(clienteVeCompartida(cliente, 'ot-england-10')).toBe(true);
    expect(clienteVeCompartida(cliente, 'ot-bici-8')).toBe(false);
  });

  it('lista vacía = no ve ninguna compartida (distinto de "sin configurar")', () => {
    expect(clienteVeCompartida({ productosCompartidos: [] }, 'ot-england-10')).toBe(false);
  });

  it('compara ids como string (no rompe si alguno llegara numérico)', () => {
    expect(clienteVeCompartida({ productosCompartidos: [123] }, '123')).toBe(true);
  });

  it('null/undefined en el campo se tratan como "sin configurar"', () => {
    expect(clienteVeCompartida({ productosCompartidos: null }, 'x')).toBe(true);
    expect(clienteVeCompartida({ productosCompartidos: undefined }, 'x')).toBe(true);
  });
});

describe('tieneListaCompartidas', () => {
  it('distingue configurado de no configurado', () => {
    expect(tieneListaCompartidas({})).toBe(false);
    expect(tieneListaCompartidas({ productosCompartidos: [] })).toBe(true);
    expect(tieneListaCompartidas({ productosCompartidos: ['a'] })).toBe(true);
  });
});

describe('filtrarCompartidasPorCliente', () => {
  it('sin lista devuelve todas', () => {
    expect(filtrarCompartidasPorCliente(COMPARTIDAS, {})).toHaveLength(3);
  });

  it('con lista devuelve solo las habilitadas', () => {
    const cliente = { productosCompartidos: ['ot-england-10', 'ot-england-12'] };
    const res = filtrarCompartidasPorCliente(COMPARTIDAS, cliente);
    expect(res.map(p => p.id)).toEqual(['ot-england-10', 'ot-england-12']);
  });

  it('ids en la lista que ya no existen en el catálogo simplemente no aparecen', () => {
    const cliente = { productosCompartidos: ['ot-england-10', 'producto-borrado'] };
    expect(filtrarCompartidasPorCliente(COMPARTIDAS, cliente).map(p => p.id))
      .toEqual(['ot-england-10']);
  });

  it('no muta el array de entrada', () => {
    const original = [...COMPARTIDAS];
    filtrarCompartidasPorCliente(COMPARTIDAS, { productosCompartidos: [] });
    expect(COMPARTIDAS).toEqual(original);
  });
});

describe('construirCatalogoB2B', () => {
  it('las exclusivas del colegio siempre entran; las compartidas se filtran', () => {
    const cliente = { codigoColegio: 'GAR', productosCompartidos: ['ot-bici-8'] };
    const res = construirCatalogoB2B(EXCLUSIVAS_GAR, COMPARTIDAS, cliente);
    expect(res.map(p => p.id)).toEqual(['gar-blusa-12', 'ot-bici-8']);
  });

  it('un colegio sin compartidas habilitadas solo ve lo suyo', () => {
    const cliente = { codigoColegio: 'NUE', productosCompartidos: [] };
    expect(construirCatalogoB2B(EXCLUSIVAS_GAR, COMPARTIDAS, cliente).map(p => p.id))
      .toEqual(['gar-blusa-12']);
  });

  it('cliente sin configurar ve exclusivas + todas las compartidas (comportamiento actual)', () => {
    expect(construirCatalogoB2B(EXCLUSIVAS_GAR, COMPARTIDAS, { codigoColegio: 'GAR' }))
      .toHaveLength(4);
  });
});

describe('prendaPermitidaParaCliente', () => {
  const gardner = { codigoColegio: 'GAR', productosCompartidos: ['ot-england-10'] };

  it('permite la prenda exclusiva del colegio del cliente', () => {
    expect(prendaPermitidaParaCliente(EXCLUSIVAS_GAR[0], gardner)).toBe(true);
  });

  it('RECHAZA la prenda exclusiva de OTRO colegio (carrito cruzado entre clientes)', () => {
    const prendaOtroColegio = { id: 'nue-camisa', colegio: 'NUE', esB2B: true };
    expect(prendaPermitidaParaCliente(prendaOtroColegio, gardner)).toBe(false);
  });

  it('permite la compartida habilitada y rechaza la no habilitada', () => {
    expect(prendaPermitidaParaCliente(COMPARTIDAS[0], gardner)).toBe(true);  // en la lista
    expect(prendaPermitidaParaCliente(COMPARTIDAS[2], gardner)).toBe(false); // fuera de la lista
  });

  it('rechaza cualquier producto que no sea B2B aunque sea de su colegio', () => {
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: 'GAR', esB2B: false }, gardner)).toBe(false);
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: 'GAR' }, gardner)).toBe(false);
  });

  it('normaliza mayúsculas/espacios del código de colegio', () => {
    const cliente = { codigoColegio: ' gar ' };
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: 'GAR', esB2B: true }, cliente)).toBe(true);
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: ' gar', esB2B: true }, cliente)).toBe(true);
  });

  it('rechaza si el producto no tiene colegio o el cliente no tiene código', () => {
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: '', esB2B: true }, gardner)).toBe(false);
    expect(prendaPermitidaParaCliente({ id: 'x', colegio: 'GAR', esB2B: true }, {})).toBe(false);
  });

  it('el código de compartidas es OT', () => {
    expect(CODIGO_COMPARTIDAS).toBe('OT');
  });
});

describe('revalidarCarritoB2B — validación de catálogo por cliente', () => {
  const catalogo = {
    'gar-blusa-12': { producto: { colegio: 'GAR', esB2B: true, nombre: 'BLUSA GAR', precioB2B: 47000 } },
    'ot-england-10': { producto: { colegio: 'OT', esB2B: true, nombre: 'PANTALON EN', precioB2B: 64000 } },
    'ot-bici-8': { producto: { colegio: 'OT', esB2B: true, nombre: 'BICICLETERO', precioB2B: 17000 } },
    'nue-camisa': { producto: { colegio: 'NUE', esB2B: true, nombre: 'CAMISA NUEVO COLEGIO', precioB2B: 50000 } }
  };
  const gardner = { codigoColegio: 'GAR', productosCompartidos: ['ot-england-10'] };

  it('sin cliente se comporta igual que antes (compatibilidad)', () => {
    const cart = [{ id: 'nue-camisa', descripcion: 'Camisa', precio: 50000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo);
    expect(res.errores).toHaveLength(0);
    expect(res.itemsValidados).toHaveLength(1);
  });

  it('rechaza la prenda de otro colegio cuando se pasa el cliente', () => {
    const cart = [{ id: 'nue-camisa', descripcion: 'Camisa', precio: 50000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo, { cliente: gardner });
    expect(res.itemsValidados).toHaveLength(0);
    expect(res.errores[0]).toMatch(/no está disponible para tu colegio/);
  });

  it('rechaza la compartida que el cliente no tiene habilitada', () => {
    const cart = [{ id: 'ot-bici-8', descripcion: 'Bicicletero', precio: 17000, cantidad: 2 }];
    const res = revalidarCarritoB2B(cart, catalogo, { cliente: gardner });
    expect(res.itemsValidados).toHaveLength(0);
    expect(res.errores).toHaveLength(1);
  });

  it('deja pasar lo suyo y lo compartido habilitado, y no toca los precios oficiales', () => {
    const cart = [
      { id: 'gar-blusa-12', descripcion: 'Blusa', precio: 47000, cantidad: 2 },
      { id: 'ot-england-10', descripcion: 'England', precio: 64000, cantidad: 1 },
      { id: 'ot-bici-8', descripcion: 'Bicicletero', precio: 17000, cantidad: 1 }
    ];
    const res = revalidarCarritoB2B(cart, catalogo, { cliente: gardner });
    expect(res.itemsValidados.map(i => i.id)).toEqual(['gar-blusa-12', 'ot-england-10']);
    expect(res.errores).toHaveLength(1);
    expect(res.discrepancias).toHaveLength(0);
  });

  it('un precio especial del cliente sigue ganando sobre precioB2B tras el filtro', () => {
    const catalogoConEspecial = {
      'ot-england-10': { producto: { colegio: 'OT', esB2B: true, precioB2B: 64000 }, precioEspecial: 60000 }
    };
    const cart = [{ id: 'ot-england-10', descripcion: 'England', precio: 64000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogoConEspecial, { cliente: gardner });
    expect(res.itemsValidados[0].precio).toBe(60000);
    expect(res.discrepancias[0].precioOficial).toBe(60000);
  });

  it('cliente sin lista blanca puede pedir cualquier compartida', () => {
    const cart = [{ id: 'ot-bici-8', descripcion: 'Bicicletero', precio: 17000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogo, { cliente: { codigoColegio: 'GAR' } });
    expect(res.errores).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularCambiosPreciosCorporativos — guardado de "Catálogo y precios"
// ─────────────────────────────────────────────────────────────
describe('calcularCambiosPreciosCorporativos', () => {
  // Datos reales del negocio: el England escalona precio por talla
  const PRODUCTOS = [
    { id: 'p10', nombre: 'PANTALON EN DIARIO TALLA 10', referencia: 'EN10', precio: 67000, precioB2B: 64000 },
    { id: 'p12', nombre: 'PANTALON EN DIARIO TALLA 12', referencia: 'EN12', precio: 68000, precioB2B: 65000 },
    { id: 'g01', nombre: 'BLUSA GAR DIARIO TALLA 12', referencia: 'GAR003T12', precio: 47000 }
  ];

  it('input vacío sin precio guardado: no hace nada', () => {
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, {}, {});
    expect(res).toEqual({ aEscribir: [], aBorrar: [], errores: [] });
  });

  it('input vacío con precio guardado: lo borra (vuelve al precio de lista)', () => {
    const guardados = { p10: { docId: 'doc-1', precioEspecial: 60000 } };
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '' }, guardados);
    expect(res.aBorrar).toEqual(['doc-1']);
    expect(res.aEscribir).toHaveLength(0);
  });

  it('input ausente (nunca se tocó) con precio guardado también lo borra', () => {
    const guardados = { p10: { docId: 'doc-1', precioEspecial: 60000 } };
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, {}, guardados);
    expect(res.aBorrar).toEqual(['doc-1']);
  });

  it('precio nuevo se crea sin docId', () => {
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64000' }, {});
    expect(res.aEscribir).toHaveLength(1);
    expect(res.aEscribir[0]).toMatchObject({
      productoId: 'p10', precioEspecial: 64000, referencia: 'EN10', precioTienda: 67000
    });
    expect(res.aEscribir[0].docId).toBeUndefined();
  });

  it('precio cambiado reusa el docId existente (no duplica documentos)', () => {
    const guardados = { p10: { docId: 'doc-1', precioEspecial: 64000 } };
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '62000' }, guardados);
    expect(res.aEscribir[0].docId).toBe('doc-1');
    expect(res.aEscribir[0].precioEspecial).toBe(62000);
  });

  it('precio idéntico al guardado no genera escritura', () => {
    const guardados = { p10: { docId: 'doc-1', precioEspecial: 64000 } };
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64000' }, guardados);
    expect(res.aEscribir).toHaveLength(0);
    expect(res.aBorrar).toHaveLength(0);
  });

  it('precio guardado como string compara sin dar falso cambio', () => {
    const guardados = { p10: { docId: 'doc-1', precioEspecial: '64000' } };
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64000' }, guardados);
    expect(res.aEscribir).toHaveLength(0);
  });

  it('espacios alrededor del número no rompen nada', () => {
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '  64000  ' }, {});
    expect(res.aEscribir[0].precioEspecial).toBe(64000);
  });

  it('rechaza 0, negativos y texto — sin escribir nada de ese producto', () => {
    const res = calcularCambiosPreciosCorporativos(
      PRODUCTOS,
      { p10: '0', p12: '-5000', g01: 'abc' },
      {}
    );
    expect(res.aEscribir).toHaveLength(0);
    expect(res.errores).toHaveLength(3);
  });

  it('rechaza el separador de miles: "64.000" NO se guarda como $64', () => {
    // Por qué se valida el texto crudo y no el número: Number('64.000') === 64,
    // un entero perfectamente válido. Convertir primero perdería el caso.
    expect(Number('64.000')).toBe(64);
    expect(Number.isInteger(Number('64.000'))).toBe(true);

    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64.000' }, {});
    expect(res.aEscribir).toHaveLength(0);
    expect(res.errores[0]).toMatch(/punto o coma/);
  });

  it('rechaza coma como separador y decimales reales', () => {
    expect(calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64,000' }, {}).errores).toHaveLength(1);
    expect(calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64000.5' }, {}).errores).toHaveLength(1);
  });

  it('un precio válido pero absurdamente bajo queda marcado como sospechoso', () => {
    // "64" en vez de "64000": es un entero legítimo, así que solo se puede
    // advertir. La pantalla lo muestra en el confirm con ⚠️ antes de escribir.
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64' }, {});
    expect(res.errores).toHaveLength(0);
    expect(res.aEscribir[0].sospechoso).toBe(true);
  });

  it('un precio normal no queda marcado como sospechoso', () => {
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '64000', g01: '44000' }, {});
    expect(res.aEscribir.every(c => c.sospechoso === false)).toBe(true);
  });

  it('sin precio de tienda no puede juzgar sospecha (no marca)', () => {
    const sinPrecio = [{ id: 'x', nombre: 'X', precio: 0 }];
    const res = calcularCambiosPreciosCorporativos(sinPrecio, { x: '10' }, {});
    expect(res.aEscribir[0].sospechoso).toBe(false);
  });

  it('escenario completo: crea uno, actualiza otro, borra un tercero', () => {
    const guardados = {
      p12: { docId: 'doc-12', precioEspecial: 65000 },
      g01: { docId: 'doc-g1', precioEspecial: 44000 }
    };
    const res = calcularCambiosPreciosCorporativos(
      PRODUCTOS,
      { p10: '64000', p12: '63000', g01: '' },
      guardados
    );
    expect(res.errores).toHaveLength(0);
    expect(res.aEscribir.map(c => [c.productoId, c.precioEspecial, c.docId])).toEqual([
      ['p10', 64000, undefined],
      ['p12', 63000, 'doc-12']
    ]);
    expect(res.aBorrar).toEqual(['doc-g1']);
  });

  it('un guardado sin docId no se intenta borrar (dato corrupto no rompe el guardado)', () => {
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, { p10: '' }, { p10: { precioEspecial: 1 } });
    expect(res.aBorrar).toHaveLength(0);
  });

  it('replica el descuento fijo por grupo: tienda − 3000 en cada talla', () => {
    const descuento = 3000;
    const inputs = {};
    PRODUCTOS.filter(p => p.id.startsWith('p')).forEach(p => {
      inputs[p.id] = String(p.precio - descuento);
    });
    const res = calcularCambiosPreciosCorporativos(PRODUCTOS, inputs, {});
    expect(res.aEscribir.map(c => c.precioEspecial)).toEqual([64000, 65000]);
    expect(res.errores).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Escenarios integrales del alta de un colegio nuevo
// ─────────────────────────────────────────────────────────────
describe('alta de colegio nuevo — catálogo y pedido punta a punta', () => {
  const compartidas = [
    { id: 'ot-en-10', colegio: 'OT', esB2B: true, nombre: 'PANTALON EN DIARIO TALLA 10', precio: 67000, precioB2B: 64000 },
    { id: 'ot-bici-8', colegio: 'OT', esB2B: true, nombre: 'BICICLETERO OT TALLA 8', precio: 18000, precioB2B: 17000 }
  ];
  const exclusivasNuevo = [
    { id: 'nue-camisa-10', colegio: 'NUE', esB2B: true, nombre: 'CAMISA NUE DIARIO TALLA 10', precio: 55000 }
  ];

  it('cliente recién creado (lista vacía) solo ve sus prendas exclusivas', () => {
    const nuevo = { codigoColegio: 'NUE', productosCompartidos: [] };
    const catalogo = construirCatalogoB2B(exclusivasNuevo, compartidas, nuevo);
    expect(catalogo.map(p => p.id)).toEqual(['nue-camisa-10']);
  });

  it('al habilitarle el England lo ve, con SU precio propio y no el de lista', () => {
    const nuevo = { codigoColegio: 'NUE', productosCompartidos: ['ot-en-10'] };
    const catalogo = construirCatalogoB2B(exclusivasNuevo, compartidas, nuevo);
    expect(catalogo.map(p => p.id)).toEqual(['nue-camisa-10', 'ot-en-10']);

    const preciosPropios = { 'ot-en-10': 62000 };
    const england = catalogo.find(p => p.id === 'ot-en-10');
    expect(resolverPrecioOficialB2B(england, preciosPropios[england.id])).toBe(62000);
    // Gardner, sin precio propio, sigue en el precioB2B de lista
    expect(resolverPrecioOficialB2B(england, undefined)).toBe(64000);
  });

  it('sin precio propio ni precioB2B, la prenda exclusiva se cobra al precio de tienda', () => {
    expect(resolverPrecioOficialB2B(exclusivasNuevo[0], undefined)).toBe(55000);
  });

  it('el pedido del colegio nuevo rechaza la compartida que no le habilitaron', () => {
    const nuevo = { codigoColegio: 'NUE', productosCompartidos: ['ot-en-10'] };
    const catalogoPorId = {
      'ot-en-10': { producto: compartidas[0], precioEspecial: 62000 },
      'ot-bici-8': { producto: compartidas[1] }
    };
    const cart = [
      { id: 'ot-en-10', descripcion: 'England', precio: 62000, cantidad: 5 },
      { id: 'ot-bici-8', descripcion: 'Bicicletero', precio: 17000, cantidad: 3 }
    ];
    const res = revalidarCarritoB2B(cart, catalogoPorId, { cliente: nuevo });
    expect(res.itemsValidados.map(i => i.id)).toEqual(['ot-en-10']);
    expect(res.itemsValidados[0].precio).toBe(62000);
    expect(res.errores).toHaveLength(1);
    expect(res.discrepancias).toHaveLength(0); // el precio del carrito ya era el oficial
  });

  it('quitarle una prenda del catálogo no cambia el precio de las que sí lleva', () => {
    const antes = { codigoColegio: 'NUE', productosCompartidos: ['ot-en-10', 'ot-bici-8'] };
    const despues = { codigoColegio: 'NUE', productosCompartidos: ['ot-en-10'] };
    const precios = { 'ot-en-10': 62000 };
    const enAntes = construirCatalogoB2B([], compartidas, antes).find(p => p.id === 'ot-en-10');
    const enDespues = construirCatalogoB2B([], compartidas, despues).find(p => p.id === 'ot-en-10');
    expect(resolverPrecioOficialB2B(enAntes, precios[enAntes.id]))
      .toBe(resolverPrecioOficialB2B(enDespues, precios[enDespues.id]));
  });

  it('Gardner sin lista definida no se ve afectado por el alta del colegio nuevo', () => {
    const gardner = { codigoColegio: 'GAR' }; // sin productosCompartidos
    const catalogo = construirCatalogoB2B([], compartidas, gardner);
    expect(catalogo).toHaveLength(2); // sigue viendo todas las compartidas
  });

  it('el carrito de Gardner no puede colar una prenda del colegio nuevo', () => {
    const gardner = { codigoColegio: 'GAR' };
    const catalogoPorId = { 'nue-camisa-10': { producto: exclusivasNuevo[0] } };
    const cart = [{ id: 'nue-camisa-10', descripcion: 'Camisa NUE', precio: 55000, cantidad: 1 }];
    const res = revalidarCarritoB2B(cart, catalogoPorId, { cliente: gardner });
    expect(res.itemsValidados).toHaveLength(0);
    expect(res.errores[0]).toMatch(/no está disponible para tu colegio/);
  });
});

// ─────────────────────────────────────────────────────────────
// idPrecioCorporativo — idempotencia del guardado
// ─────────────────────────────────────────────────────────────
describe('idPrecioCorporativo', () => {
  it('el mismo par cliente+producto siempre da el mismo id', () => {
    expect(idPrecioCorporativo('cli1', 'prod1')).toBe(idPrecioCorporativo('cli1', 'prod1'));
  });

  it('clientes distintos sobre el mismo producto no colisionan', () => {
    expect(idPrecioCorporativo('cli1', 'prod1')).not.toBe(idPrecioCorporativo('cli2', 'prod1'));
  });

  it('productos distintos del mismo cliente no colisionan', () => {
    expect(idPrecioCorporativo('cli1', 'prod1')).not.toBe(idPrecioCorporativo('cli1', 'prod2'));
  });

  it('el separador evita colisiones entre ids que se solapan', () => {
    // Sin separador, ('ab','c') y ('a','bc') producirían el mismo id
    expect(idPrecioCorporativo('ab', 'c')).not.toBe(idPrecioCorporativo('a', 'bc'));
  });

  it('no produce "/" — rompería la ruta del documento en Firestore', () => {
    expect(idPrecioCorporativo('gardner_001', 'AbC123')).not.toContain('/');
  });

  it('tolera espacios accidentales sin cambiar el id', () => {
    expect(idPrecioCorporativo(' cli1 ', ' prod1 ')).toBe(idPrecioCorporativo('cli1', 'prod1'));
  });
});

// ─────────────────────────────────────────────────────────────
// CLIENTES B2B — alta, baja y acceso al portal
// ─────────────────────────────────────────────────────────────
describe('normalizarEmailB2B', () => {
  it('pasa a minúsculas y quita espacios', () => {
    expect(normalizarEmailB2B('  Rector@ColegioNuevo.EDU.co ')).toBe('rector@colegionuevo.edu.co');
  });

  it('un email ya normalizado no cambia', () => {
    expect(normalizarEmailB2B('norma@colegiogardner.com')).toBe('norma@colegiogardner.com');
  });

  it('null/undefined dan cadena vacía en vez de romper', () => {
    expect(normalizarEmailB2B(null)).toBe('');
    expect(normalizarEmailB2B(undefined)).toBe('');
  });

  it('es idempotente', () => {
    const una = normalizarEmailB2B(' A@B.CO ');
    expect(normalizarEmailB2B(una)).toBe(una);
  });
});

describe('clientePortalActivo', () => {
  it('solo un false explícito bloquea el acceso', () => {
    expect(clientePortalActivo({ activo: false })).toBe(false);
    expect(clientePortalActivo({ activo: true })).toBe(true);
  });

  it('cliente legacy sin el campo sigue entrando (no se les corta el acceso)', () => {
    expect(clientePortalActivo({ nombre: 'Gardner' })).toBe(true);
  });

  it('sin cliente no hay acceso', () => {
    expect(clientePortalActivo(null)).toBe(false);
    expect(clientePortalActivo(undefined)).toBe(false);
  });
});

describe('evaluarBorradoClienteB2B', () => {
  it('un cliente sin pedidos sí se puede borrar (alta equivocada)', () => {
    const res = evaluarBorradoClienteB2B([]);
    expect(res.puedeBorrar).toBe(true);
    expect(res.motivo).toBe('');
  });

  it('un cliente con pedidos NO se puede borrar', () => {
    const res = evaluarBorradoClienteB2B([{ estado: 'Completado', total: 100000, abonos: [{ monto: 100000 }] }]);
    expect(res.puedeBorrar).toBe(false);
    expect(res.total).toBe(1);
    expect(res.motivo).toMatch(/Desactívalo/);
  });

  it('cuenta los pedidos en curso y excluye los finalizados', () => {
    const res = evaluarBorradoClienteB2B([
      { estado: 'Completado' }, { estado: 'Anulado' }, { estado: 'Cancelado' },
      { estado: 'Enviado' }, { estado: 'En Preparación' }
    ]);
    expect(res.total).toBe(5);
    expect(res.enCurso).toBe(2);
  });

  it('el flag anulado también saca al pedido de "en curso"', () => {
    const res = evaluarBorradoClienteB2B([{ estado: 'Enviado', anulado: true }]);
    expect(res.enCurso).toBe(0);
  });

  it('suma el saldo pendiente descontando abonos', () => {
    const res = evaluarBorradoClienteB2B([
      { estado: 'Enviado', total: 500000, abonos: [{ monto: 241000 }] },
      { estado: 'Completado', total: 100000, abonos: [{ monto: 100000 }] }
    ]);
    expect(res.saldoPendiente).toBe(259000);
    expect(res.motivo).toMatch(/259.000/);
  });

  it('los pedidos anulados no arrastran saldo', () => {
    const res = evaluarBorradoClienteB2B([{ estado: 'Anulado', total: 900000, abonos: [] }]);
    expect(res.saldoPendiente).toBe(0);
  });

  it('sin abonos el saldo es el total del pedido', () => {
    const res = evaluarBorradoClienteB2B([{ estado: 'Enviado', total: 80000 }]);
    expect(res.saldoPendiente).toBe(80000);
  });

  it('escenario real de Gardner: 15 pedidos, 9 en curso, $259.000 → no se borra', () => {
    const pedidos = [
      ...Array.from({ length: 5 }, () => ({ estado: 'Completado', total: 100000, abonos: [{ monto: 100000 }] })),
      { estado: 'Anulado', total: 50000, abonos: [] },
      ...Array.from({ length: 7 }, () => ({ estado: 'Enviado', total: 100000, abonos: [{ monto: 100000 }] })),
      { estado: 'Enviado Parcial', total: 259000, abonos: [] },
      { estado: 'Enviado Parcial', total: 100000, abonos: [{ monto: 100000 }] }
    ];
    const res = evaluarBorradoClienteB2B(pedidos);
    expect(res.total).toBe(15);
    expect(res.enCurso).toBe(9);
    expect(res.saldoPendiente).toBe(259000);
    expect(res.puedeBorrar).toBe(false);
  });
});
