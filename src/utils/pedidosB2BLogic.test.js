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
  calcularSaldoPendienteB2B
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
