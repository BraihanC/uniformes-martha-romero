/**
 * reporteVentasLogic.js
 * Lógica pura del Reporte de Ventas: orden de tallas, totales y agrupación.
 * Sin Firebase, sin React. Recibe el array de ventas ya normalizado (cada venta
 * trae cantidad, subtotal, montoRecibido, costoTotal, utilidad, talla, etc.).
 * 100% testable con: npm test
 */

export const CLIENTE_GENERAL_KEY = '__general__';

// ─────────────────────────────────────────────────────────────
// ORDEN DE TALLAS
// ─────────────────────────────────────────────────────────────

export const TALLA_ORDEN = [
  '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20',
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
];

/**
 * Comparador para ordenar tallas según TALLA_ORDEN. Las tallas desconocidas
 * van al final, ordenadas alfabéticamente entre ellas.
 */
export const sortTallas = (a, b) => {
  const ia = TALLA_ORDEN.indexOf(a);
  const ib = TALLA_ORDEN.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
};

// ─────────────────────────────────────────────────────────────
// TOTALES
// ─────────────────────────────────────────────────────────────

/**
 * Suma los totales de un conjunto de ventas.
 * @returns {{cantidadTotal, ventasTotal, montoRecibidoTotal, costoTotal,
 *            utilidadTotal, margenPromedio, totalRegistros}}
 */
export const calcularTotalesVentas = (ventas = []) => {
  const t = {
    cantidadTotal: 0,
    ventasTotal: 0,
    montoRecibidoTotal: 0,
    costoTotal: 0,
    utilidadTotal: 0,
    margenPromedio: 0,
    totalRegistros: ventas.length
  };
  ventas.forEach(v => {
    t.cantidadTotal += v.cantidad || 0;
    t.ventasTotal += v.subtotal || 0;
    t.montoRecibidoTotal += v.montoRecibido || 0;
    t.costoTotal += v.costoTotal || 0;
    t.utilidadTotal += v.utilidad || 0;
  });
  t.margenPromedio = t.ventasTotal > 0
    ? (t.utilidadTotal / t.ventasTotal) * 100
    : 0;
  return t;
};

// ─────────────────────────────────────────────────────────────
// AGRUPACIÓN
// ─────────────────────────────────────────────────────────────

/**
 * Agrupa las ventas según la dimensión pedida.
 * - 'ninguna'  → devuelve las ventas tal cual (detalle).
 * - 'matrizProductoTalla' → un objeto por producto con desglose `tallas{}`.
 * - 'producto'|'cliente'|'colegio'|'talla'|'fecha'|'metodoPago' → totales por grupo.
 *
 * Cada grupo (salvo 'ninguna') incluye `margen` calculado.
 */
export const agruparVentas = (ventas = [], agrupacion) => {
  if (agrupacion === 'ninguna') return ventas;

  if (agrupacion === 'matrizProductoTalla') {
    const grupos = {};
    ventas.forEach(v => {
      const clave = v.productoId || v.referencia || 'Sin ref';
      const t = v.talla || 'Sin talla';
      if (!grupos[clave]) {
        grupos[clave] = {
          clave,
          nombre: v.productoNombre || v.referencia || 'Sin nombre',
          referencia: v.referencia || '',
          tallas: {},
          totalCantidad: 0,
          totalVentas: 0,
          montoRecibido: 0,
          costoTotal: 0,
          utilidad: 0
        };
      }
      grupos[clave].tallas[t] = (grupos[clave].tallas[t] || 0) + (v.cantidad || 0);
      grupos[clave].totalCantidad += v.cantidad || 0;
      grupos[clave].totalVentas += v.subtotal || 0;
      grupos[clave].montoRecibido += v.montoRecibido || 0;
      grupos[clave].costoTotal += v.costoTotal || 0;
      grupos[clave].utilidad += v.utilidad || 0;
    });
    return Object.values(grupos).map(g => ({
      ...g,
      margen: g.totalVentas > 0 ? (g.utilidad / g.totalVentas) * 100 : 0
    }));
  }

  const grupos = {};
  ventas.forEach(v => {
    let clave = '';
    let nombre = '';

    switch (agrupacion) {
      case 'producto':
        clave = v.productoId || v.referencia || 'Sin ref';
        nombre = v.referencia ? `${v.referencia} - ${v.productoNombre}` : v.productoNombre;
        break;
      case 'cliente':
        clave = v.clienteId || CLIENTE_GENERAL_KEY;
        nombre = v.clienteId ? v.clienteNombre : 'Cliente General';
        break;
      case 'colegio':
        clave = v.colegioId || v.colegioCodigo || v.colegioNombre || 'Sin colegio';
        nombre = v.colegioNombre || v.colegioCodigo || 'Sin colegio';
        break;
      case 'talla':
        clave = v.talla || 'Sin talla';
        nombre = v.talla || 'Sin talla';
        break;
      case 'fecha': {
        const d = v.fecha;
        clave = d.toISOString().split('T')[0];
        nombre = d.toLocaleDateString('es-CO');
        break;
      }
      case 'metodoPago':
        clave = v.metodoPago;
        nombre = v.metodoPago;
        break;
      default:
        clave = 'General';
        nombre = 'General';
    }

    if (!grupos[clave]) {
      grupos[clave] = {
        clave,
        nombre,
        cantidad: 0,
        totalVentas: 0,
        montoRecibido: 0,
        costoTotal: 0,
        utilidad: 0
      };
    }

    grupos[clave].cantidad += v.cantidad || 0;
    grupos[clave].totalVentas += v.subtotal || 0;
    grupos[clave].montoRecibido += v.montoRecibido || 0;
    grupos[clave].costoTotal += v.costoTotal || 0;
    grupos[clave].utilidad += v.utilidad || 0;
  });

  return Object.values(grupos).map(g => ({
    ...g,
    margen: g.totalVentas > 0 ? (g.utilidad / g.totalVentas) * 100 : 0
  }));
};
