import { describe, it, expect } from 'vitest';
import {
  sortTallas,
  calcularTotalesVentas,
  agruparVentas,
  CLIENTE_GENERAL_KEY
} from './reporteVentasLogic';

// ─────────────────────────────────────────────────────────────
// sortTallas
// ─────────────────────────────────────────────────────────────
describe('sortTallas', () => {
  it('ordena tallas numéricas', () => {
    expect(['14', '8', '12', '6'].sort(sortTallas)).toEqual(['6', '8', '12', '14']);
  });
  it('ordena tallas alfabéticas en el orden correcto', () => {
    expect(['XL', 'S', 'M', 'XS'].sort(sortTallas)).toEqual(['XS', 'S', 'M', 'XL']);
  });
  it('numéricas antes que alfabéticas', () => {
    expect(['M', '12', 'S', '6'].sort(sortTallas)).toEqual(['6', '12', 'S', 'M']);
  });
  it('tallas desconocidas van al final', () => {
    expect(['ZZ', '12', 'M'].sort(sortTallas)).toEqual(['12', 'M', 'ZZ']);
  });
});

// ─────────────────────────────────────────────────────────────
// calcularTotalesVentas
// ─────────────────────────────────────────────────────────────
describe('calcularTotalesVentas', () => {
  const ventas = [
    { cantidad: 2, subtotal: 100, montoRecibido: 100, costoTotal: 60, utilidad: 40 },
    { cantidad: 3, subtotal: 150, montoRecibido: 75, costoTotal: 90, utilidad: 60 }
  ];

  it('suma cantidades y montos', () => {
    const t = calcularTotalesVentas(ventas);
    expect(t.cantidadTotal).toBe(5);
    expect(t.ventasTotal).toBe(250);
    expect(t.montoRecibidoTotal).toBe(175);
    expect(t.costoTotal).toBe(150);
    expect(t.utilidadTotal).toBe(100);
    expect(t.totalRegistros).toBe(2);
  });

  it('margen promedio = utilidad/ventas * 100', () => {
    const t = calcularTotalesVentas(ventas);
    expect(t.margenPromedio).toBeCloseTo(40); // 100/250*100
  });

  it('sin ventas → todo 0 y margen 0 (sin división por cero)', () => {
    const t = calcularTotalesVentas([]);
    expect(t.cantidadTotal).toBe(0);
    expect(t.margenPromedio).toBe(0);
    expect(t.totalRegistros).toBe(0);
  });

  it('campos undefined cuentan como 0', () => {
    const t = calcularTotalesVentas([{ cantidad: 1 }]);
    expect(t.cantidadTotal).toBe(1);
    expect(t.ventasTotal).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// agruparVentas
// ─────────────────────────────────────────────────────────────
describe('agruparVentas', () => {
  const ventas = [
    { productoId: 'p1', referencia: 'MA01', productoNombre: 'Camibuso MA', talla: '12',
      cantidad: 5, subtotal: 500, montoRecibido: 500, costoTotal: 300, utilidad: 200,
      colegioCodigo: 'MA', colegioNombre: 'Manuel Aya', clienteId: 'c1', clienteNombre: 'Ana', metodoPago: 'Efectivo' },
    { productoId: 'p1', referencia: 'MA01', productoNombre: 'Camibuso MA', talla: '14',
      cantidad: 3, subtotal: 300, montoRecibido: 300, costoTotal: 180, utilidad: 120,
      colegioCodigo: 'MA', colegioNombre: 'Manuel Aya', clienteId: 'c1', clienteNombre: 'Ana', metodoPago: 'Nequi' },
    { productoId: 'p2', referencia: 'GD02', productoNombre: 'Chaqueta GD', talla: 'M',
      cantidad: 2, subtotal: 400, montoRecibido: 200, costoTotal: 250, utilidad: 150,
      colegioCodigo: 'GD', colegioNombre: 'Gardner', clienteId: null, clienteNombre: '', metodoPago: 'Efectivo' }
  ];

  it("'ninguna' devuelve las ventas tal cual", () => {
    expect(agruparVentas(ventas, 'ninguna')).toBe(ventas);
  });

  it("agrupa por producto y suma cantidades", () => {
    const r = agruparVentas(ventas, 'producto');
    const camibuso = r.find(g => g.clave === 'p1');
    expect(camibuso.cantidad).toBe(8); // 5 + 3
    expect(camibuso.totalVentas).toBe(800);
    expect(r).toHaveLength(2);
  });

  it("agrupa por colegio", () => {
    const r = agruparVentas(ventas, 'colegio');
    const ma = r.find(g => g.nombre === 'Manuel Aya');
    expect(ma.cantidad).toBe(8);
    const gd = r.find(g => g.nombre === 'Gardner');
    expect(gd.cantidad).toBe(2);
  });

  it("agrupa por talla", () => {
    const r = agruparVentas(ventas, 'talla');
    expect(r.find(g => g.clave === '12').cantidad).toBe(5);
    expect(r.find(g => g.clave === '14').cantidad).toBe(3);
    expect(r.find(g => g.clave === 'M').cantidad).toBe(2);
  });

  it("cliente sin id cae en Cliente General", () => {
    const r = agruparVentas(ventas, 'cliente');
    const general = r.find(g => g.clave === CLIENTE_GENERAL_KEY);
    expect(general).toBeDefined();
    expect(general.nombre).toBe('Cliente General');
    expect(general.cantidad).toBe(2);
  });

  it("agrupa por método de pago", () => {
    const r = agruparVentas(ventas, 'metodoPago');
    expect(r.find(g => g.clave === 'Efectivo').cantidad).toBe(7); // 5 + 2
    expect(r.find(g => g.clave === 'Nequi').cantidad).toBe(3);
  });

  it("calcula margen en cada grupo", () => {
    const r = agruparVentas(ventas, 'producto');
    const camibuso = r.find(g => g.clave === 'p1');
    // utilidad 320 / ventas 800 * 100 = 40
    expect(camibuso.margen).toBeCloseTo(40);
  });

  describe('matriz Producto × Talla', () => {
    it('desglosa cantidades por talla dentro de cada producto', () => {
      const r = agruparVentas(ventas, 'matrizProductoTalla');
      const camibuso = r.find(g => g.clave === 'p1');
      expect(camibuso.tallas['12']).toBe(5);
      expect(camibuso.tallas['14']).toBe(3);
      expect(camibuso.totalCantidad).toBe(8);
      const chaqueta = r.find(g => g.clave === 'p2');
      expect(chaqueta.tallas['M']).toBe(2);
    });

    it('agrupa la misma talla repetida del mismo producto', () => {
      const dup = [
        { productoId: 'p1', talla: '12', cantidad: 2, subtotal: 0, montoRecibido: 0, costoTotal: 0, utilidad: 0 },
        { productoId: 'p1', talla: '12', cantidad: 3, subtotal: 0, montoRecibido: 0, costoTotal: 0, utilidad: 0 }
      ];
      const r = agruparVentas(dup, 'matrizProductoTalla');
      expect(r[0].tallas['12']).toBe(5);
    });
  });
});
