# Guía de Despliegue en Hostinger y Otros Hostings Tradicionales

Esta guía te ayudará a desplegar el sistema POS en servicios de hosting tradicionales como Hostinger, GoDaddy, Bluehost, cPanel, etc.

## Índice

1. [Introducción](#introducción)
2. [Requisitos Previos](#requisitos-previos)
3. [Método 1: Despliegue Directo (Hosting Compartido)](#método-1-despliegue-directo-hosting-compartido)
4. [Método 2: VPS con Node.js](#método-2-vps-con-nodejs)
5. [Configuración de Hostinger Específica](#configuración-de-hostinger-específica)
6. [Configuración de .htaccess](#configuración-de-htaccess)
7. [Configuración de Dominio](#configuración-de-dominio)
8. [Verificación y Pruebas](#verificación-y-pruebas)
9. [Solución de Problemas](#solución-de-problemas)
10. [Actualizaciones Futuras](#actualizaciones-futuras)

---

## Introducción

**Importante**: Este es un proyecto Vite + React que se compila a archivos estáticos HTML, CSS y JavaScript. No requiere Node.js en el servidor de producción, solo para el proceso de construcción (build).

### ¿Qué tipo de hosting necesitas?

- **Hosting Compartido/Web Hosting**: ✅ Suficiente (solo sirve archivos estáticos)
- **VPS**: ✅ También funciona (más control y opciones)
- **Hosting PHP tradicional**: ✅ Funciona perfectamente
- **Node.js en servidor**: ❌ NO necesario en producción

---

## Requisitos Previos

### 1. Cuenta de Hosting Activa

Necesitas una cuenta en alguno de estos servicios:
- Hostinger
- GoDaddy
- Bluehost
- SiteGround
- HostGator
- Cualquier hosting con cPanel
- VPS (DigitalOcean, Linode, etc.)

### 2. Acceso a tu Hosting

Asegúrate de tener:
- ✅ Acceso al **Panel de Control** (cPanel, hPanel de Hostinger, etc.)
- ✅ Acceso **FTP/SFTP** (usuario, contraseña, servidor)
- ✅ O acceso al **File Manager** del panel

### 3. Dominio Configurado

- Un dominio apuntando a tu hosting
- O usar el dominio temporal que proporciona el hosting

### 4. Firebase Configurado

Completa todos los pasos en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) antes de continuar.

---

## Método 1: Despliegue Directo (Hosting Compartido)

Este es el método más común para Hostinger y otros hostings tradicionales.

### Paso 1: Construir la Aplicación Localmente

En tu computadora, en la carpeta del proyecto:

```bash
# 1. Asegúrate de tener las dependencias instaladas
npm install

# 2. Construir la aplicación para producción
npm run build
```

Esto creará una carpeta llamada `dist` con todos los archivos compilados.

### Paso 2: Verificar el Build

```bash
# Previsualizar localmente
npm run preview
```

Abre `http://localhost:4173` y verifica que todo funcione correctamente.

### Paso 3: Preparar los Archivos

La carpeta `dist` contiene todo lo que necesitas subir al servidor:

```
dist/
├── index.html          # Página principal
├── assets/            # CSS, JS e imágenes compiladas
│   ├── index-abc123.js
│   ├── index-def456.css
│   └── ...
└── vite.svg           # Favicon (si existe)
```

### Paso 4: Subir Archivos al Hosting

Tienes varias opciones:

#### Opción A: FileZilla (FTP/SFTP) - Recomendado

1. **Descargar FileZilla**
   - Descarga desde [filezilla-project.org](https://filezilla-project.org/)
   - Instala el cliente FTP

2. **Obtener credenciales FTP**
   - Ve a tu panel de hosting
   - Busca la sección "FTP" o "File Manager"
   - Anota:
     - **Host/Servidor**: ftp.tudominio.com
     - **Usuario**: tu_usuario_ftp
     - **Contraseña**: tu_contraseña_ftp
     - **Puerto**: 21 (FTP) o 22 (SFTP)

3. **Conectar con FileZilla**
   - Abre FileZilla
   - Ingresa las credenciales en la parte superior
   - Haz clic en "Quickconnect"

4. **Subir archivos**
   - En el panel izquierdo: Navega a la carpeta `dist` de tu proyecto
   - En el panel derecho: Navega a `public_html` o `public_www` o la carpeta raíz de tu dominio
   - **Importante**: Debes subir el **contenido** de la carpeta `dist`, NO la carpeta `dist` misma
   - Selecciona todos los archivos dentro de `dist/`
   - Arrastra los archivos al panel derecho
   - Espera a que termine la transferencia

**Estructura correcta en el servidor:**
```
public_html/              ← Raíz de tu dominio
├── index.html            ✅ Correcto
├── assets/
│   ├── index-abc123.js
│   └── ...
└── .htaccess
```

**Estructura INCORRECTA:**
```
public_html/
└── dist/                 ❌ Incorrecto - No subas la carpeta dist
    ├── index.html
    └── assets/
```

#### Opción B: File Manager del Panel de Control

1. **Acceder al File Manager**
   - Inicia sesión en tu panel de hosting
   - Busca "File Manager" o "Administrador de Archivos"
   - Abre la carpeta `public_html` o equivalente

2. **Subir archivos**
   - Haz clic en "Upload" o "Subir"
   - Selecciona todos los archivos dentro de la carpeta `dist/`
   - Espera a que termine la carga
   - Si subes un ZIP, extráelo en el servidor

3. **Verificar permisos**
   - Los archivos deben tener permisos `644`
   - Las carpetas deben tener permisos `755`

#### Opción C: Subir un ZIP y Extraer

1. **Comprimir la carpeta dist**
   - En Windows: Clic derecho en la carpeta `dist` → "Comprimir a ZIP"
   - En Mac: Clic derecho en la carpeta `dist` → "Comprimir"
   - Renombra el archivo a `build.zip`

2. **Subir el ZIP**
   - Ve al File Manager de tu hosting
   - Sube `build.zip` a `public_html`
   - Haz clic derecho en `build.zip` → "Extract" o "Extraer"
   - **Importante**: Extrae el contenido, luego mueve los archivos a la raíz de `public_html`
   - Elimina el archivo ZIP y la carpeta temporal

### Paso 5: Crear archivo .htaccess

Para que las rutas de React Router funcionen correctamente, necesitas un archivo `.htaccess`.

1. **Crear el archivo**
   - En el File Manager de tu hosting, ve a `public_html`
   - Crea un nuevo archivo llamado `.htaccess` (nota el punto al inicio)

2. **Agregar el contenido**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Si el archivo o directorio existe, servir directamente
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Redirigir todo a index.html
  RewriteRule ^ index.html [L]
</IfModule>

# Habilitar compresión GZIP
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Headers de caché para mejor rendimiento
<IfModule mod_expires.c>
  ExpiresActive On

  # Imágenes
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/x-icon "access plus 1 year"

  # CSS y JavaScript
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/javascript "access plus 1 year"

  # Fonts
  ExpiresByType font/woff "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
  ExpiresByType application/font-woff "access plus 1 year"
  ExpiresByType application/font-woff2 "access plus 1 year"

  # HTML y otros
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType application/json "access plus 0 seconds"
</IfModule>

# Seguridad adicional
<IfModule mod_headers.c>
  # Prevenir clickjacking
  Header always set X-Frame-Options "SAMEORIGIN"

  # XSS Protection
  Header always set X-XSS-Protection "1; mode=block"

  # Prevenir MIME sniffing
  Header always set X-Content-Type-Options "nosniff"

  # HSTS (solo si usas HTTPS)
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>

# Deshabilitar listado de directorios
Options -Indexes

# Proteger archivos sensibles
<FilesMatch "^\.">
  Order allow,deny
  Deny from all
</FilesMatch>
```

3. **Guardar el archivo**
   - Asegúrate de que el archivo se llame exactamente `.htaccess`
   - Debe estar en la raíz de `public_html`

### Paso 6: Configurar Variables de Entorno

**⚠️ Importante**: Las variables de entorno se compilan en el código durante el `npm run build`. Por lo tanto:

1. **Antes de construir**, asegúrate de tener el archivo `.env` configurado correctamente:

```env
VITE_FIREBASE_API_KEY=tu_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
VITE_FIREBASE_PROJECT_ID=tu_project_id_aqui
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id_aqui
VITE_FIREBASE_APP_ID=tu_app_id_aqui
```

2. **Luego ejecuta el build**:
```bash
npm run build
```

3. **Las variables quedan embebidas en el código compilado** en la carpeta `dist`

**Nota de Seguridad**: Estas variables NO son secretas porque se envían al navegador del cliente. Firebase maneja la seguridad mediante reglas en Firestore y Storage.

### Paso 7: Configurar Dominio en Firebase

Para que Firebase funcione con tu dominio, debes agregarlo a los dominios autorizados:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Haz clic en **"Add domain"**
5. Agrega tu dominio: `tudominio.com` y `www.tudominio.com`

### Paso 8: Configurar SSL/HTTPS

La mayoría de los hostings modernos ofrecen certificados SSL gratuitos:

**En Hostinger:**
1. Ve al panel de control (hPanel)
2. Busca "SSL" o "Certificados SSL"
3. Selecciona tu dominio
4. Activa "Let's Encrypt SSL" (gratuito)
5. Espera unos minutos para que se active

**En cPanel (otros hostings):**
1. Ve a "SSL/TLS Status"
2. Selecciona tu dominio
3. Haz clic en "Run AutoSSL"

**Forzar HTTPS**: El archivo `.htaccess` que creamos ya fuerza HTTPS.

### Paso 9: Verificar el Despliegue

1. Abre tu navegador
2. Visita `https://tudominio.com`
3. Verifica que la aplicación cargue correctamente
4. Prueba el login con tu cuenta de administrador
5. Verifica que puedas navegar entre páginas

---

## Método 2: VPS con Node.js

Si tienes un VPS (DigitalOcean, Linode, etc.), puedes usar un servidor web más avanzado.

### Opción A: Nginx (Recomendado)

#### Paso 1: Conectar al VPS

```bash
ssh usuario@tu-servidor-ip
```

#### Paso 2: Instalar Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# Iniciar Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Paso 3: Subir archivos

Opción 1 - Usar SCP desde tu computadora local:
```bash
# Desde tu computadora local
scp -r dist/* usuario@tu-servidor-ip:/var/www/tudominio.com/
```

Opción 2 - Usar Git:
```bash
# En el servidor
cd /var/www/
git clone <url-repositorio> tudominio.com
cd tudominio.com
npm install
npm run build
mv dist/* ./
```

#### Paso 4: Configurar Nginx

Crea el archivo de configuración:

```bash
sudo nano /etc/nginx/sites-available/tudominio.com
```

Agrega esta configuración:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tudominio.com www.tudominio.com;

    root /var/www/tudominio.com;
    index index.html;

    # Logs
    access_log /var/log/nginx/tudominio.com.access.log;
    error_log /var/log/nginx/tudominio.com.error.log;

    # Compresión GZIP
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;

    # Caché para assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA - Redirigir todo a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Paso 5: Habilitar el sitio

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/tudominio.com /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### Paso 6: Instalar SSL con Certbot

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (ya viene configurada)
sudo certbot renew --dry-run
```

### Opción B: Apache

Si prefieres Apache en tu VPS:

```bash
# Instalar Apache
sudo apt update
sudo apt install apache2 -y

# Habilitar mod_rewrite
sudo a2enmod rewrite
sudo systemctl restart apache2

# Subir archivos a /var/www/html/
# Usar el mismo .htaccess del Método 1
```

---

## Configuración de Hostinger Específica

### Panel hPanel de Hostinger

1. **Acceso al Panel**
   - Inicia sesión en [hostinger.com](https://www.hostinger.com/)
   - Ve a "Hosting" → Selecciona tu plan
   - Haz clic en "Administrar"

2. **File Manager**
   - En el panel, busca "File Manager"
   - Navega a `public_html` (o `domains/tudominio.com/public_html`)
   - Sube los archivos de la carpeta `dist`

3. **Configurar SSL**
   - En el panel, busca "SSL"
   - Selecciona tu dominio
   - Activa "Force HTTPS" si está disponible

4. **Configurar Dominio**
   - Ve a "Dominios"
   - Asegúrate de que tu dominio esté apuntando correctamente
   - Espera a que la propagación DNS termine (puede tardar hasta 24 horas)

5. **PHP y Node.js**
   - No necesitas configurar PHP o Node.js para este proyecto
   - Es solo archivos estáticos

### Hostinger Premium/Business

Si tienes un plan superior:

1. **SSH Access**
   ```bash
   ssh u123456789@tudominio.com
   ```

2. **Git Deployment**
   ```bash
   cd domains/tudominio.com/public_html
   git clone <tu-repositorio> temp
   cd temp
   npm install
   npm run build
   mv dist/* ../
   cd ..
   rm -rf temp
   ```

---

## Configuración de .htaccess

Este archivo es crucial para que la aplicación funcione correctamente.

### .htaccess Básico (Mínimo Necesario)

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
```

### .htaccess Completo (Recomendado)

Ya se proporcionó en el Paso 5 del Método 1.

### Solución de Problemas con .htaccess

**Error 500 Internal Server Error**:
- Puede ser que tu hosting no soporte alguna directiva
- Prueba con el .htaccess básico primero
- Contacta al soporte de tu hosting

**Las rutas no funcionan (404 en refrescar)**:
- Verifica que `mod_rewrite` esté habilitado
- Asegúrate de que el archivo se llame exactamente `.htaccess`
- Verifica los permisos del archivo (644)

---

## Configuración de Dominio

### Si tu dominio está en otro proveedor

1. **Obtener la dirección IP o nameservers de tu hosting**
   - En Hostinger: Ve a "Información de Hosting" en el panel
   - Anota la IP del servidor o los nameservers

2. **Configurar DNS**
   - Ve al panel de tu proveedor de dominio (GoDaddy, Namecheap, etc.)
   - Busca "DNS Management" o "Administración DNS"

   **Opción A - Cambiar Nameservers (Recomendado)**:
   ```
   ns1.dns-parking.com
   ns2.dns-parking.com
   (Usa los nameservers de tu hosting)
   ```

   **Opción B - Agregar registro A**:
   ```
   Tipo: A
   Nombre: @
   Valor: 123.45.67.89 (IP de tu servidor)
   TTL: 3600

   Tipo: A
   Nombre: www
   Valor: 123.45.67.89
   TTL: 3600
   ```

3. **Esperar propagación DNS**
   - Puede tardar de 1 a 48 horas
   - Verifica en [whatsmydns.net](https://www.whatsmydns.net/)

---

## Verificación y Pruebas

### Lista de Verificación Post-Despliegue

- [ ] La aplicación carga en `https://tudominio.com`
- [ ] El certificado SSL está activo (candado verde en el navegador)
- [ ] No hay errores en la consola del navegador (F12)
- [ ] Puedes navegar entre páginas sin errores 404
- [ ] Puedes iniciar sesión con tu cuenta
- [ ] El dashboard carga datos correctamente
- [ ] Las imágenes se cargan correctamente
- [ ] Los estilos (Tailwind) se aplican correctamente
- [ ] El favicon aparece en la pestaña del navegador

### Pruebas de Funcionalidad

1. **Autenticación**
   - Login funciona
   - Logout funciona
   - Redirección correcta después del login

2. **Navegación**
   - Todas las rutas funcionan
   - Refrescar la página no da 404
   - Los enlaces internos funcionan

3. **Firebase**
   - Datos se cargan desde Firestore
   - Puedes crear/editar/eliminar datos
   - Las imágenes se cargan desde Firebase Storage

4. **Rendimiento**
   - La página carga en menos de 3 segundos
   - Los assets están comprimidos (GZIP)
   - El caché funciona correctamente

---

## Solución de Problemas

### Problema: Página en blanco

**Posibles causas y soluciones**:

1. **Ruta incorrecta en el build**
   - Verifica en `vite.config.js` que no haya una `base` incorrecta
   - Debería ser: `base: '/'` o no estar definida

2. **Archivos no subidos correctamente**
   - Verifica que `index.html` esté en la raíz de `public_html`
   - Verifica que la carpeta `assets` esté presente

3. **Errores de JavaScript**
   - Abre la consola del navegador (F12)
   - Busca errores rojos
   - Puede ser un problema con las variables de Firebase

4. **Variables de entorno no configuradas**
   - Reconstruye localmente con el `.env` correcto
   - Vuelve a subir los archivos

### Problema: Error 404 al refrescar página

**Causa**: El archivo `.htaccess` no está funcionando

**Soluciones**:
1. Verifica que el archivo se llame `.htaccess` (con punto al inicio)
2. Verifica que esté en la raíz correcta (`public_html`)
3. Verifica los permisos (644)
4. Contacta a soporte para verificar que `mod_rewrite` esté habilitado

### Problema: Error 500 Internal Server Error

**Causa**: Error en el archivo `.htaccess`

**Soluciones**:
1. Usa el `.htaccess` básico
2. Elimina directivas una por una hasta encontrar la problemática
3. Revisa los logs de errores del servidor (en el panel de hosting)

### Problema: "Firebase no conecta" o "Network Error"

**Soluciones**:

1. **Autoriza tu dominio en Firebase**:
   - Firebase Console → Authentication → Settings → Authorized domains
   - Agrega `tudominio.com`

2. **Verifica las variables de entorno**:
   - Imprime las variables en la consola temporalmente:
   ```javascript
   console.log(import.meta.env.VITE_FIREBASE_API_KEY);
   ```
   - Si sale `undefined`, reconstruye con el `.env` correcto

3. **Verifica las reglas de Firestore**:
   - Asegúrate de que permitan lectura/escritura a usuarios autenticados

4. **CORS**: Generalmente no es un problema con Firebase, pero verifica que uses HTTPS

### Problema: Los estilos no se cargan (Tailwind no funciona)

**Causa**: Archivos CSS no se cargaron o ruta incorrecta

**Soluciones**:
1. Verifica que la carpeta `assets` esté subida
2. Abre el inspector (F12) → Network y busca archivos `.css` con error 404
3. Verifica que el build se haya hecho correctamente
4. Reconstruye y vuelve a subir

### Problema: Las imágenes no cargan

**Soluciones**:
1. Verifica que las imágenes se estén sirviendo desde Firebase Storage (no locales)
2. Verifica las reglas de Storage en Firebase
3. Verifica que las URLs de las imágenes sean completas (https://...)

### Problema: "Permisos denegados" al subir archivos

**Soluciones**:
1. Verifica tus credenciales FTP
2. Verifica que estés en la carpeta correcta
3. Contacta al soporte de tu hosting

### Problema: El sitio es lento

**Soluciones**:
1. Activa compresión GZIP (ya está en el `.htaccess`)
2. Activa el SSL/HTTPS
3. Optimiza las imágenes antes de subirlas a Firebase Storage
4. Verifica que el caché funcione (headers en `.htaccess`)
5. Considera usar un CDN como Cloudflare (gratis)

---

## Actualizaciones Futuras

### Proceso para Actualizar la Aplicación

1. **Hacer cambios en el código localmente**

2. **Probar localmente**
   ```bash
   npm run dev
   # Verifica que todo funcione
   ```

3. **Reconstruir**
   ```bash
   npm run build
   ```

4. **Subir solo los archivos cambiados**
   - Conecta con FileZilla
   - Sube solo los archivos de la carpeta `dist` que cambiaron
   - O elimina todo en `public_html` y sube todo de nuevo

5. **Limpiar caché del navegador**
   - Ctrl + F5 (Windows) o Cmd + Shift + R (Mac)
   - O abre en modo incógnito para verificar

### Script de Despliegue Automático (Avanzado)

Si tienes acceso SSH, puedes crear un script:

```bash
#!/bin/bash
# deploy.sh

# Configuración
REMOTE_USER="tu_usuario"
REMOTE_HOST="tu_servidor"
REMOTE_PATH="/home/tu_usuario/public_html"

# Build local
echo "Building..."
npm run build

# Subir archivos
echo "Uploading..."
rsync -avz --delete dist/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

echo "Deploy complete!"
```

Uso:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Mejores Prácticas

### 1. Backups Regulares

- Haz backup de tu base de datos Firebase regularmente
- Descarga una copia de los archivos del servidor mensualmente
- Guarda una copia local del código fuente siempre

### 2. Monitoreo

- Configura alertas en Firebase Console
- Revisa los logs del servidor regularmente
- Monitorea el uso de ancho de banda

### 3. Seguridad

- Mantén las credenciales seguras
- Usa contraseñas fuertes para FTP/SSH
- Actualiza las reglas de Firebase regularmente
- Revisa los logs de autenticación en Firebase

### 4. Rendimiento

- Optimiza imágenes antes de subirlas a Firebase Storage
- Usa formatos modernos (WebP) cuando sea posible
- Activa compresión GZIP
- Considera usar Cloudflare para CDN y caché adicional

### 5. SEO (Opcional)

Para mejorar el SEO, puedes:
- Editar el `index.html` para agregar meta tags
- Agregar un `robots.txt`
- Agregar un `sitemap.xml`
- Usar Firebase Dynamic Links para compartir

---

## Comparación: Hostinger vs Otros Servicios

| Característica | Hostinger | Firebase Hosting | Vercel/Netlify |
|---------------|-----------|------------------|----------------|
| Costo | $2-10/mes | Gratis/Pago uso | Gratis generoso |
| SSL | ✅ Gratuito | ✅ Automático | ✅ Automático |
| CDN | ❌ No incluido | ✅ Global | ✅ Global |
| Configuración | Manual | Automática | Automática |
| Velocidad | Media | Rápida | Rápida |
| Despliegue | Manual FTP | CLI/CI/CD | Git Auto |
| Soporte | Email/Chat | Docs | Docs/Comunidad |

**Recomendación**:
- Si ya tienes hosting: Usa Hostinger (o el que tengas)
- Si es nuevo proyecto: Considera Firebase Hosting, Vercel o Netlify (más fácil y rápido)

---

## Recursos Adicionales

### Documentación
- [Hostinger Knowledge Base](https://support.hostinger.com/)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)
- [Firebase Console](https://console.firebase.google.com/)

### Herramientas Útiles
- [FileZilla](https://filezilla-project.org/) - Cliente FTP
- [WinSCP](https://winscp.net/) - Cliente FTP/SFTP para Windows
- [Cyberduck](https://cyberduck.io/) - Cliente FTP para Mac
- [whatsmydns.net](https://www.whatsmydns.net/) - Verificar DNS
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html) - Verificar SSL

### Soporte
- **Hostinger**: [support.hostinger.com](https://support.hostinger.com/)
- **Firebase**: [Documentación](https://firebase.google.com/docs)
- **Comunidad**: Stack Overflow, Reddit r/webdev

---

## Resumen de Comandos Rápidos

```bash
# Build local
npm run build

# Preview local
npm run preview

# Subir con rsync (si tienes SSH)
rsync -avz --delete dist/ usuario@servidor:/ruta/public_html/

# Subir con SCP
scp -r dist/* usuario@servidor:/ruta/public_html/

# Conectar SSH
ssh usuario@servidor
```

---

**¿Necesitas ayuda específica con tu hosting?** Consulta el soporte de tu proveedor o la documentación oficial de Hostinger.

**¡Tu aplicación ya está lista para producción!** 🚀
