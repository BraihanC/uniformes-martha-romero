import { describe, it, expect } from 'vitest';
import {
  calcularSubtotal,
  calcularDescuentoItem,
  calcularDescuentoTotalItems,
  calcularDescuentoGeneral,
  calcularIVA,
  calcularTotal,
  calcularCambio,
  calcularResumenVenta
} from './posLogic';

const item = (precio, cantidad, descuento = 0, tipoDescuento = '%') => ({
  product: { precio }, cantidad, descuento, tipoDescuento
});

// ─────────────────────────────────────────────────────────────
// calcularSubtotal
// ─────────────────────────────────────────────────────────────
describe('calcularSubtotal', () => {
  it('suma precio × cantidad', () => {
    expect(calcularSubtotal([item(1000, 2), item(500, 3)])).toBe(3500);
  });
  it('carrito vacío → 0', () => {
    expect(calcularSubtotal([])).toBe(0);
  });
  it('tolera precio/cantidad faltantes', () => {
    expect(calcularSubtotal([{ product: {}, cantidad: 2 }])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularDescuentoItem
// ─────────────────────────────────────────────────────────────
describe('calcularDescuentoItem', () => {
  it('descuento porcentual', () => {
    expect(calcularDescuentoItem(item(1000, 2, 10, '%'))).toBe(200); // 10% de 2000
  });
  it('descuento fijo en $', () => {
    expect(calcularDescuentoItem(item(1000, 2, 300, '$'))).toBe(300);
  });
  it('descuento fijo no excede el total del item', () => {
    expect(calcularDescuentoItem(item(1000, 1, 5000, '$'))).toBe(1000);
  });
  it('sin descuento → 0', () => {
    expect(calcularDescuentoItem(item(1000, 2))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularDescuentoTotalItems
// ─────────────────────────────────────────────────────────────
describe('calcularDescuentoTotalItems', () => {
  it('suma descuentos de varios items', () => {
    const items = [item(1000, 2, 10, '%'), item(500, 2, 100, '$')];
    expect(calcularDescuentoTotalItems(items)).toBe(300); // 200 + 100
  });
  it('vacío → 0', () => {
    expect(calcularDescuentoTotalItems([])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularDescuentoGeneral
// ─────────────────────────────────────────────────────────────
describe('calcularDescuentoGeneral', () => {
  it('porcentual sobre subtotal', () => {
    expect(calcularDescuentoGeneral(10000, 15, '%')).toBe(1500);
  });
  it('fijo en $', () => {
    expect(calcularDescuentoGeneral(10000, 2000, '$')).toBe(2000);
  });
  it('fijo no excede el subtotal', () => {
    expect(calcularDescuentoGeneral(5000, 9000, '$')).toBe(5000);
  });
  it('sin descuento → 0', () => {
    expect(calcularDescuentoGeneral(10000, 0, '%')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularIVA
// ─────────────────────────────────────────────────────────────
describe('calcularIVA', () => {
  it('no aplica → 0', () => {
    expect(calcularIVA({ subtotal: 10000, descuentoItems: 0, descuentoGeneral: 0, aplicarIVA: false })).toBe(0);
  });
  it('19% sobre subtotal tras descuentos', () => {
    // base = 10000 - 1000 - 1000 = 8000; 19% = 1520
    expect(calcularIVA({ subtotal: 10000, descuentoItems: 1000, descuentoGeneral: 1000, aplicarIVA: true, ivaRate: 19 })).toBe(1520);
  });
  it('respeta ivaRate personalizado', () => {
    expect(calcularIVA({ subtotal: 1000, descuentoItems: 0, descuentoGeneral: 0, aplicarIVA: true, ivaRate: 5 })).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularTotal
// ─────────────────────────────────────────────────────────────
describe('calcularTotal', () => {
  it('subtotal − descuentos + iva', () => {
    expect(calcularTotal({ subtotal: 10000, descuentoItems: 1000, descuentoGeneral: 500, iva: 1615 })).toBe(10115);
  });
  it('sin descuentos ni iva = subtotal', () => {
    expect(calcularTotal({ subtotal: 10000, descuentoItems: 0, descuentoGeneral: 0, iva: 0 })).toBe(10000);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularCambio
// ─────────────────────────────────────────────────────────────
describe('calcularCambio', () => {
  it('pago mayor al total → cambio positivo', () => {
    expect(calcularCambio(8000, 10000)).toBe(2000);
  });
  it('pago exacto → 0', () => {
    expect(calcularCambio(8000, 8000)).toBe(0);
  });
  it('pago menor al total → 0 (nunca negativo)', () => {
    expect(calcularCambio(8000, 5000)).toBe(0);
  });
  it('monto undefined → 0', () => {
    expect(calcularCambio(8000)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularResumenVenta (integración de todo el cálculo)
// ─────────────────────────────────────────────────────────────
describe('calcularResumenVenta', () => {
  it('venta simple sin descuentos ni IVA', () => {
    const r = calcularResumenVenta({ cartItems: [item(1000, 2), item(500, 1)] });
    expect(r.subtotal).toBe(2500);
    expect(r.descuentoItems).toBe(0);
    expect(r.descuentoGeneral).toBe(0);
    expect(r.iva).toBe(0);
    expect(r.total).toBe(2500);
  });

  it('con descuento por item, descuento general % e IVA', () => {
    const r = calcularResumenVenta({
      cartItems: [item(10000, 1, 10, '%')], // descuento item: 1000
      descuentoGeneral: 10,
      tipoDescuentoGeneral: '%',
      aplicarIVA: true,
      ivaRate: 19
    });
    expect(r.subtotal).toBe(10000);
    expect(r.descuentoItems).toBe(1000);
    expect(r.descuentoGeneral).toBe(1000); // 10% de 10000
    // base IVA = 10000 - 1000 - 1000 = 8000 → 1520
    expect(r.iva).toBe(1520);
    expect(r.total).toBe(9520); // 10000 - 1000 - 1000 + 1520
  });

  it('descuento general $ que no excede subtotal', () => {
    const r = calcularResumenVenta({
      cartItems: [item(1000, 1)],
      descuentoGeneral: 5000,
      tipoDescuentoGeneral: '$'
    });
    expect(r.descuentoGeneral).toBe(1000); // capeado al subtotal
    expect(r.total).toBe(0);
  });
});
