/**
 * Script para recalcular pendientes en pedidos B2B
 *
 * Recalcula correctamente:
 * - Pendientes de alistamiento
 * - Pendientes de envío
 * - Pendientes de recepción
 *
 * Corrige valores negativos (como -2)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA62pp7JSlhIXdl57eK7tsjGiGVJhJ0k7g",
  authDomain: "ventasmartha.firebaseapp.com",
  projectId: "ventasmartha",
  storageBucket: "ventasmartha.firebasestorage.app",
  messagingSenderId: "565418020023",
  appId: "1:565418020023:web:5a10faf851bc0e14e98db2",
  measurementId: "G-ND3FF10M8F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function recalcularPendientes() {
  console.log('🔧 Iniciando recálculo de pendientes en pedidos B2B...\n');

  try {
    // Leer todos los pedidos B2B
    const pedidosSnap = await getDocs(collection(db, 'pedidos_b2b'));
    const pedidos = [];

    pedidosSnap.forEach(docSnap => {
      pedidos.push({ id: docSnap.id, ...docSnap.data() });
    });

    console.log(`📦 Total de pedidos B2B: ${pedidos.length}\n`);

    let pedidosCorregidos = 0;
    let productosCorregidos = 0;

    for (const pedido of pedidos) {
      if (!pedido.productos || pedido.productos.length === 0) {
        console.log(`⏭️  Pedido ${pedido.id} sin productos, saltando...`);
        continue;
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Procesando Pedido: ${pedido.id}`);
      console.log(`   Cliente: ${pedido.clienteNombre || 'N/A'}`);
      console.log(`   Productos: ${pedido.productos.length}`);

      let huboCambios = false;
      const productosActualizados = pedido.productos.map((producto, index) => {
        const cantidadPedida = producto.cantidad || 0;
        const cantidadAlistada = producto.cantidadAlistada || 0;
        const cantidadEnviada = producto.cantidadEnviada || 0;
        const cantidadRecibida = producto.cantidadRecibida || 0;

        // Calcular pendientes correctos (nunca negativos)
        const pendienteAlistar = Math.max(0, cantidadPedida - cantidadAlistada);
        const pendienteEnviar = Math.max(0, cantidadAlistada - cantidadEnviada);
        const pendienteRecibir = Math.max(0, cantidadEnviada - cantidadRecibida);

        // Verificar si hay correcciones necesarias
        const necesitaCorreccion =
          pendienteAlistar < 0 || pendienteEnviar < 0 || pendienteRecibir < 0;

        if (necesitaCorreccion) {
          console.log(`\n   🔧 Producto ${index + 1}: ${producto.descripcion} - ${producto.talla}`);
          console.log(`      Pedida: ${cantidadPedida}, Alistada: ${cantidadAlistada}, Enviada: ${cantidadEnviada}, Recibida: ${cantidadRecibida}`);

          // Mostrar antes y después
          const pendienteAlistarAntes = cantidadPedida - cantidadAlistada;
          const pendienteEnviarAntes = cantidadAlistada - cantidadEnviada;
          const pendienteRecibirAntes = cantidadEnviada - cantidadRecibida;

          console.log(`      ANTES  → Pendiente Alistar: ${pendienteAlistarAntes}, Enviar: ${pendienteEnviarAntes}, Recibir: ${pendienteRecibirAntes}`);
          console.log(`      DESPUÉS→ Pendiente Alistar: ${pendienteAlistar}, Enviar: ${pendienteEnviar}, Recibir: ${pendienteRecibir}`);

          huboCambios = true;
          productosCorregidos++;
        }

        // Retornar el producto con las cantidades validadas (sin negativos)
        return {
          ...producto
          // No guardamos campos calculados, se calculan en tiempo real en la UI
        };
      });

      // Solo actualizar si hubo cambios
      if (huboCambios) {
        const pedidoRef = doc(db, 'pedidos_b2b', pedido.id);
        await updateDoc(pedidoRef, {
          productos: productosActualizados,
          ultimoRecalculo: new Date()
        });

        pedidosCorregidos++;
        console.log(`\n   ✅ Pedido actualizado con correcciones`);
      } else {
        console.log(`   ✓ Pedido correcto, no requiere cambios`);
      }
    }

    // Resumen final
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 RESUMEN DEL RECÁLCULO`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Pedidos procesados: ${pedidos.length}`);
    console.log(`✅ Pedidos corregidos: ${pedidosCorregidos}`);
    console.log(`✅ Productos corregidos: ${productosCorregidos}`);
    console.log(`\n🎉 Proceso completado exitosamente!\n`);

  } catch (error) {
    console.error('\n❌ Error durante el recálculo:', error);
    throw error;
  }
}

// Ejecutar el script
recalcularPendientes()
  .then(() => {
    console.log('✅ Script finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
