import { useState, useRef } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { FileDown, Upload } from 'lucide-react';

const GestionCostos = () => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  // Función para exportar productos actuales a Excel
  const handleExportProductos = async () => {
    setExporting(true);
    try {
      // Obtener todos los productos
      const productsSnapshot = await getDocs(collection(db, 'products'));

      if (productsSnapshot.empty) {
        alert('No hay productos en el inventario para exportar.');
        setExporting(false);
        return;
      }

      // Preparar datos para Excel
      const productosParaExcel = [];
      productsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        productosParaExcel.push({
          REFERENCIA: data.referencia || '',
          NOMBRE: data.nombre || '',
          TALLA: data.talla || 'Única',
          COLEGIO: data.colegio || '',
          COSTO_COMPRA: data.costoCompra || 0,
          COSTO_SATELITE: data.costoSatelite || 0,
          PRECIO_VENTA: data.precio || 0,
          STOCK_TOTAL: data.stockTotal || 0
        });
      });

      // Ordenar por referencia
      productosParaExcel.sort((a, b) => {
        const refA = String(a.REFERENCIA);
        const refB = String(b.REFERENCIA);
        return refA.localeCompare(refB);
      });

      // Crear el libro de Excel
      const worksheet = XLSX.utils.json_to_sheet(productosParaExcel);

      // Ajustar anchos de columnas
      const columnWidths = [
        { wch: 15 }, // REFERENCIA
        { wch: 50 }, // NOMBRE
        { wch: 10 }, // TALLA
        { wch: 12 }, // COLEGIO
        { wch: 15 }, // COSTO_COMPRA
        { wch: 15 }, // COSTO_SATELITE
        { wch: 15 }, // PRECIO_VENTA
        { wch: 12 }  // STOCK_TOTAL
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

      // Generar nombre de archivo con fecha
      const fecha = new Date().toISOString().split('T')[0];
      const fileName = `Productos_Costos_${fecha}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(workbook, fileName);

      alert(`✅ Archivo exportado exitosamente:\n${fileName}\n\nTotal de productos: ${productosParaExcel.length}\n\n💡 Edita los costos en este archivo y luego reimportalo.`);

    } catch (error) {
      console.error('Error al exportar productos:', error);
      alert('❌ Error al exportar productos: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Activar el input de archivo
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Lógica principal de importación de costos
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
      // --- 1. Leer el archivo Excel ---
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

      // --- 2. Obtener TODOS los productos de Firestore ---
      const productsSnapshot = await getDocs(collection(db, 'products'));

      // Crear un "mapa" para buscar IDs de producto por REFERENCIA
      const productRefMap = new Map();
      productsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.referencia) {
          productRefMap.set(String(data.referencia).trim(), doc.id);
        }
      });

      if (productRefMap.size === 0) {
        alert("No hay productos en la base de datos para actualizar.");
        setLoading(false);
        return;
      }

      // --- 3. Preparar el Batch de Actualización ---
      const batch = writeBatch(db);
      let actualizados = 0;
      let sinReferencia = 0;
      let referenciaNoEncontrada = 0;
      let datosInvalidos = 0;
      const referenciasNoEncontradas = [];

      jsonData.forEach((row) => {
        const referencia = String(row.REFERENCIA || '').trim();

        // Validar que tenga referencia
        if (!referencia) {
          sinReferencia++;
          return;
        }

        // Convertir a número y validar
        const costoCompra = Number(row.COSTO_COMPRA || 0);
        const costoSatelite = Number(row.COSTO_SATELITE || 0);
        const precioVenta = Number(row.PRECIO_VENTA || 0);

        // Validar que sean números válidos y no negativos
        if (isNaN(costoCompra) || isNaN(costoSatelite) || isNaN(precioVenta) ||
            costoCompra < 0 || costoSatelite < 0 || precioVenta < 0) {
          datosInvalidos++;
          return;
        }

        // Buscar el ID del producto usando la referencia del Excel
        const productId = productRefMap.get(referencia);

        if (productId) {
          // Si encontramos el producto, preparamos la actualización
          const productRef = doc(db, 'products', productId);
          batch.update(productRef, {
            costoCompra: costoCompra,
            costoSatelite: costoSatelite,
            precio: precioVenta,
            updatedAt: serverTimestamp()
          });
          actualizados++;
        } else {
          // Si no encontramos la referencia en nuestra base de datos
          referenciaNoEncontrada++;
          referenciasNoEncontradas.push(referencia);
        }
      });

      // --- 4. Ejecutar el Batch ---
      if (actualizados > 0) {
        await batch.commit();
      }

      // --- 5. Mostrar Reporte Detallado ---
      let reporteMensaje = `Actualización de costos y precios completada:\n\n`;
      reporteMensaje += `✅ ${actualizados} productos actualizados correctamente.\n`;
      reporteMensaje += `   • Costos de compra\n`;
      reporteMensaje += `   • Costos de satélite\n`;
      reporteMensaje += `   • Precios de venta\n\n`;

      if (sinReferencia > 0) {
        reporteMensaje += `⚠️  ${sinReferencia} filas sin referencia (omitidas).\n`;
      }
      if (referenciaNoEncontrada > 0) {
        reporteMensaje += `⚠️  ${referenciaNoEncontrada} referencias no encontradas en inventario.\n`;
      }
      if (datosInvalidos > 0) {
        reporteMensaje += `❌ ${datosInvalidos} filas con datos inválidos (valores negativos o no numéricos).\n`;
      }

      if (referenciasNoEncontradas.length > 0) {
        console.warn('Referencias no encontradas:', referenciasNoEncontradas);
        alert(reporteMensaje + `\n💡 Revisa la consola (F12) para ver las referencias que no se encontraron.`);
      } else {
        alert(reporteMensaje);
      }

    } catch (error) {
      console.error('Error al actualizar costos:', error);
      alert('Error al actualizar costos: ' + error.message);
    } finally {
      setLoading(false);
      // Limpiar el input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Gestión de Costos y Precios</h2>
      <p className="text-sm text-gray-600 mb-6">
        Exporta todos los productos actuales del sistema, edita los costos/precios y vuelve a importar el archivo actualizado.
      </p>

      {/* Sección de Exportación */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <FileDown className="text-green-600" size={20} />
          Paso 1: Exportar Productos Actuales
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Genera un archivo Excel con TODOS los productos actuales del sistema incluyendo: referencia, nombre, talla, colegio, y costos actuales.
        </p>
        <button
          onClick={handleExportProductos}
          disabled={exporting}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FileDown size={18} />
          {exporting ? 'Exportando...' : 'Exportar Productos a Excel'}
        </button>
      </div>

      {/* Sección de Importación */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <Upload className="text-blue-600" size={20} />
          Paso 2: Editar y Re-importar
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          Después de exportar, edita los costos/precios en el archivo Excel y súbelo aquí para actualizar masivamente.
        </p>

        {/* Input file oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleCostImport}
          style={{ display: 'none' }}
        />

        <button
          onClick={handleImportClick}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Upload size={18} />
          {loading ? 'Procesando...' : 'Importar Archivo Actualizado'}
        </button>

        {loading && (
          <p className="text-sm text-gray-600 mt-3">
            Procesando... Esto puede tardar varios minutos si el archivo es grande.
          </p>
        )}
      </div>

      <hr className="my-6" />

      <h3 className="text-lg font-semibold text-gray-800 mb-3">Información del Archivo</h3>
      <p className="text-sm text-gray-600 mb-4">
        El archivo exportado incluye las siguientes columnas:
      </p>

      {/* Nota importante */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Importante:</strong> Cada producto tiene solo un tipo de costo:
            </p>
            <ul className="list-disc list-inside text-xs text-blue-600 mt-2 space-y-1">
              <li><strong>Productos comprados</strong> (medias, corbatas, etc.) → Solo llenan COSTO_COMPRA</li>
              <li><strong>Productos fabricados</strong> (chaquetas, pantalones, etc.) → Solo llenan COSTO_SATELITE</li>
              <li>El campo que no se use debe ir en 0 o vacío</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Ejemplo visual del formato */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Estructura del archivo exportado:</p>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 border border-gray-300 text-left">REFERENCIA</th>
                <th className="px-2 py-2 border border-gray-300 text-left">NOMBRE</th>
                <th className="px-2 py-2 border border-gray-300 text-left">TALLA</th>
                <th className="px-2 py-2 border border-gray-300 text-left">COLEGIO</th>
                <th className="px-2 py-2 border border-gray-300 text-left bg-yellow-50">COSTO_COMPRA</th>
                <th className="px-2 py-2 border border-gray-300 text-left bg-yellow-50">COSTO_SATELITE</th>
                <th className="px-2 py-2 border border-gray-300 text-left bg-yellow-50">PRECIO_VENTA</th>
                <th className="px-2 py-2 border border-gray-300 text-left">STOCK_TOTAL</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr>
                <td className="px-2 py-2 border border-gray-300">MA001CH</td>
                <td className="px-2 py-2 border border-gray-300">CHAQUETA MA</td>
                <td className="px-2 py-2 border border-gray-300">12</td>
                <td className="px-2 py-2 border border-gray-300">MA</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">0</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">45000</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">120000</td>
                <td className="px-2 py-2 border border-gray-300">15</td>
              </tr>
              <tr>
                <td className="px-2 py-2 border border-gray-300">GEN001ME</td>
                <td className="px-2 py-2 border border-gray-300">MEDIAS BLANCAS</td>
                <td className="px-2 py-2 border border-gray-300">Única</td>
                <td className="px-2 py-2 border border-gray-300">OT</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">8000</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">0</td>
                <td className="px-2 py-2 border border-gray-300 bg-yellow-50">15000</td>
                <td className="px-2 py-2 border border-gray-300">50</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-xs text-gray-600">
          <p><strong>📌 Columnas de solo lectura:</strong> REFERENCIA, NOMBRE, TALLA, COLEGIO, STOCK_TOTAL (no editar)</p>
          <p className="bg-yellow-50 p-2 rounded border border-yellow-200">
            <strong>✏️ Columnas editables (resaltadas):</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>COSTO_COMPRA:</strong> Para productos comprados (medias, corbatas, moños, etc.)</li>
            <li><strong>COSTO_SATELITE:</strong> Para productos fabricados (labor de confección)</li>
            <li><strong>PRECIO_VENTA:</strong> Precio al público</li>
          </ul>
          <p className="text-orange-600 font-semibold mt-2">⚠️ NO borres ni modifiques la columna REFERENCIA - es necesaria para identificar cada producto</p>
        </div>
      </div>
    </div>
  );
};

export default GestionCostos;
