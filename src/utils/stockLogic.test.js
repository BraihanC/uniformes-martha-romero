import { describe, it, expect } from 'vitest';
import {
  calcularDisponible,
  haySuficiente,
  calcularEstadoItemPOS
} from './stockLogic';

// ─────────────────────────────────────────────────────────────
// calcularDisponible
// ─────────────────────────────────────────────────────────────
describe('calcularDisponible', () => {
  it('sin reservas: disponible = stockTotal', () => {
    expect(calcularDisponible({ stockTotal: 50 })).toBe(50);
  });

  it('resta las tres reservas', () => {
    expect(calcularDisponible({
      stockTotal: 100,
      stockReservadoPedidos: 10,
      stockReservadoApartados: 20,
      stockReservadoB2B: 30
    })).toBe(40);
  });

  it('nunca devuelve negativo (piso en 0)', () => {
    expect(calcularDisponible({
      stockTotal: 10,
      stockReservadoPedidos: 8,
      stockReservadoApartados: 5,
      stockReservadoB2B: 0
    })).toBe(0); // 10 - 13 = -3 → 0
  });

  it('producto sin campos → 0', () => {
    expect(calcularDisponible({})).toBe(0);
  });

  it('sin argumento → 0 (default)', () => {
    expect(calcularDisponible()).toBe(0);
  });

  it('campos undefined se tratan como 0', () => {
    expect(calcularDisponible({ stockTotal: 30, stockReservadoB2B: 5 })).toBe(25);
  });

  it('exactamente todo reservado → 0', () => {
    expect(calcularDisponible({
      stockTotal: 40,
      stockReservadoPedidos: 40
    })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// haySuficiente
// ─────────────────────────────────────────────────────────────
describe('haySuficiente', () => {
  it('hay de sobra', () => {
    expect(haySuficiente({ stockTotal: 50 }, 10)).toBe(true);
  });

  it('justo la cantidad disponible', () => {
    expect(haySuficiente({ stockTotal: 10 }, 10)).toBe(true);
  });

  it('uno más de lo disponible → false', () => {
    expect(haySuficiente({ stockTotal: 10 }, 11)).toBe(false);
  });

  it('considera reservas al decidir', () => {
    // disponible = 10 - 7 = 3
    expect(haySuficiente({ stockTotal: 10, stockReservadoApartados: 7 }, 4)).toBe(false);
    expect(haySuficiente({ stockTotal: 10, stockReservadoApartados: 7 }, 3)).toBe(true);
  });

  it('cantidad undefined se trata como 0 → siempre suficiente', () => {
    expect(haySuficiente({ stockTotal: 0 })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularEstadoItemPOS
// ─────────────────────────────────────────────────────────────
describe('calcularEstadoItemPOS', () => {
  it('todo entregado → Entregado', () => {
    expect(calcularEstadoItemPOS({ cantidad: 10, cantidadEntregada: 10 })).toBe('Entregado');
  });

  it('lista + entregada cubren el total → Listo para Entrega', () => {
    expect(calcularEstadoItemPOS({ cantidad: 10, cantidadLista: 6, cantidadEntregada: 4 })).toBe('Listo para Entrega');
  });

  it('todo alistado, nada entregado → Listo para Entrega', () => {
    expect(calcularEstadoItemPOS({ cantidad: 10, cantidadLista: 10 })).toBe('Listo para Entrega');
  });

  it('parte alistada → Parcialmente Listo', () => {
    expect(calcularEstadoItemPOS({ cantidad: 10, cantidadLista: 4 })).toBe('Parcialmente Listo');
  });

  it('nada alistado ni entregado → En Producción', () => {
    expect(calcularEstadoItemPOS({ cantidad: 10 })).toBe('En Producción');
  });

  it('item nuevo (solo cantidad) → En Producción', () => {
    expect(calcularEstadoItemPOS({ cantidad: 5, cantidadLista: 0, cantidadEntregada: 0 })).toBe('En Producción');
  });

  it('entrega parcial sin nada alistado nuevo → En Producción (replica comportamiento original)', () => {
    // cantidadEntregada=3 (≠10), lista=0 → no Entregado, no Listo (0+3≠10), lista no >0 → En Producción
    expect(calcularEstadoItemPOS({ cantidad: 10, cantidadLista: 0, cantidadEntregada: 3 })).toBe('En Producción');
  });

  it('prioridad: Entregado gana aunque lista sea 0', () => {
    expect(calcularEstadoItemPOS({ cantidad: 8, cantidadLista: 0, cantidadEntregada: 8 })).toBe('Entregado');
  });

  it('una sola unidad alistada → Parcialmente Listo', () => {
    expect(calcularEstadoItemPOS({ cantidad: 100, cantidadLista: 1 })).toBe('Parcialmente Listo');
  });
});
