import { describe, it, expect } from 'vitest';
import {
  calcularValorDevuelto,
  calcularValorProductosNuevos,
  calcularDiferenciaCambio
} from './devolucionesLogic';

// ─────────────────────────────────────────────────────────────
// calcularValorDevuelto
// ─────────────────────────────────────────────────────────────
describe('calcularValorDevuelto', () => {
  const items = [
    { precioUnitario: 1000, cantidad: 3 },
    { precioUnitario: 500, cantidad: 2 },
    { precio: 2000, cantidad: 1 } // legacy: usa `precio`
  ];

  it('suma valor de los índices seleccionados usando cantidad devuelta', () => {
    // index 0: 2×1000, index 1: 1×500
    expect(calcularValorDevuelto(items, [0, 1], { 0: 2, 1: 1 })).toBe(2500);
  });

  it('si no se indica cantidad devuelta, usa la cantidad original del item', () => {
    // index 0 sin cantidad → 3×1000
    expect(calcularValorDevuelto(items, [0], {})).toBe(3000);
  });

  it('usa precio legacy cuando no hay precioUnitario', () => {
    expect(calcularValorDevuelto(items, [2], { 2: 1 })).toBe(2000);
  });

  it('ningún índice seleccionado → 0', () => {
    expect(calcularValorDevuelto(items, [], {})).toBe(0);
  });

  it('ignora índices que no existen', () => {
    expect(calcularValorDevuelto(items, [99], {})).toBe(0);
  });

  it('item sin precio → 0 (servicio/alteración sin precio)', () => {
    const conServicio = [{ cantidad: 1, nombre: 'Ajuste' }];
    expect(calcularValorDevuelto(conServicio, [0], {})).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularValorProductosNuevos
// ─────────────────────────────────────────────────────────────
describe('calcularValorProductosNuevos', () => {
  it('suma cantidad × precio', () => {
    expect(calcularValorProductosNuevos([
      { cantidad: 2, precio: 1500 },
      { cantidad: 1, precio: 3000 }
    ])).toBe(6000);
  });
  it('lista vacía → 0', () => {
    expect(calcularValorProductosNuevos([])).toBe(0);
  });
  it('tolera campos faltantes', () => {
    expect(calcularValorProductosNuevos([{ cantidad: 2 }, { precio: 1000 }])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularDiferenciaCambio
// ─────────────────────────────────────────────────────────────
describe('calcularDiferenciaCambio', () => {
  it('producto nuevo más caro → positivo (cliente paga)', () => {
    expect(calcularDiferenciaCambio(10000, 7000)).toBe(3000);
  });
  it('producto nuevo más barato → negativo (cliente recibe)', () => {
    expect(calcularDiferenciaCambio(5000, 8000)).toBe(-3000);
  });
  it('mismo valor → 0', () => {
    expect(calcularDiferenciaCambio(5000, 5000)).toBe(0);
  });
});
