import { describe, it, expect } from 'vitest';
import {
  calcularTotalAbonado,
  recalcularTotalApartado,
  calcularEstadoTrasAbono,
  estaVencido,
  calcularDiasRestantes
} from './apartadosLogic';

// ─────────────────────────────────────────────────────────────
// calcularTotalAbonado
// ─────────────────────────────────────────────────────────────
describe('calcularTotalAbonado', () => {
  it('suma los montos', () => {
    expect(calcularTotalAbonado([{ monto: 100 }, { monto: 50 }, { monto: 25 }])).toBe(175);
  });
  it('lista vacía → 0', () => {
    expect(calcularTotalAbonado([])).toBe(0);
  });
  it('sin argumento → 0', () => {
    expect(calcularTotalAbonado()).toBe(0);
  });
  it('ignora montos undefined', () => {
    expect(calcularTotalAbonado([{ monto: 100 }, {}, { monto: 30 }])).toBe(130);
  });
});

// ─────────────────────────────────────────────────────────────
// recalcularTotalApartado
// ─────────────────────────────────────────────────────────────
describe('recalcularTotalApartado', () => {
  it('suma subtotales de items activos', () => {
    expect(recalcularTotalApartado([{ subtotal: 100 }, { subtotal: 200 }])).toBe(300);
  });
  it('excluye items anulados', () => {
    expect(recalcularTotalApartado([
      { subtotal: 100 },
      { subtotal: 200, anulado: true },
      { subtotal: 50 }
    ])).toBe(150);
  });
  it('lista vacía → 0', () => {
    expect(recalcularTotalApartado([])).toBe(0);
  });
  it('subtotales undefined cuentan como 0', () => {
    expect(recalcularTotalApartado([{ subtotal: 100 }, {}])).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularEstadoTrasAbono  (incluye el fix de "Vencido no se rebaja")
// ─────────────────────────────────────────────────────────────
describe('calcularEstadoTrasAbono', () => {
  it('saldo a 0 → Completado', () => {
    const r = calcularEstadoTrasAbono({ estadoActual: 'Activo', totalApartado: 100, totalAbonado: 100 });
    expect(r.completado).toBe(true);
    expect(r.estadoGeneral).toBe('Completado');
    expect(r.saldoPendiente).toBe(0);
  });

  it('sobrepago (saldo negativo) → Completado', () => {
    const r = calcularEstadoTrasAbono({ estadoActual: 'Activo', totalApartado: 100, totalAbonado: 120 });
    expect(r.completado).toBe(true);
    expect(r.estadoGeneral).toBe('Completado');
  });

  it('abono parcial sobre Activo → sigue Activo', () => {
    const r = calcularEstadoTrasAbono({ estadoActual: 'Activo', totalApartado: 100, totalAbonado: 40 });
    expect(r.estadoGeneral).toBe('Activo');
    expect(r.saldoPendiente).toBe(60);
  });

  it('REGRESIÓN: abono parcial sobre Vencido → sigue Vencido (no se rebaja a Activo)', () => {
    const r = calcularEstadoTrasAbono({ estadoActual: 'Vencido', totalApartado: 100, totalAbonado: 40 });
    expect(r.estadoGeneral).toBe('Vencido');
    expect(r.completado).toBe(false);
  });

  it('apartado Vencido que se paga completo → Completado (gana sobre Vencido)', () => {
    const r = calcularEstadoTrasAbono({ estadoActual: 'Vencido', totalApartado: 100, totalAbonado: 100 });
    expect(r.estadoGeneral).toBe('Completado');
  });
});

// ─────────────────────────────────────────────────────────────
// estaVencido
// ─────────────────────────────────────────────────────────────
describe('estaVencido', () => {
  const hoy = new Date(2026, 5, 7); // 7 jun 2026

  it('fecha límite ayer → vencido', () => {
    expect(estaVencido(new Date(2026, 5, 6), hoy)).toBe(true);
  });
  it('fecha límite hoy → NO vencido (exclusivo, vence al día siguiente)', () => {
    expect(estaVencido(new Date(2026, 5, 7), hoy)).toBe(false);
  });
  it('fecha límite mañana → NO vencido', () => {
    expect(estaVencido(new Date(2026, 5, 8), hoy)).toBe(false);
  });
  it('sin fecha límite → false', () => {
    expect(estaVencido(null, hoy)).toBe(false);
  });
  it('ignora la hora del día (compara a medianoche)', () => {
    // límite hoy a las 23:00, hoy a las 01:00 → mismo día → no vencido
    expect(estaVencido(new Date(2026, 5, 7, 23, 0), new Date(2026, 5, 7, 1, 0))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularDiasRestantes
// ─────────────────────────────────────────────────────────────
describe('calcularDiasRestantes', () => {
  it('faltan 5 días', () => {
    expect(calcularDiasRestantes(new Date(2026, 5, 12), new Date(2026, 5, 7))).toBe(5);
  });
  it('ya pasó (negativo)', () => {
    expect(calcularDiasRestantes(new Date(2026, 5, 4), new Date(2026, 5, 7))).toBe(-3);
  });
  it('sin fecha límite → null', () => {
    expect(calcularDiasRestantes(null, new Date(2026, 5, 7))).toBe(null);
  });
});
