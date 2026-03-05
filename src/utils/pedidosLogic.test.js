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
  it('usa subtotal para ítem Listo para Entrega', () => {
    const items = [itemListo({ subtotal: 92000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(92000);
  });

  it('calcula precio × cantidad si no hay subtotal', () => {
    const items = [itemListo({ subtotal: undefined, cantidad: 2, precio: 40000 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(80000);
  });

  it('usa precioUnitario como fallback si no hay precio', () => {
    const items = [itemListo({ precio: undefined, precioUnitario: 39000, subtotal: undefined, cantidad: 1 })];
    expect(calcularValorDeEntrega(items, [0])).toBe(39000);
  });

  it('retorna 0 si no hay precio, precioUnitario ni subtotal', () => {
    const items = [itemListo({ precio: undefined, precioUnitario: undefined, subtotal: undefined })];
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
      itemListo({ subtotal: 92000 }),   // índice 0
      itemListo({ subtotal: 40000 }),   // índice 1
    ];
    expect(calcularValorDeEntrega(items, [0, 1])).toBe(132000);
  });

  it('solo suma los ítems en selectedIndices', () => {
    const items = [
      itemListo({ subtotal: 92000 }),   // índice 0 — seleccionado
      itemListo({ subtotal: 40000 }),   // índice 1 — NO seleccionado
    ];
    expect(calcularValorDeEntrega(items, [0])).toBe(92000);
  });

  it('retorna 0 si la lista de índices está vacía', () => {
    const items = [itemListo({ subtotal: 50000 })];
    expect(calcularValorDeEntrega(items, [])).toBe(0);
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

  it('NO cuenta ítems que están en selectedIndices (se entregan hoy)', () => {
    const items = [itemEntregado({ cantidadEntregada: 1, precio: 70000 })];
    expect(calcularValorYaEntregado(items, [0])).toBe(0);
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
      itemEntregado({ cantidadEntregada: 1, precio: 70000 }),  // índice 0
      itemEntregado({ cantidadEntregada: 2, precio: 39000 }),  // índice 1
    ];
    // total = 70000 + 78000 = 148000
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
    // Caso de datos inconsistentes (precio almacenado como subtotal)
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
  it('Pedido $200K — abonó $100K — lleva hoy $140K → debe pagar $40K', () => {
    const totalPedido = 200000;
    const totalAbonado = 100000;
    const items = [
      itemListo({ subtotal: 80000, cantidadEntregada: 0 }),   // 0 — seleccionado hoy
      itemListo({ subtotal: 60000, cantidadEntregada: 0 }),   // 1 — seleccionado hoy
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
      itemEntregado({ subtotal: 80000, cantidadEntregada: 1, precio: 80000 }),  // 0 — ya entregado
      itemEntregado({ subtotal: 60000, cantidadEntregada: 1, precio: 60000 }),  // 1 — ya entregado
      itemListo({ subtotal: 60000, cantidadEntregada: 0, precio: 60000 }),      // 2 — seleccionado hoy
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
      itemListo({ precio: 89000, subtotal: 89000 }),             // 3 — seleccionado hoy
      itemListo({ precio: 80000, subtotal: 80000 }),             // 4 — seleccionado hoy
    ];
    const selectedIndices = [3, 4];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(saldoRequerido).toBe(0);
  });

  it('Datos inconsistentes: acumulado > total → se capea al total', () => {
    const totalPedido = 330000;
    const totalAbonado = 260000;
    // valorYaEntregado inflado por datos erróneos
    const valorYaEntregado     = 331000;   // > totalPedido por error de datos
    const valorDeEntrega       = 69000;
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    // Sin el cap daría $140K; con el cap da $70K (correcto)
    expect(valorAcumuladoConHoy).toBe(330000);
    expect(saldoRequerido).toBe(70000);
  });

  it('Pedido completamente pagado de antemano → no cobra nada al entregar', () => {
    const totalPedido = 132000;
    const totalAbonado = 132000;
    const items = [
      itemListo({ subtotal: 92000 }),
      itemListo({ subtotal: 40000 }),
    ];
    const selectedIndices = [0, 1];

    const valorDeEntrega       = calcularValorDeEntrega(items, selectedIndices);
    const valorYaEntregado     = calcularValorYaEntregado(items, selectedIndices);
    const valorAcumuladoConHoy = calcularValorAcumuladoConHoy(valorYaEntregado, valorDeEntrega, totalPedido);
    const saldoRequerido       = calcularSaldoRequerido(valorAcumuladoConHoy, totalAbonado);

    expect(saldoRequerido).toBe(0);
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
    const items = [itemListo(), itemListo({ subtotal: 80000 })];
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
    // cantidad total = 4, entregadas antes = 0, listas ahora = 2 → quedan 2
    const items = [itemParcial({ cantidad: 4, cantidadEntregada: 0, cantidadLista: 2 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('En Producción');
    expect(result[0].cantidadEntregada).toBe(2);
    expect(result[0].cantidadLista).toBe(0);
  });

  it('ítem parcial: segunda entrega completa → Entregado', () => {
    // primera vez: entregó 2 de 4; ahora entrega las 2 restantes
    const items = [itemParcial({ cantidad: 4, cantidadEntregada: 2, cantidadLista: 2 })];
    const result = calcularUpdatedItems(items, [0]);
    expect(result[0].estadoItem).toBe('Entregado');
    expect(result[0].cantidadEntregada).toBe(4);
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
    // ítem sin cantidades claras
    const items = [{ estadoItem: 'En Producción', anulado: false, cantidad: 5, cantidadLista: 2, cantidadEntregada: 0 }];
    expect(calcularEstadoGeneral(items, 'En Proceso')).toBe('En Proceso');
  });
});
