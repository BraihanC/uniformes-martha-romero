import { useState, useRef } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const GestionCostos = () => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

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

        // Validar que sean números válidos y no negativos
        if (isNaN(costoCompra) || isNaN(costoSatelite) || costoCompra < 0 || costoSatelite < 0) {
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
      let reporteMensaje = `Actualización de costos completada:\n\n`;
      reporteMensaje += `✅ ${actualizados} productos actualizados correctamente.\n`;

      if (sinReferencia > 0) {
        reporteMensaje += `⚠️  ${sinReferencia} filas sin referencia (omitidas).\n`;
      }
      if (referenciaNoEncontrada > 0) {
        reporteMensaje += `⚠️  ${referenciaNoEncontrada} referencias no encontradas en inventario.\n`;
      }
      if (datosInvalidos > 0) {
        reporteMensaje += `❌ ${datosInvalidos} filas con datos inválidos (costos negativos o no numéricos).\n`;
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
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Carga Masiva de Costos</h2>
      <p className="text-sm text-gray-600 mb-4">
        Sube un archivo Excel (.xlsx o .csv) con las siguientes columnas para actualizar los costos de productos existentes:
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
        <p className="text-sm font-medium text-gray-700 mb-2">Formato requerido del Excel:</p>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 border border-gray-300 text-left">REFERENCIA</th>
                <th className="px-3 py-2 border border-gray-300 text-left">COSTO_COMPRA</th>
                <th className="px-3 py-2 border border-gray-300 text-left">COSTO_SATELITE</th>
                <th className="px-3 py-2 border border-gray-300 text-left text-gray-500">Tipo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="bg-green-50">
                <td className="px-3 py-2 border border-gray-300">10201</td>
                <td className="px-3 py-2 border border-gray-300">18000</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-400">0</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-500 text-xs">Producto comprado</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="px-3 py-2 border border-gray-300">10202</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-400">0</td>
                <td className="px-3 py-2 border border-gray-300">15000</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-500 text-xs">Producto fabricado</td>
              </tr>
              <tr className="bg-green-50">
                <td className="px-3 py-2 border border-gray-300">10203</td>
                <td className="px-3 py-2 border border-gray-300">8500</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-400">0</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-500 text-xs">Producto comprado</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="px-3 py-2 border border-gray-300">10204</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-400">0</td>
                <td className="px-3 py-2 border border-gray-300">22000</td>
                <td className="px-3 py-2 border border-gray-300 text-gray-500 text-xs">Producto fabricado</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-xs text-gray-600">
          <p><strong>REFERENCIA:</strong> Código único del producto (debe existir en el inventario)</p>
          <p className="flex items-start">
            <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 mr-2 mt-0.5"></span>
            <span><strong>COSTO_COMPRA:</strong> Para productos comprados a terceros (medias, corbatas, moños, etc.)</span>
          </p>
          <p className="flex items-start">
            <span className="inline-block w-3 h-3 bg-purple-100 border border-purple-300 mr-2 mt-0.5"></span>
            <span><strong>COSTO_SATELITE:</strong> Para productos fabricados (labor de confección pagada al satélite)</span>
          </p>
          <p className="text-gray-500 italic mt-2">* La columna "Tipo" no se incluye en el Excel, solo es referencia visual</p>
        </div>
      </div>

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
        style={{ backgroundColor: '#EA5C2E' }}
        className="px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Procesando archivo...' : 'Seleccionar y Cargar Archivo de Costos'}
      </button>

      {loading && (
        <p className="text-sm text-gray-600 mt-4">
          Procesando... Esto puede tardar varios minutos si el archivo es grande.
        </p>
      )}
    </div>
  );
};

export default GestionCostos;
