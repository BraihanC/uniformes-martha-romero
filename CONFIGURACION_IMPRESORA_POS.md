# Configuración de Impresora POS-80 para Tickets

Este documento te guía paso a paso para configurar correctamente tu impresora térmica POS-80 para imprimir tickets desde la aplicación web.

## 📋 Requisitos Previos

- Impresora térmica POS-80 (80mm) conectada al PC
- Drivers de la impresora instalados
- Papel térmico de 80mm cargado

---

## ⚙️ PASO 1: Configurar el Tamaño de Papel en Windows

La configuración más importante es establecer el tamaño de papel correcto:

### Windows 10/11:

1. Presiona `Windows + R` y escribe: `control printers`
2. Busca tu impresora **POS-80** en la lista
3. Haz **clic derecho** → **Preferencias de impresión**
4. Busca la pestaña **"Configuración de papel"** o **"Paper Size"**
5. Crea o selecciona un tamaño personalizado:
   - **Ancho**: `80 mm` (o `3.15 pulgadas`)
   - **Alto**: `Continuo` o `297 mm`
6. Haz clic en **Aplicar** y **Aceptar**

### Si tu impresora usa software específico:

Algunas impresoras POS vienen con software de configuración (como "Pos Printer Utility" o similar):

1. Abre el software de configuración de tu impresora
2. Configura el tamaño de papel a: **80mm x Continuo**
3. Configura el modo de impresión: **ESC/POS** o **EPSON Compatible**
4. Guarda la configuración

---

## 🌐 PASO 2: Configurar el Navegador para Imprimir

Cuando hagas clic en el botón **"Imprimir"** en la aplicación:

### En Chrome/Edge:

1. Se abrirá una ventana de confirmación con instrucciones
2. Haz clic en **Aceptar**
3. En el diálogo de impresión que aparece:

   **Configuración básica:**
   - ✅ **Destino**: Selecciona tu impresora `POS-80`
   - ✅ **Páginas**: `Todo`
   - ✅ **Diseño**: `Vertical` (Portrait)

   **Haz clic en "Más ajustes":**
   - ✅ **Tamaño del papel**: `80mm` (el que configuraste en Windows)
   - ✅ **Márgenes**: `Ninguno` o `Mínimos`
   - ✅ **Escala**: `Predeterminado (100%)`
   - ❌ **Encabezados y pies de página**: Desactivar
   - ✅ **Gráficos de fondo**: Activar

4. Haz clic en **Imprimir**

---

## 🔧 Solución de Problemas Comunes

### ❌ La impresora no aparece en la lista

**Solución:**
- Verifica que la impresora esté encendida
- Reconecta el cable USB
- Reinstala los drivers de la impresora
- Reinicia el navegador

### ❌ Se imprime en blanco o cortado

**Solución:**
- Verifica el tamaño de papel en Windows (debe ser 80mm)
- Asegúrate de desactivar "Encabezados y pies de página"
- Configura márgenes en "Ninguno"

### ❌ El texto sale muy pequeño o muy grande

**Solución:**
- Asegúrate de que la escala esté en 100%
- Verifica que el tamaño de papel en Windows sea 80mm exactamente

### ❌ No imprime nada / Error de impresora

**Solución:**
1. Abre **Panel de Control → Dispositivos e impresoras**
2. Haz clic derecho en tu impresora POS-80 → **"Imprimir página de prueba"**
3. Si no imprime la página de prueba, el problema está en los drivers:
   - Descarga e instala los drivers más recientes de la página del fabricante
   - Reinicia el PC

---

## 📱 Configuración Alternativa: Impresión Directa (Avanzado)

Si la impresión desde el navegador no funciona bien, puedes usar un servidor de impresión local:

### Opción 1: Usar QZ Tray (Recomendado para POS)

1. Descarga **QZ Tray**: https://qz.io/download/
2. Instala QZ Tray en tu PC
3. La aplicación web puede enviar comandos directos a la impresora sin pasar por el diálogo del navegador

### Opción 2: Compartir impresora en red

Si usas la aplicación desde varios dispositivos:

1. Comparte la impresora POS desde el PC principal
2. Conecta los demás dispositivos a la impresora compartida

---

## ✅ Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] La impresora está encendida y tiene papel
- [ ] El tamaño de papel en Windows está configurado a 80mm
- [ ] Los drivers están instalados correctamente
- [ ] Una página de prueba se imprime correctamente desde Windows
- [ ] El navegador está actualizado a la última versión
- [ ] Has seguido la configuración del diálogo de impresión exactamente como se indica

---

## 📞 Soporte Adicional

Si después de seguir todos los pasos aún no funciona:

1. Verifica el modelo exacto de tu impresora
2. Busca el manual del fabricante en línea
3. Contacta al soporte técnico del fabricante de la impresora

---

## 🎯 Resumen Rápido

**3 configuraciones clave:**
1. ⚙️ **Windows**: Tamaño de papel = 80mm
2. 🌐 **Navegador**: Márgenes = Ninguno, Sin encabezados
3. 🖨️ **Impresora**: Modo ESC/POS activado

¡Con estas configuraciones, tus tickets deberían imprimirse perfectamente! 🎉
