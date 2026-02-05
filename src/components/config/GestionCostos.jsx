import { useState, useRef, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { FileDown, Upload, Search, Edit2, Check, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

const GestionCostos = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [showExcelSection, setShowExcelSection] = useState(false);
  const [filterSinCosto, setFilterSinCosto] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const fileInputRef = useRef(null);

  // Cargar productos al montar
  useEffect(() => {
    fetchProductos();
  }, []);

  // Filtrar productos cuando cambia el término de búsqueda o el filtro
  useEffect(() => {
    let filtered = productos;

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.referencia?.toLowerCase().includes(search) ||
        p.nombre?.toLowerCase().includes(search) ||
        p.colegio?.toLowerCase().includes(search)
      );
    }

    // Filtrar productos sin costo de satélite
    if (filterSinCosto) {
      filtered = filtered.filter(p => !p.costoSatelite || p.costoSatelite === 0);
    }

    setFilteredProductos(filtered);
    setCurrentPage(1); // Resetear a página 1 cuando cambia el filtro
  }, [searchTerm, productos, filterSinCosto]);

  // Calcular paginación
  const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProductos.slice(startIndex, endIndex);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar por referencia
      data.sort((a, b) => {
        const refA = String(a.referencia || '');
        const refB = String(b.referencia || '');
        return refA.localeCompare(refB);
      });

      setProductos(data);
      setFilteredProductos(data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar edición de un producto
  const handleStartEdit = (producto) => {
    setEditingId(producto.id);
    setEditValues({
      costoCompra: producto.costoCompra || 0,
      costoSatelite: producto.costoSatelite || 0
    });
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  // Guardar cambios de un producto
  const handleSaveEdit = async (productoId) => {
    setSaving(true);
    try {
      const productRef = doc(db, 'products', productoId);
      await updateDoc(productRef, {
        costoCompra: Number(editValues.costoCompra) || 0,
        costoSatelite: Number(editValues.costoSatelite) || 0,
        updatedAt: serverTimestamp()
      });

      // Actualizar estado local
      setProductos(prev => prev.map(p =>
        p.id === productoId
          ? {
              ...p,
              costoCompra: Number(editValues.costoCompra) || 0,
              costoSatelite: Number(editValues.costoSatelite) || 0
            }
          : p
      ));

      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  // Formatear moneda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  // Función para exportar productos actuales a Excel
  const handleExportProductos = async () => {
    setExporting(true);
    try {
      const productosParaExcel = productos.map(p => ({
        REFERENCIA: p.referencia || '',
        NOMBRE: p.nombre || '',
        TALLA: p.talla || 'Única',
        COLEGIO: p.colegio || '',
        COSTO_COMPRA: p.costoCompra || 0,
        COSTO_SATELITE: p.costoSatelite || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(productosParaExcel);
      worksheet['!cols'] = [
        { wch: 15 }, { wch: 50 }, { wch: 10 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

      const fecha = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Productos_Costos_${fecha}.xlsx`);

      alert(`✅ Archivo exportado: ${productos.length} productos`);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Error al exportar: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCostImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
      alert('Por favor, selecciona un archivo .xlsx o .csv');
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('El archivo está vacío.');
        setLoading(false);
        return;
      }

      const productRefMap = new Map();
      productos.forEach(p => {
        if (p.referencia) {
          productRefMap.set(String(p.referencia).trim(), p.id);
        }
      });

      const batch = writeBatch(db);
      let actualizados = 0;

      jsonData.forEach((row) => {
        const referencia = String(row.REFERENCIA || '').trim();
        if (!referencia) return;

        const costoCompra = Number(row.COSTO_COMPRA || 0);
        const costoSatelite = Number(row.COSTO_SATELITE || 0);

        if (isNaN(costoCompra) || isNaN(costoSatelite)) return;

        const productId = productRefMap.get(referencia);
        if (productId) {
          const productRef = doc(db, 'products', productId);
          batch.update(productRef, {
            costoCompra,
            costoSatelite,
            updatedAt: serverTimestamp()
          });
          actualizados++;
        }
      });

      if (actualizados > 0) {
        await batch.commit();
        await fetchProductos(); // Recargar datos
      }

      alert(`✅ ${actualizados} productos actualizados`);

    } catch (error) {
      console.error('Error al importar:', error);
      alert('Error al importar: ' + error.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Contar productos sin costo de satélite
  const productosSinCostoSatelite = productos.filter(p => !p.costoSatelite || p.costoSatelite === 0).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Gestión de Costos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configura los costos de compra y satélite de los productos.
          </p>
        </div>
        <button
          onClick={() => setShowExcelSection(!showExcelSection)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          {showExcelSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showExcelSection ? 'Ocultar' : 'Importar/Exportar Excel'}
        </button>
      </div>

      {/* Sección de Excel (colapsable) */}
      {showExcelSection && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="flex gap-4">
            <button
              onClick={handleExportProductos}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FileDown size={16} />
              {exporting ? 'Exportando...' : 'Exportar a Excel'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              onChange={handleCostImport}
              className="hidden"
            />

            <button
              onClick={handleImportClick}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Upload size={16} />
              {loading ? 'Importando...' : 'Importar desde Excel'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Exporta, edita en Excel las columnas COSTO_COMPRA y COSTO_SATELITE, y reimporta.
          </p>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por referencia, nombre o colegio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        {productosSinCostoSatelite > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterSinCosto}
              onChange={(e) => setFilterSinCosto(e.target.checked)}
              className="w-4 h-4 text-pink-600 rounded"
            />
            <span className="text-amber-600 font-medium">
              Sin costo satélite ({productosSinCostoSatelite})
            </span>
          </label>
        )}

        <span className="text-sm text-gray-500">
          {filteredProductos.length} de {productos.length} productos
        </span>
      </div>

      {/* Tabla de productos */}
      {loading && productos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Cargando productos...</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Talla</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Compra</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Satélite</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentProducts.map((producto) => (
                <tr
                  key={producto.id}
                  className={`hover:bg-gray-50 ${
                    (!producto.costoSatelite || producto.costoSatelite === 0) &&
                    (!producto.costoCompra || producto.costoCompra === 0)
                      ? 'bg-amber-50'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{producto.referencia}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate" title={producto.nombre}>
                    {producto.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{producto.talla || 'Única'}</td>

                  {editingId === producto.id ? (
                    // Modo edición
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editValues.costoCompra}
                          onChange={(e) => setEditValues({ ...editValues, costoCompra: e.target.value })}
                          className="w-28 px-2 py-1 text-right border rounded text-sm"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editValues.costoSatelite}
                          onChange={(e) => setEditValues({ ...editValues, costoSatelite: e.target.value })}
                          className="w-28 px-2 py-1 text-right border rounded text-sm"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(producto.id)}
                            disabled={saving}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            title="Guardar"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Cancelar"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // Modo visualización
                    <>
                      <td className={`px-4 py-3 text-sm text-right ${producto.costoCompra ? 'text-gray-900' : 'text-gray-400'}`}>
                        {formatCurrency(producto.costoCompra)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${producto.costoSatelite ? 'text-gray-900 font-medium' : 'text-red-400'}`}>
                        {producto.costoSatelite ? formatCurrency(producto.costoSatelite) : '$0'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleStartEdit(producto)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          title="Editar costos"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProductos.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No se encontraron productos con esos criterios.
            </div>
          )}
        </div>
      )}

      {/* Controles de paginación */}
      {filteredProductos.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          {/* Info y selector de items por página */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredProductos.length)} de {filteredProductos.length}
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>

          {/* Botones de navegación */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Primera
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Números de página */}
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-pink-600 text-white'
                          : 'border hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Última
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></span>
          Sin costos configurados
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-400">$0</span>
          = Sin costo de satélite
        </span>
      </div>
    </div>
  );
};

export default GestionCostos;
