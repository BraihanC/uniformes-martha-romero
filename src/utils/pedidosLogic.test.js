import { describe, it, expect } from 'vitest';
import {
  esItemInactivo,
  calcularValorDeEntrega,
  calcularValorYaEntregado,
  calcularValorAcumuladoConHoy,
  calcularSaldoRequerido,
  calcularUpdatedItems,
  calcularEstadoGeneral,
} from './pedidosLogic';

// ─────────────────────────────────────────────────────────────
// FIXTURES DE ÍTEMS
// ─────────────────────────────────────────────────────────────

const itemListo = (overrides = {}) => ({
  estadoItem: 'Listo para Entrega',
  cantidad: 1,
  precio: 50000,
  subtotal: 50000,
  cantidadEntregada: 0,
  cantidadLista: 0,
  anulado: false,
  ...overrides,
});

const itemParcial = (overrides = {}) => ({
  estadoItem: 'Parcialmente Listo',
  cantidad: 4,
  precio: 10000,
  subtotal: 40000,
  cantidadEntregada: 0,
  cantidadLista: 2,
  anulado: false,
  ...overrides,
});

const itemEntregado = (overrides = {}) => ({
  estadoItem: 'Entregado',
  cantidad: 2,
  precio: 70000,
  subtotal: 140000,
  cantidadEntregada: 2,
  cantidadLista: 0,
  anulado: false,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────
// esItemInactivo
// ─────────────────────────────────────────────────────────────

describe('esItemInactivo', () => {
  it('retorna true si el ítem está anulado', () => {
    expect(esItemInactivo({ anulado: true, estadoItem: 'Listo para Entrega' })).toBe(true);
  });

  it('retorna true si el estadoItem es Cambio de Talla', () => {
    expect(esItemInactivo({ anulado: false, estadoItem: 'Cambio de Talla' })).toBe(true);
  });

  it('retorna false para un ítem activo normal', () => {
    expect(esItemInactivo({ anulado: false, estadoItem: 'Listo para Entrega' })).toBe(false);
  });

  it('retorna false para un ítem Entregado', () => {
    expect(esItemInactivo({ anulado: false, estadoItem: 'Entregado' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularValorDeEntrega
// ─────────────────────────────────────────────────────────────

describe('calcularValorDeEntrega', () => {
  it('calcula precio × cantidadPendiente para ítem Listo sin entregas previas', () => {
    // cantidad=1, cantidadEntregada=0 → pendiente=1, 1×50000=50000
    const items = [itemListo({ cantidad: 1, precio: 50000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(50000);
  });

  it('calcula precio × cantidadPendiente para múltiples unidades', () => {
    // cantidad=2, cantidadEntregada=0 → pendiente=2, 2×40000=80000
    const items = [itemListo({ cantidad: 2, precio: 40000, cantidadEntregada: 0 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(80000);
  });

  it('descuenta cantidadEntregada previa del cálculo', () => {
    // cantidad=3, cantidadEntregada=1 → pendiente=2, 2×50000=100000
    const items = [itemListo({ cantidad: 3, cantidadEntregada: 1, precio: 50000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(100000);
  });

  it('usa precioUnitario como fallback si no hay precio', () => {
    const items = [itemListo({ precio: undefined, precioUnitario: 39000, cantidad: 1 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(39000);
  });

  it('retorna 0 si no hay precio ni precioUnitario', () => {
    const items = [itemListo({ precio: undefined, precioUnitario: undefined })];
    expect(calcularValorDeEntrega(items, [0])).toBe(0);
  });

  it('usa cantidadLista × precio para ítem Parcialmente Listo', () => {
    const items = [itemParcial({ cantidadLista: 2, precio: 10000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(20000);
  });

  it('usa cantidadLista × precioUnitario si no hay precio en parcial', () => {
    const items = [itemParcial({ cantidadLista: 3, precio: undefined, precioUnitario: 15000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(45000);
  });

  it('suma múltiples ítems seleccionados', () => {
    const items = [
      itemListo({ cantidad: 1, precio: 92000 }),   // pendiente=1, 92000
      itemListo({ cantidad: 1, precio: 40000 }),   // pendiente=1, 40000
    ];
    expect(calcularValorDeEntrega(items, [0, 1])).toBe(132000);
  });

  it('solo suma los ítems en selectedIndices', () => {
    const items = [
      itemListo({ cantidad: 1, precio: 92000 }),   // índice 0 — seleccionado
      itemListo({ cantidad: 1, precio: 40000 }),   // índice 1 — NO seleccionado
    ];
    expect(calcularValorDeEntrega(items, [0])).toBe(92000);
  });

  it('retorna 0 si la lista de índices está vacía', () => {
    const items = [itemListo({ precio: 50000 })];
    expect(calcularValorDeEntrega(items, [])).toBe(0);
  });

  it('retorna 0 para item con todo ya entregado', () => {
    // cantidad=2, cantidadEntregada=2 → pendiente=0
    const items = [itemListo({ cantidad: 2, cantidadEntregada: 2, precio: 50000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularValorYaEntregado
// ─────────────────────────────────────────────────────────────

describe('calcularValorYaEntregado', () => {
  it('cuenta ítems con cantidadEntregada > 0 que no están seleccionados', () => {
    const items = [itemEntregado({ cantidadEntregada: 1, precio: 70000 })];
    expect(calcularValorYaEntregado(items, [])).toBe(70000);
  });

  it('SÍ cuenta entregas previas de ítems seleccionados (entregas parciales)', () => {
    // Item con 1 ya entregada, seleccionado para entregar el resto
    const items = [itemListo({ cantidadEntregada: 1, precio: 70000, cantidad: 3 })];
    expect(calcularValorYaEntregado(items, [0])).toBe(70000);
  });

  it('NO cuenta ítems anulados', () => {
    const items = [itemEntregado({ cantidadEntregada: 2, precio: 50000, anulado: true })];
    expect(calcularValorYaEntregado(items, [])).toBe(0);
  });

  it('NO cuenta ítems con cantidadEntregada = 0', () => {
    const items = [itemListo({ cantidadEntregada: 0, precio: 90000 })];
    expect(calcularValorYaEntregado(items, [])).toBe(0);
  });

  it('usa precioUnitario si no hay precio', () => {
    const items = [itemEntregado({ cantidadEntregada: 1, precio: undefined, precioUnitario: 60000 })];
    expect(calcularValorYaEntregado(items, [])).toBe(60000);
  });

  it('retorna 0 si precio y precioUnitario son undefined', () => {
    const items = [itemEntregado({ cantidadEntregada: 1, precio: undefined, precioUnitario: undefined })];
    expect(calcularValorYaEntregado(items, [])).toBe(0);
  });

  it('suma correctamente varios ítems ya entregados', () => {
    const items = [
      itemEntregado({ cantidadEntregada: 1, precio: 70000 }),  // 70000
      itemEntregado({ cantidadEntregada: 2, precio: 39000 }),  // 78000
    ];
    expect(calcularValorYaEntregado(items, [])).toBe(148000);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularValorAcumuladoConHoy
// ─────────────────────────────────────────────────────────────

describe('calcularValorAcumuladoConHoy', () => {
  it('suma ya entregado + entrega hoy normalmente', () => {
    expect(calcularValorAcumuladoConHoy(100000, 80000, 300000)).toBe(180000);
  });

  it('capea al total del pedido si la suma lo excede', () => {
    expect(calcularValorAcumuladoConHoy(250000, 80000, 300000)).toBe(300000);
  });

  it('retorna el total exacto cuando la suma iguala el total', () => {
    expect(calcularValorAcumuladoConHoy(200000, 100000, 300000)).toBe(300000);
  });

  it('retorna 0 cuando todo es 0', () => {
    expect(calcularValorAcumuladoConHoy(0, 0, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularSaldoRequerido
// ─────────────────────────────────────────────────────────────

describe('calcularSaldoRequerido', () => {
  it('retorna la diferencia cuando el abono no alcanza', () => {
    expect(calcularSaldoRequerido(200000, 100000)).toBe(100000);
  });

  it('retorna 0 cuando el abono cubre exactamente el acumulado', () => {
    expect(calcularSaldoRequerido(200000, 200000)).toBe(0);
  });

  it('retorna 0 cuando el abono supera el acumulado (no puede ser negativo)', () => {
    expect(calcularSaldoRequerido(200000, 250000)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// ESCENARIOS DE NEGOCIO COMPLETOS
// ─────────────────────────────────────────────────────────────

describe('Escenarios completos de pago en entrega', () => {
  it('Pedido $200K — abonó $100K — lleva hoy 2 items de $80K y $60K → debe pagar $40K', () => {
    const totalPedido = 200000;
    const totalAbonado = 100000;
    const items = [
      itemListo({ cantidad: 1, precio: 80000, cantidadEntregada: 0 }),   // 0 — seleccionado
      itemListo({ cantidad: 1, precio: 60000, cantidadEntregada: 0 }),   // 1 — seleccionado
    ];
    const selectedIndices = [0, 1];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(140000);
    expect(valorYaEntregado).toBe(0);
    expect(valorAcumuladoConHoy).toBe(140000);
    expect(saldoRequerido).toBe(40000);
  });

  it('Segunda visita — abonó $140K — lleva restante $60K → debe pagar $60K', () => {
    const totalPedido = 200000;
    const totalAbonado = 140000;   // pagó $100K inicial + $40K en primera visita
    const items = [
      itemEntregado({ cantidadEntregada: 1, precio: 80000 }),  // 0 — ya entregado
      itemEntregado({ cantidadEntregada: 1, precio: 60000 }),  // 1 — ya entregado
      itemListo({ cantidad: 1, cantidadEntregada: 0, precio: 60000 }),   // 2 — seleccionado hoy
    ];
    const selectedIndices = [2];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(60000);
    expect(valorYaEntregado).toBe(140000);
    expect(valorAcumuladoConHoy).toBe(200000);
    expect(saldoRequerido).toBe(60000);
  });

  it('Pedido $375K totalmente pagado — entrega final → saldo $0', () => {
    const totalPedido = 375000;
    const totalAbonado = 375000;
    const items = [
      itemEntregado({ precio: 70000, cantidadEntregada: 1 }),   // 0 — ya entregado
      itemEntregado({ precio: 40000, cantidadEntregada: 1 }),   // 1 — ya entregado
      itemEntregado({ precio: 96000, cantidadEntregada: 1 }),   // 2 — ya entregado
      itemListo({ cantidad: 1, precio: 89000, cantidadEntregada: 0 }),  // 3 — seleccionado hoy
      itemListo({ cantidad: 1, precio: 80000, cantidadEntregada: 0 }),  // 4 — seleccionado hoy
    ];
    const selectedIndices = [3, 4];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(169000);
    expect(valorYaEntregado).toBe(206000);
    expect(valorAcumuladoConHoy).toBe(375000);
    expect(saldoRequerido).toBe(0);
  });

  it('Datos inconsistentes: acumulado > total → se capea al total', () => {
    const totalPedido = 330000;
    const totalAbonado = 260000;
    const valorYaEntregado     = 331000;   // > totalPedido por error de datos
    const valorDeEntrega       = 69000;
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorAcumuladoConHoy).toBe(330000);
    expect(saldoRequerido).toBe(70000);
  });

  it('Pedido completamente pagado de antemano → no cobra nada al entregar', () => {
    const totalPedido = 132000;
    const totalAbonado = 132000;
    const items = [
      itemListo({ cantidad: 1, precio: 92000, cantidadEntregada: 0 }),
      itemListo({ cantidad: 1, precio: 40000, cantidadEntregada: 0 }),
    ];
    const selectedIndices = [0, 1];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(132000);
    expect(saldoRequerido).toBe(0);
  });

  it('CLAVE: Item con entrega previa parcial — el acumulado incluye lo ya entregado', () => {
    // Pedido: 2 blusas × $64,000 = $128,000
    // Ya entregó 1 blusa antes. Ahora entrega la segunda.
    // El cliente debe haber pagado al menos $128,000 acumulado para llevarse todo.
    const totalPedido = 128000;
    const totalAbonado = 64000; // solo pagó la primera
    const items = [
      itemListo({ cantidad: 2, cantidadEntregada: 1, precio: 64000 }),
    ];
    const selectedIndices = [0];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(64000);        // solo 1 pendiente × $64K
    expect(valorYaEntregado).toBe(64000);       // 1 ya entregada × $64K
    expect(valorAcumuladoConHoy).toBe(128000);  // total del pedido
    expect(saldoRequerido).toBe(64000);         // debe pagar $64K más
  });

  it('Item parcial con entrega previa — calcula correctamente', () => {
    // Pedido: 6 camisas × $30,000 = $180,000
    // Ya entregó 2. Ahora tiene 3 listas (Parcialmente Listo).
    const totalPedido = 180000;
    const totalAbonado = 90000; // pagó $90K
    const items = [
      itemParcial({ cantidad: 6, cantidadEntregada: 2, cantidadLista: 3, precio: 30000 }),
    ];
    const selectedIndices = [0];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(90000);         // 3 listas × $30K
    expect(valorYaEntregado).toBe(60000);       // 2 ya entregadas × $30K
    expect(valorAcumuladoConHoy).toBe(150000);  // 60K + 90K
    expect(saldoRequerido).toBe(60000);         // 150K - 90K abonado
  });

  it('Múltiples items mixtos con entregas previas', () => {
    // Item A: 3 × $50K = $150K (1 ya entregada, 2 pendientes, Listo)
    // Item B: 2 × $30K = $60K (0 entregadas, Listo)
    // Total pedido: $210K, abonado: $100K
    const totalPedido = 210000;
    const totalAbonado = 100000;
    const items = [
      itemListo({ cantidad: 3, cantidadEntregada: 1, precio: 50000 }),   // A
      itemListo({ cantidad: 2, cantidadEntregada: 0, precio: 30000 }),   // B
    ];
    const selectedIndices = [0, 1];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(valorDeEntrega).toBe(160000);        // (2×50K) + (2×30K)
    expect(valorYaEntregado).toBe(50000);       // 1×50K del item A
    expect(valorAcumuladoConHoy).toBe(210000);  // 50K + 160K = 210K = total
    expect(saldoRequerido).toBe(110000);        // 210K - 100K
  });
});

// ─────────────────────────────────────────────────────────────
// calcularUpdatedItems
// ─────────────────────────────────────────────────────────────

describe('calcularUpdatedItems', () => {
  it('marca como Entregado un ítem Listo para Entrega', () => {
    const items = [itemListo({ cantidad: 1 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('Entregado');
    expect(result[0].cantidadEntregada).toBe(1);
    expect(result[0].cantidadLista).toBe(0);
  });

  it('no modifica ítems no seleccionados', () => {
    const items = [itemListo(), itemListo({ precio: 80000 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[1]).toEqual(items[1]);
  });

  it('ítem parcial: todas las unidades listas → Entregado', () => {
    const items = [itemParcial({ cantidad: 2, cantidadEntregada: 0, cantidadLista: 2 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('Entregado');
    expect(result[0].cantidadEntregada).toBe(2);
    expect(result[0].cantidadLista).toBe(0);
  });

  it('ítem parcial: quedan unidades pendientes → En Producción', () => {
    const items = [itemParcial({ cantidad: 4, cantidadEntregada: 0, cantidadLista: 2 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('En Producción');
    expect(result[0].cantidadEntregada).toBe(2);
    expect(result[0].cantidadLista).toBe(0);
  });

  it('ítem parcial: segunda entrega completa → Entregado', () => {
    const items = [itemParcial({ cantidad: 4, cantidadEntregada: 2, cantidadLista: 2 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('Entregado');
    expect(result[0].cantidadEntregada).toBe(4);
  });

  it('ítem Listo con entregas previas → cantidadEntregada = cantidad total', () => {
    // Un item que ya tuvo entregas parciales, ahora está Listo para Entrega
    const items = [itemListo({ cantidad: 3, cantidadEntregada: 1 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('Entregado');
    expect(result[0].cantidadEntregada).toBe(3); // cantidad total, no suma
  });
});

// ─────────────────────────────────────────────────────────────
// calcularEstadoGeneral
// ─────────────────────────────────────────────────────────────

describe('calcularEstadoGeneral', () => {
  it('retorna Entregado cuando todos los ítems activos están entregados', () => {
    const items = [
      itemEntregado(),
      itemEntregado(),
    ];
    expect(calcularEstadoGeneral(items, 'En Proceso')).toBe('Entregado');
  });

  it('ignora ítems anulados para determinar Entregado', () => {
    const items = [
      itemEntregado(),
      { ...itemListo(), anulado: true },
    ];
    expect(calcularEstadoGeneral(items, 'En Proceso')).toBe('Entregado');
  });

  it('ignora ítems Cambio de Talla para determinar Entregado', () => {
    const items = [
      itemEntregado(),
      { ...itemListo(), estadoItem: 'Cambio de Talla' },
    ];
    expect(calcularEstadoGeneral(items, 'En Proceso')).toBe('Entregado');
  });

  it('retorna En Proceso cuando hay ítems con cantidad sin completar', () => {
    const items = [
      itemEntregado(),
      itemListo({ cantidadLista: 0, cantidadEntregada: 0, cantidad: 1 }),
    ];
    expect(calcularEstadoGeneral(items, 'Pedido Recibido')).toBe('En Proceso');
  });

  it('retorna Pedido Completo cuando todos tienen cantidadLista + cantidadEntregada = cantidad', () => {
    const items = [
      itemEntregado({ cantidad: 1, cantidadEntregada: 1, cantidadLista: 0 }),
      { ...itemListo(), cantidad: 1, cantidadEntregada: 0, cantidadLista: 1 },
    ];
    expect(calcularEstadoGeneral(items, 'En Proceso'))
      .toBe('Pedido Completo - Listo para Recoger');
  });

  it('mantiene el estado actual si no hay cambios determinables', () => {
    const items = [{ estadoItem: 'En Producción', anulado: false, cantidad: 5, cantidadLista: 2, cantidadEntregada: 0 }];
    expect(calcularEstadoGeneral(items, 'En Proceso')).toBe('En Proceso');
  });
});
