# 📦 Instrucciones de Deploy a Hostinger

## ✅ Estado: Todo Listo para Subir

La carpeta `dist/` contiene todos los archivos listos para subir a Hostinger.

---

## 📁 Contenido de la Carpeta `dist/`

```
dist/
├── .htaccess           ✓ Configurado para React Router
├── index.html          ✓ Página principal
├── vite.svg           ✓ Favicon
└── assets/            ✓ CSS, JavaScript y recursos
    ├── index-BvauS1Op.css  (49.71 kB)
    └── index-DgFa4K_M.js   (1.59 MB)
```

---

## 🚀 Pasos para Subir a Hostinger

### 1️⃣ **Accede al Panel de Hostinger**
   - Ve a [hpanel.hostinger.com](https://hpanel.hostinger.com)
   - Inicia sesión con tus credenciales

### 2️⃣ **Abre el Administrador de Archivos**
   - En tu panel de hosting, busca "Administrador de Archivos" o "File Manager"
   - Navega a la carpeta `public_html` (o la carpeta raíz de tu dominio)

### 3️⃣ **Limpia la Carpeta Actual (IMPORTANTE)**
   - **Selecciona TODOS los archivos** en `public_html`
   - **Elimínalos** (o haz backup si hay algo importante)
   - La carpeta debe quedar **completamente vacía**

### 4️⃣ **Sube los Archivos de `dist/`**

   **Opción A: Arrastrar y Soltar**
   - Abre la carpeta `dist/` en tu computadora
   - Selecciona **TODO el contenido** (Ctrl+A):
     - `.htaccess`
     - `index.html`
     - `vite.svg`
     - carpeta `assets/`
   - **Arrástralos** al administrador de archivos de Hostinger

   **Opción B: Subir con ZIP**
   - Comprime TODO el contenido de `dist/` en un archivo .zip
   - Sube el .zip a `public_html`
   - Extrae el .zip en el servidor
   - **IMPORTANTE:** Mueve el contenido de la carpeta extraída a `public_html` directamente
   - Elimina el .zip y la carpeta temporal

### 5️⃣ **Verifica la Estructura Final**

Después de subir, tu `public_html` debe verse así:

```
public_html/
├── .htaccess          ← IMPORTANTE: Debe estar aquí
├── index.html
├── vite.svg
└── assets/
    ├── index-BvauS1Op.css
    └── index-DgFa4K_M.js
```

**⚠️ VERIFICA QUE `.htaccess` ESTÉ PRESENTE**
- Si no ves `.htaccess`, es porque los archivos ocultos no están visibles
- Habilita "Mostrar archivos ocultos" en el administrador de archivos
- Sin el `.htaccess`, las rutas de React Router NO funcionarán

---

## 🔐 Configurar Variables de Entorno (Firebase)

Hostinger NO soporta variables de entorno como Vercel/Netlify. Las credenciales de Firebase ya están **compiladas en el JavaScript** del build.

**⚠️ IMPORTANTE DE SEGURIDAD:**
- Las credenciales de Firebase son **públicas** (están en el código compilado)
- Firebase se protege con **Reglas de Seguridad** en Firestore y Authentication
- **Verifica** que tus reglas de Firebase estén configuradas correctamente
- **NUNCA** expongas API Keys secretas o claves privadas

**Reglas Recomendadas de Firestore:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer/escribir
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🌐 SSL/HTTPS (Recomendado)

1. En el panel de Hostinger, ve a **SSL**
2. Activa el **SSL gratuito** (Let's Encrypt)
3. Una vez activado, **descomenta** estas líneas en `.htaccess`:
   ```apache
   # RewriteCond %{HTTPS} off
   # RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```
4. Esto redirigirá automáticamente HTTP → HTTPS

---

## ✅ Verificación Post-Deploy

Después de subir, verifica:

1. **Página principal carga:** `https://tudominio.com`
2. **Login funciona:** Prueba iniciar sesión
3. **Rutas funcionan:** Navega a diferentes secciones
4. **Refresh funciona:** Actualiza la página (F5) en cualquier ruta
5. **Firebase conecta:** Verifica que los datos se cargan

---

## 🐛 Solución de Problemas

### ❌ "404 Not Found" al actualizar la página
**Causa:** Falta el `.htaccess` o no está configurado correctamente
**Solución:**
- Verifica que `.htaccess` esté en `public_html`
- Verifica que el contenido sea correcto
- Contacta soporte de Hostinger para habilitar `mod_rewrite`

### ❌ Página en blanco o errores de consola
**Causa:** Rutas de archivos incorrectas
**Solución:**
- Verifica que los archivos estén directamente en `public_html`
- Abre la consola del navegador (F12) para ver errores
- Verifica que no haya una carpeta extra (como `dist/dist/`)

### ❌ Firebase no conecta
**Causa:** Variables de entorno no configuradas o reglas de Firebase
**Solución:**
- Verifica que el build tenga las credenciales correctas
- Revisa las reglas de seguridad de Firebase
- Revisa la consola del navegador para ver errores de Firebase

---

## 🔄 Actualizar el Sitio (Futuras Modificaciones)

Cuando hagas cambios:

1. Ejecuta `npm run build` localmente
2. Sube el contenido de `dist/` a Hostinger
3. **IMPORTANTE:** Limpia el caché del navegador (Ctrl+Shift+R)

---

## 📊 Tamaño del Build

- **Total:** ~1.6 MB (comprimido con GZIP: ~405 KB)
- **CSS:** 49.71 KB (comprimido: 8.66 KB)
- **JavaScript:** 1.59 MB (comprimido: 404.15 KB)

El `.htaccess` habilita compresión GZIP automáticamente para todos los visitantes.

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12 → Console)
2. Contacta soporte de Hostinger
3. Verifica que `mod_rewrite` esté habilitado en tu hosting

---

## ✨ ¡Listo!

Tu aplicación está lista para ser desplegada en Hostinger. Solo sube el contenido de `dist/` y estará en línea.

**Ruta de archivos a subir:**
```
c:\Users\BRAIH\Desktop\uniformes-martha-romero\dist\
```

🚀 **¡Éxito con tu deploy!**
