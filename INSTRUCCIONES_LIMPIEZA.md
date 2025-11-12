# 🧹 Instrucciones para Limpiar la Base de Datos

## ⚠️ IMPORTANTE: Lee esto ANTES de ejecutar

Este script eliminará **PERMANENTEMENTE** todos los datos de prueba de tu base de datos Firebase.

---

## 📋 ¿Qué se eliminará?

El script eliminará TODAS las colecciones de prueba:
- ❌ **sales** - Todas las ventas/facturas
- ❌ **apartados** - Todos los apartados
- ❌ **pedidos** - Todos los pedidos
- ❌ **cambiosYDevoluciones** - Todas las devoluciones y cambios
- ❌ **products** - Todos los productos
- ❌ **egresos** - Todos los gastos
- ❌ **entradas** - Todas las entradas de inventario

## ✅ ¿Qué se mantendrá?

El script NO tocará estas colecciones:
- 🔒 **clients** - Tus clientes reales (se mantienen intactos)
- 🔒 **colegios** - Catálogo de colegios
- 🔒 **config** - Configuración de la empresa (logo, NIT, etc.)
- 🔒 **users** - Usuarios del sistema

## 📌 Sobre los Consecutivos

Los consecutivos (números de factura, apartado, pedido) se reiniciarán automáticamente:
- Cuando elimines todas las ventas → la próxima factura será #1
- Cuando elimines todos los apartados → el próximo apartado será #1
- Cuando elimines todos los pedidos → el próximo pedido será #1

**No necesitas hacer nada más**, el sistema toma el último número de cada colección.

---

## 🚀 Cómo ejecutar el script

### Paso 1: Abre la terminal en este proyecto

```bash
cd C:\Users\BRAIH\Desktop\uniformes-martha-romero
```

### Paso 2: Ejecuta el comando de limpieza

```bash
npm run clean-db
```

### Paso 3: Confirma la operación

El script te pedirá **2 confirmaciones** de seguridad:
1. Primera confirmación: escribe `si` y presiona Enter
2. Segunda confirmación: escribe `si` y presiona Enter

Si escribes cualquier otra cosa (o simplemente Enter), el script se cancelará sin hacer cambios.

---

## 📊 Qué esperar durante la ejecución

El script mostrará:
- Lista de colecciones a eliminar
- Lista de colecciones a mantener
- Progreso en tiempo real de cada colección
- Número de documentos eliminados
- Tiempo total de ejecución

### Ejemplo de salida:

```
🗑️  Eliminando colección: sales...
   📊 Encontrados 45 documentos
   ⏳ Eliminados 45/45 documentos...
   ✅ Colección 'sales' eliminada completamente (45 documentos)

🗑️  Eliminando colección: apartados...
   📊 Encontrados 12 documentos
   ⏳ Eliminados 12/12 documentos...
   ✅ Colección 'apartados' eliminada completamente (12 documentos)
```

---

## ⏱️ Tiempo estimado

- Base de datos pequeña (< 100 documentos): 10-30 segundos
- Base de datos mediana (100-500 documentos): 30 segundos - 2 minutos
- Base de datos grande (> 500 documentos): 2-5 minutos

---

## 🔄 Después de la limpieza

Una vez completada la limpieza:

1. ✅ Puedes empezar a cargar tus productos reales
2. ✅ La primera venta será factura #1
3. ✅ El primer apartado será #1
4. ✅ El primer pedido será #1
5. ✅ Tus clientes estarán intactos

---

## 🛑 Si algo sale mal

Si el script falla o se interrumpe:
- No te preocupes, puedes ejecutarlo de nuevo
- Firebase no se corromperá
- Los datos eliminados NO se pueden recuperar
- Las colecciones que se mantienen (clients, config, etc.) nunca serán tocadas

---

## 📞 Soporte

Si tienes dudas o problemas, revisa:
1. Que estés conectado a internet
2. Que tengas permisos en Firebase
3. Que el archivo `.env` esté correcto

---

## ✅ Checklist antes de ejecutar

- [ ] Entiendo que esta operación es IRREVERSIBLE
- [ ] He revisado qué colecciones se eliminarán
- [ ] He confirmado que mis clientes reales están en la colección `clients`
- [ ] Tengo preparados los productos reales para subir después
- [ ] Estoy listo para empezar en producción

**Si marcaste todas las casillas, ¡adelante! Ejecuta `npm run clean-db`**
