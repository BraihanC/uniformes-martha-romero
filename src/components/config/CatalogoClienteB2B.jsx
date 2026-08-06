import { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import {
  collection, getDocs, query, where, doc, updateDoc,
  writeBatch, serverTimestamp
} from 'firebase/firestore';
import { X, Save, Loader2, Package, Tag, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  CODIGO_COMPARTIDAS,
  tieneListaCompartidas,
  clienteVeCompartida,
  resolverPrecioOficialB2B,
  calcularCambiosPreciosCorporativos,
  idPrecioCorporativo
} from '../../utils/pedidosB2BLogic';

/**
 * Catálogo B2B de un cliente corporativo: qué prendas COMPARTIDAS ve y a qué
 * precio compra cada prenda.
 *
 * Dos ejes independientes que antes vivían solo en el producto:
 *  - Visibilidad → `clientes_corporativos.productosCompartidos` (lista blanca de
 *    ids del colegio 'OT'). Sin lista el cliente ve todas (comportamiento
 *    histórico); al guardar aquí queda siempre definida.
 *  - Precio → `precios_corporativos` ({clienteId, productoId, precioEspecial}),
 *    que ya gana sobre `precioB2B` en el portal, en staff y en la revalidación
 *    del pedido. Sin precio especial se usa el precioB2B de lista o el precio
 *    regular, exactamente como hoy.
 */

// "PANTALON EN DIARIO TALLA 10" → "PANTALON EN DIARIO"; agrupa todas las tallas
// de una misma prenda para poder habilitarlas/preciarlas de una sola vez.
const nombreBase = (nombre = '') => nombre.replace(/\s+TALLA\s+.*$/i, '').trim() || nombre.trim();

const formatCurrency = (valor) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(valor || 0);

const agruparPorPrenda = (productos) => {
  const grupos = new Map();
  productos.forEach(p => {
    const base = nombreBase(p.nombre || '');
    if (!grupos.has(base)) grupos.set(base, []);
    grupos.get(base).push(p);
  });
  return [...grupos.entries()]
    .map(([base, items]) => ({ base, items: [...items].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')) }))
    .sort((a, b) => a.base.localeCompare(b.base));
};

const CatalogoClienteB2B = ({ cliente, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [compartidas, setCompartidas] = useState([]);
  const [exclusivas, setExclusivas] = useState([]);
  // { [productoId]: { docId, precioEspecial } } tal como está HOY en Firestore
  const [preciosOriginales, setPreciosOriginales] = useState({});
  // { [productoId]: string } lo que hay en los inputs ('' = sin precio especial)
  const [precios, setPrecios] = useState({});
  const [habilitadas, setHabilitadas] = useState(() => new Set());
  const [teniaLista, setTeniaLista] = useState(false);
  const [gruposAbiertos, setGruposAbiertos] = useState(() => new Set());
  const [descuentos, setDescuentos] = useState({});

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setError('');
        const productosRef = collection(db, 'products');

        const [colegioSnap, compartidasSnap, preciosSnap] = await Promise.all([
          getDocs(query(
            productosRef,
            where('colegio', '==', cliente.codigoColegio || ''),
            where('esB2B', '==', true)
          )),
          getDocs(query(
            productosRef,
            where('colegio', '==', CODIGO_COMPARTIDAS),
            where('esB2B', '==', true)
          )),
          getDocs(query(
            collection(db, 'precios_corporativos'),
            where('clienteId', '==', cliente.id)
          ))
        ]);

        const mapear = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const listaCompartidas = mapear(compartidasSnap);
        setExclusivas(mapear(colegioSnap));
        setCompartidas(listaCompartidas);

        const originales = {};
        const inputs = {};
        preciosSnap.forEach(d => {
          const data = d.data();
          originales[data.productoId] = { docId: d.id, precioEspecial: data.precioEspecial };
          inputs[data.productoId] = String(data.precioEspecial ?? '');
        });
        setPreciosOriginales(originales);
        setPrecios(inputs);

        // Sin lista definida el cliente ve todas: arrancamos con todo marcado
        // para que guardar sin tocar nada no le quite prendas que hoy ve.
        const yaTieneLista = tieneListaCompartidas(cliente);
        setTeniaLista(yaTieneLista);
        setHabilitadas(new Set(
          listaCompartidas.filter(p => clienteVeCompartida(cliente, p.id)).map(p => p.id)
        ));
      } catch (err) {
        console.error('Error al cargar el catálogo del cliente:', err);
        setError('No se pudo cargar el catálogo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [cliente]);

  const gruposCompartidas = useMemo(() => agruparPorPrenda(compartidas), [compartidas]);
  const gruposExclusivas = useMemo(() => agruparPorPrenda(exclusivas), [exclusivas]);

  const toggleGrupoAbierto = (base) => {
    setGruposAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(base)) next.delete(base); else next.add(base);
      return next;
    });
  };

  const toggleProducto = (productoId) => {
    setHabilitadas(prev => {
      const next = new Set(prev);
      if (next.has(productoId)) next.delete(productoId); else next.add(productoId);
      return next;
    });
  };

  const toggleGrupoCompleto = (items) => {
    const todosMarcados = items.every(p => habilitadas.has(p.id));
    setHabilitadas(prev => {
      const next = new Set(prev);
      items.forEach(p => { if (todosMarcados) next.delete(p.id); else next.add(p.id); });
      return next;
    });
  };

  // Descuento fijo en pesos sobre el precio de tienda, talla por talla: es como
  // se pactan los precios B2B aquí (England = precio − 3.000, bicicletero − 1.000).
  const aplicarDescuentoGrupo = (base, items) => {
    const descuento = Number(descuentos[base]);
    if (!Number.isFinite(descuento) || descuento <= 0) {
      setError('Escribe un descuento en pesos mayor a 0 antes de aplicarlo.');
      return;
    }
    setError('');
    setPrecios(prev => {
      const next = { ...prev };
      items.forEach(p => {
        const nuevo = Math.max(0, Number(p.precio || 0) - descuento);
        if (nuevo > 0) next[p.id] = String(nuevo);
      });
      return next;
    });
  };

  const limpiarPreciosGrupo = (items) => {
    setPrecios(prev => {
      const next = { ...prev };
      items.forEach(p => { delete next[p.id]; });
      return next;
    });
  };

  const handleGuardar = async () => {
    setError('');

    // Diff puro (con tests) de lo escrito vs lo guardado
    const todos = [...compartidas, ...exclusivas];
    const { aEscribir, aBorrar, errores } = calcularCambiosPreciosCorporativos(
      todos, precios, preciosOriginales
    );

    if (errores.length > 0) {
      setError(
        `Revisa estos precios antes de guardar:\n• ${errores.slice(0, 5).join('\n• ')}` +
        (errores.length > 5 ? `\n• …y ${errores.length - 5} más` : '') +
        '\n\nPara no venderle una prenda, desmárcala del catálogo en vez de ponerle 0.'
      );
      return;
    }

    // Confirmación con los montos formateados: es la última oportunidad de ver
    // un "$64" donde se querían $64.000 antes de escribir en Firestore.
    const sospechosos = aEscribir.filter(c => c.sospechoso);
    const quitadas = tieneListaCompartidas(cliente)
      ? compartidas.filter(p => clienteVeCompartida(cliente, p.id) && !habilitadas.has(p.id)).length
      : 0;

    let resumen =
      `Guardar el catálogo de ${cliente.nombre}:\n\n` +
      `• Prendas compartidas habilitadas: ${habilitadas.size} de ${compartidas.length}` +
      (quitadas > 0 ? ` (se le quitan ${quitadas})` : '') + '\n' +
      `• Precios propios nuevos o modificados: ${aEscribir.length}\n` +
      `• Precios propios que se eliminan (vuelven al precio de lista): ${aBorrar.length}`;

    if (aEscribir.length > 0) {
      resumen += '\n\nPrecios que quedarán:\n' +
        aEscribir.slice(0, 12).map(c =>
          `• ${c.nombre}: ${formatCurrency(c.precioEspecial)}${c.sospechoso ? '  ⚠️' : ''}`
        ).join('\n') +
        (aEscribir.length > 12 ? `\n• …y ${aEscribir.length - 12} más` : '');
    }

    if (sospechosos.length > 0) {
      resumen += `\n\n⚠️ ATENCIÓN: ${sospechosos.length} precio(s) marcados arriba quedan muy por ` +
        `debajo del precio de tienda. Si escribiste "64.000" el sistema lo leyó como $64 ` +
        `(los puntos de mil no se admiten). Verifica antes de continuar.`;
    }

    if (!window.confirm(resumen + '\n\n¿Continuar?')) return;

    setGuardando(true);
    let escrituraLanzada = false;
    try {
      // Firestore permite 500 escrituras por batch — chunkeamos como en Inventory.
      const LIMITE = 450;
      let batch = writeBatch(db);
      let ops = 0;
      const commits = [];
      const siguiente = () => {
        if (ops >= LIMITE) { commits.push(batch.commit()); batch = writeBatch(db); ops = 0; }
      };

      aEscribir.forEach(({ productoId, docId, referencia, nombre, precioEspecial }) => {
        siguiente();
        // Id determinístico para los nuevos: reintentar tras un error falso pisa
        // el mismo documento en vez de crear un duplicado del par cliente+producto.
        const ref = doc(
          db,
          'precios_corporativos',
          docId || idPrecioCorporativo(cliente.id, productoId)
        );
        batch.set(ref, {
          clienteId: cliente.id,
          clienteNombre: cliente.nombre || '',
          productoId,
          referencia,
          nombreProducto: nombre,
          precioEspecial,
          updatedAt: serverTimestamp()
        }, { merge: true });
        ops++;
      });

      aBorrar.forEach(docId => {
        siguiente();
        batch.delete(doc(db, 'precios_corporativos', docId));
        ops++;
      });

      escrituraLanzada = true;
      commits.push(batch.commit());
      await Promise.all(commits);

      await updateDoc(doc(db, 'clientes_corporativos', cliente.id), {
        productosCompartidos: [...habilitadas],
        updatedAt: serverTimestamp()
      });

      alert(
        `Catálogo de ${cliente.nombre} guardado.\n\n` +
        `• Prendas compartidas habilitadas: ${habilitadas.size} de ${compartidas.length}\n` +
        `• Precios propios guardados: ${aEscribir.length}\n` +
        `• Precios propios eliminados: ${aBorrar.length}\n\n` +
        `El cliente verá los cambios al recargar el catálogo en el portal.`
      );
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('Error al guardar el catálogo del cliente:', err);
      // Con persistencia multi-tab, una escritura que SÍ se aplicó puede
      // rechazar la promesa (la pestaña primaria se cerró/refrescó). Nunca
      // afirmar "no se guardó": el guardado es idempotente, así que reintentar
      // es seguro, pero conviene refrescar para ver el estado real.
      setError(
        (escrituraLanzada
          ? 'La operación falló DESPUÉS de enviar los cambios: es posible que sí se hayan guardado. ' +
            'Cierra, vuelve a abrir esta pantalla y verifica antes de reintentar (reintentar no duplica precios).'
          : 'No se alcanzaron a enviar los cambios.') +
        `\n\nDetalle (${err.code || 'sin código'}): ${err.message}`
      );
    } finally {
      setGuardando(false);
    }
  };

  const filaProducto = (producto, { conCheckbox }) => {
    const precioEspecial = (precios[producto.id] ?? '').toString().trim();
    const efectivo = resolverPrecioOficialB2B(producto, precioEspecial === '' ? undefined : Number(precioEspecial));
    const visible = !conCheckbox || habilitadas.has(producto.id);

    return (
      <div
        key={producto.id}
        className={`grid grid-cols-12 gap-2 items-center px-3 py-2 text-sm border-t border-gray-100 ${visible ? '' : 'opacity-50'}`}
      >
        <div className="col-span-12 sm:col-span-5 flex items-center gap-2 min-w-0">
          {conCheckbox && (
            <input
              type="checkbox"
              checked={habilitadas.has(producto.id)}
              onChange={() => toggleProducto(producto.id)}
              className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500 shrink-0"
            />
          )}
          <span className="truncate text-gray-800" title={producto.nombre}>{producto.nombre}</span>
        </div>
        <div className="col-span-4 sm:col-span-2 text-gray-500 text-xs">
          Tienda: {formatCurrency(producto.precio)}
        </div>
        <div className="col-span-4 sm:col-span-2 text-gray-500 text-xs">
          B2B lista: {producto.precioB2B ? formatCurrency(producto.precioB2B) : '—'}
        </div>
        <div className="col-span-4 sm:col-span-3 flex items-center gap-2 justify-end">
          <input
            type="number"
            min="0"
            placeholder="Precio propio"
            value={precios[producto.id] ?? ''}
            onChange={(e) => setPrecios(prev => ({ ...prev, [producto.id]: e.target.value }))}
            className="w-28 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="w-24 text-right font-semibold text-gray-900">{formatCurrency(efectivo)}</span>
        </div>
      </div>
    );
  };

  const bloqueGrupo = (grupo, { conCheckbox }) => {
    const abierto = gruposAbiertos.has(grupo.base);
    const marcadas = grupo.items.filter(p => habilitadas.has(p.id)).length;
    const conPrecioPropio = grupo.items.filter(p => (precios[p.id] ?? '').toString().trim() !== '').length;

    return (
      <div key={grupo.base} className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 bg-gray-50 px-3 py-2">
          <button
            type="button"
            onClick={() => toggleGrupoAbierto(grupo.base)}
            className="flex items-center gap-2 font-medium text-gray-800 hover:text-gray-900"
          >
            {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {grupo.base}
            <span className="text-xs font-normal text-gray-500">
              ({grupo.items.length} {grupo.items.length === 1 ? 'talla' : 'tallas'}
              {conCheckbox && ` · ${marcadas} habilitadas`}
              {conPrecioPropio > 0 && ` · ${conPrecioPropio} con precio propio`})
            </span>
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {conCheckbox && (
              <button
                type="button"
                onClick={() => toggleGrupoCompleto(grupo.items)}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
              >
                {grupo.items.every(p => habilitadas.has(p.id)) ? 'Quitar todas' : 'Habilitar todas'}
              </button>
            )}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Descuento $</span>
              <input
                type="number"
                min="0"
                value={descuentos[grupo.base] ?? ''}
                onChange={(e) => setDescuentos(prev => ({ ...prev, [grupo.base]: e.target.value }))}
                className="w-20 px-2 py-1 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="3000"
              />
              <button
                type="button"
                onClick={() => aplicarDescuentoGrupo(grupo.base, grupo.items)}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
                title="Resta ese valor al precio de tienda de cada talla"
              >
                Aplicar
              </button>
            </div>
            <button
              type="button"
              onClick={() => limpiarPreciosGrupo(grupo.items)}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
              title="Quita el precio propio: vuelve al precio B2B de lista o al de tienda"
            >
              Limpiar
            </button>
          </div>
        </div>

        {abierto && (
          <div className="bg-white">
            {grupo.items.map(p => filaProducto(p, { conCheckbox }))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Catálogo B2B del cliente</h2>
            <p className="text-sm text-gray-600 mt-1">
              {cliente.nombre} · <span className="font-mono">{cliente.codigoColegio}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={22} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-gray-500">
              <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
              Cargando catálogo…
            </div>
          ) : (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                Deja el precio propio vacío para usar el <strong>precio B2B de lista</strong> del producto
                (y si tampoco tiene, el precio de tienda). Un precio propio aquí solo afecta a este cliente.
              </div>

              {/* Prendas compartidas */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-gray-700" />
                  <h3 className="font-semibold text-gray-800">
                    Prendas compartidas
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      (código {CODIGO_COMPARTIDAS} — se venden también en tienda y a otros colegios)
                    </span>
                  </h3>
                </div>

                {!teniaLista && compartidas.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                    Este cliente <strong>no tiene catálogo definido</strong>, así que hoy ve todas las prendas
                    compartidas. Están todas marcadas: desmarca las que no lleve su uniforme y guarda.
                  </div>
                )}

                {compartidas.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay prendas compartidas marcadas como B2B.</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      {habilitadas.size} de {compartidas.length} habilitadas para este cliente.
                    </p>
                    <div className="space-y-2">
                      {gruposCompartidas.map(g => bloqueGrupo(g, { conCheckbox: true }))}
                    </div>
                  </>
                )}
              </section>

              {/* Prendas exclusivas del colegio */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag size={18} className="text-gray-700" />
                  <h3 className="font-semibold text-gray-800">
                    Prendas del colegio {cliente.codigoColegio}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      (solo las ve este colegio — siempre visibles)
                    </span>
                  </h3>
                </div>

                {exclusivas.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Todavía no hay prendas B2B con el código <span className="font-mono">{cliente.codigoColegio}</span>.
                    Créalas en Inventario marcando “Producto B2B”.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gruposExclusivas.map(g => bloqueGrupo(g, { conCheckbox: false }))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end p-4 sm:p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-5 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading || guardando}
            style={{ backgroundColor: '#D50565' }}
            className="px-5 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {guardando ? 'Guardando…' : 'Guardar catálogo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogoClienteB2B;
