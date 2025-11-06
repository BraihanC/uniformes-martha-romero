# Guía de Despliegue - Uniformes Martha Romero

Esta guía te ayudará a desplegar el sistema POS en producción. El proyecto está construido con Vite + React y usa Firebase como backend.

## Opciones de Despliegue

### Plataformas en la Nube (Recomendadas)
Las siguientes opciones son ideales para aplicaciones modernas, ofrecen despliegue automático y CDN global:

- **Firebase Hosting** (Recomendado) - Integración perfecta con Firebase
- **Vercel** - Despliegue automático desde Git
- **Netlify** - Excelente para proyectos JAMstack

👉 **Instrucciones en esta guía** (ver índice abajo)

### Hosting Tradicional (Hostinger, cPanel, etc.)
Si prefieres usar hosting compartido o VPS tradicional:

📄 **[Ver guía completa para Hostinger y otros hostings →](./DEPLOYMENT_HOSTINGER.md)**

Esta guía incluye:
- Despliegue en hosting compartido (Hostinger, GoDaddy, Bluehost, etc.)
- Configuración de VPS con Nginx/Apache
- Configuración de .htaccess
- Subida de archivos vía FTP/FileZilla
- Configuración de SSL y dominios

---

## Índice

1. [Preparación Previa](#preparación-previa)
2. [Opción 1: Firebase Hosting (Recomendado)](#opción-1-firebase-hosting-recomendado)
3. [Opción 2: Vercel](#opción-2-vercel)
4. [Opción 3: Netlify](#opción-3-netlify)
5. [Verificación Post-Despliegue](#verificación-post-despliegue)
6. [Solución de Problemas](#solución-de-problemas)
7. [Actualizaciones Futuras](#actualizaciones-futuras)

---

## Preparación Previa

Antes de desplegar, asegúrate de completar estos pasos:

### 1. Configuración de Firebase Completa

Verifica que hayas completado todos los pasos en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md):

- ✅ Proyecto Firebase creado
- ✅ Authentication habilitado (Email/Password)
- ✅ Firestore Database creado
- ✅ Storage configurado
- ✅ Reglas de seguridad aplicadas
- ✅ Usuario administrador creado

### 2. Variables de Entorno

Asegúrate de tener configurado correctamente el archivo `.env` con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 3. Prueba Local del Build

Antes de desplegar, verifica que el build funcione correctamente:

```bash
# Construir la aplicación
npm run build

# Previsualizar el build
npm run preview
```

Abre `http://localhost:4173` y verifica que todo funcione correctamente.

---

## Opción 1: Firebase Hosting (Recomendado)

Firebase Hosting es la opción recomendada porque tu backend ya está en Firebase, lo que garantiza mejor integración y rendimiento.

### Ventajas
- ✅ CDN global incluido
- ✅ SSL/HTTPS automático
- ✅ Dominio personalizado gratuito
- ✅ Integración perfecta con Firebase
- ✅ Plan gratuito generoso

### Paso 1: Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

### Paso 2: Iniciar Sesión en Firebase

```bash
firebase login
```

Esto abrirá tu navegador para que inicies sesión con tu cuenta de Google.

### Paso 3: Inicializar Firebase Hosting

En la carpeta raíz del proyecto, ejecuta:

```bash
firebase init hosting
```

Responde a las preguntas del asistente:

1. **"Please select an option"**: Selecciona `Use an existing project`
2. **"Select a default Firebase project"**: Selecciona tu proyecto
3. **"What do you want to use as your public directory?"**: Escribe `dist`
4. **"Configure as a single-page app (rewrite all urls to /index.html)?"**: Escribe `y` (Yes)
5. **"Set up automatic builds and deploys with GitHub?"**: Escribe `n` (No) por ahora
6. **"File dist/index.html already exists. Overwrite?"**: Escribe `N` (No)

Esto creará dos archivos:
- `firebase.json` - Configuración de Firebase Hosting
- `.firebaserc` - Referencia al proyecto

### Paso 4: Configurar firebase.json

Abre `firebase.json` y asegúrate de que tenga esta configuración:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### Paso 5: Construir y Desplegar

```bash
# Construir la aplicación
npm run build

# Desplegar a Firebase Hosting
firebase deploy --only hosting
```

### Paso 6: Verificar el Despliegue

Al finalizar, verás un mensaje como:

```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/tu-proyecto/overview
Hosting URL: https://tu-proyecto.web.app
```

Visita la URL de Hosting para verificar que tu aplicación esté funcionando.

### Configurar Dominio Personalizado (Opcional)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Hosting** en el menú lateral
4. Haz clic en **"Add custom domain"**
5. Sigue las instrucciones para configurar tu dominio

---

## Opción 2: Vercel

Vercel es excelente para proyectos React/Vite y ofrece despliegues rápidos.

### Ventajas
- ✅ Despliegue automático desde Git
- ✅ Preview deployments para pull requests
- ✅ SSL automático
- ✅ CDN global
- ✅ Plan gratuito generoso

### Método 1: Despliegue desde GitHub (Recomendado)

#### Paso 1: Subir el Código a GitHub

Si aún no lo has hecho:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <URL-de-tu-repositorio>
git push -u origin main
```

#### Paso 2: Conectar Vercel

1. Ve a [vercel.com](https://vercel.com) y crea una cuenta (puedes usar GitHub)
2. Haz clic en **"Add New Project"**
3. Importa tu repositorio de GitHub
4. Configura el proyecto:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### Paso 3: Configurar Variables de Entorno

En la sección **"Environment Variables"**, añade todas tus variables de Firebase:

```
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

#### Paso 4: Desplegar

Haz clic en **"Deploy"**. Vercel construirá y desplegará automáticamente tu aplicación.

### Método 2: Despliegue desde CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Desplegar
vercel

# Para producción
vercel --prod
```

---

## Opción 3: Netlify

Otra excelente opción para hosting de aplicaciones React.

### Ventajas
- ✅ Despliegue automático desde Git
- ✅ SSL automático
- ✅ CDN global
- ✅ Formularios y funciones serverless
- ✅ Plan gratuito generoso

### Método 1: Despliegue desde GitHub

#### Paso 1: Subir a GitHub (si aún no lo has hecho)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <URL-de-tu-repositorio>
git push -u origin main
```

#### Paso 2: Conectar Netlify

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Conecta tu cuenta de GitHub y selecciona el repositorio
4. Configura el build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

#### Paso 3: Configurar Variables de Entorno

1. Ve a **Site settings** → **Environment variables**
2. Añade todas tus variables de Firebase:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

#### Paso 4: Crear netlify.toml

Crea un archivo `netlify.toml` en la raíz del proyecto:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Commit y push este archivo:

```bash
git add netlify.toml
git commit -m "Add Netlify configuration"
git push
```

Netlify desplegará automáticamente.

### Método 2: Despliegue Manual (Drag & Drop)

1. Ejecuta `npm run build` localmente
2. Ve a [netlify.com](https://netlify.com)
3. Arrastra la carpeta `dist` a la zona de "Drag and drop"
4. Configura las variables de entorno en **Site settings**

⚠️ **Nota**: Con el método manual, deberás re-desplegar manualmente cada vez que hagas cambios.

### Método 3: Netlify CLI

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Inicializar
netlify init

# Desplegar
netlify deploy --prod
```

---

## Verificación Post-Despliegue

Después de desplegar, verifica que todo funcione correctamente:

### 1. Verificaciones Básicas

- [ ] La aplicación carga correctamente
- [ ] Los estilos se muestran correctamente
- [ ] No hay errores en la consola del navegador (F12)
- [ ] El favicon se muestra

### 2. Verificar Firebase

- [ ] Puedes iniciar sesión con tu cuenta de administrador
- [ ] El dashboard carga los datos correctamente
- [ ] Puedes navegar entre las diferentes secciones

### 3. Verificar Funcionalidades Críticas

- [ ] **Autenticación**: Login/Logout funciona
- [ ] **Dashboard**: Los KPIs se cargan
- [ ] **POS**: Se pueden registrar ventas
- [ ] **Inventario**: Se pueden ver y editar productos
- [ ] **Clientes**: CRUD de clientes funciona
- [ ] **Pedidos y Apartados**: Se pueden crear correctamente

### 4. Verificar Permisos

- [ ] Los usuarios vendedores NO ven Reportes ni Configuración
- [ ] Los administradores tienen acceso completo

### 5. Pruebas de Rendimiento

- [ ] La aplicación carga en menos de 3 segundos
- [ ] Las imágenes cargan correctamente
- [ ] No hay problemas de CORS

---

## Solución de Problemas

### Problema: Página en blanco después del despliegue

**Soluciones**:

1. **Verifica la consola del navegador (F12)** para ver errores
2. **Revisa las variables de entorno**: Asegúrate de que todas las variables `VITE_FIREBASE_*` estén configuradas
3. **Verifica la configuración de rutas**:
   - En Firebase Hosting: Verifica las `rewrites` en `firebase.json`
   - En Vercel/Netlify: Verifica la configuración de SPA

### Problema: Error 404 al recargar la página

**Causa**: Falta configuración para SPA (Single Page Application)

**Soluciones**:
- **Firebase**: Asegúrate de tener las `rewrites` en `firebase.json`
- **Vercel**: Debería funcionar automáticamente con el preset de Vite
- **Netlify**: Asegúrate de tener los `redirects` en `netlify.toml`

### Problema: Firebase no conecta

**Soluciones**:

1. **Verifica las variables de entorno**:
   ```bash
   # En desarrollo local
   cat .env

   # En producción, verifica en el panel de tu plataforma
   ```

2. **Autoriza el dominio en Firebase**:
   - Ve a [Firebase Console](https://console.firebase.google.com/)
   - Selecciona tu proyecto
   - Ve a **Authentication** → **Settings** → **Authorized domains**
   - Añade tu dominio de producción (ej: `tu-proyecto.web.app`, `tu-dominio.vercel.app`)

3. **Verifica las reglas de Firestore y Storage**:
   - Asegúrate de que las reglas permitan operaciones con usuarios autenticados

### Problema: Estilos no se cargan

**Soluciones**:

1. **Verifica el build**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Limpia la caché**:
   ```bash
   rm -rf node_modules
   rm -rf dist
   npm install
   npm run build
   ```

3. **Verifica Tailwind CSS**: Asegúrate de que `tailwind.config.js` esté correctamente configurado

### Problema: Variables de entorno no funcionan

**Importante**: En Vite, las variables de entorno DEBEN tener el prefijo `VITE_`

```env
# ✅ Correcto
VITE_FIREBASE_API_KEY=abc123

# ❌ Incorrecto
FIREBASE_API_KEY=abc123
```

---

## Actualizaciones Futuras

### Actualizar en Firebase Hosting

```bash
# 1. Hacer cambios en el código
# 2. Commit (opcional)
git add .
git commit -m "Descripción de cambios"

# 3. Construir
npm run build

# 4. Desplegar
firebase deploy --only hosting
```

### Actualizar en Vercel

**Si usas GitHub**:
```bash
git add .
git commit -m "Descripción de cambios"
git push
```
Vercel desplegará automáticamente.

**Si usas CLI**:
```bash
vercel --prod
```

### Actualizar en Netlify

**Si usas GitHub**:
```bash
git add .
git commit -m "Descripción de cambios"
git push
```
Netlify desplegará automáticamente.

**Si usas CLI**:
```bash
netlify deploy --prod
```

---

## Mejores Prácticas

### 1. Usa Variables de Entorno

Nunca expongas credenciales en el código. Siempre usa variables de entorno.

### 2. Configura CI/CD

Para proyectos serios, configura despliegue automático:
- **GitHub Actions** para Firebase
- **Vercel/Netlify** tienen CI/CD integrado

### 3. Prueba Antes de Desplegar

```bash
npm run build
npm run preview
```

### 4. Monitorea tu Aplicación

- Usa **Firebase Analytics** para monitorear uso
- Configura **Firebase Performance Monitoring**
- Revisa los logs de errores en la consola de tu plataforma

### 5. Backups

- Firebase hace backups automáticos de Firestore
- Considera exportar datos regularmente:
  ```bash
  gcloud firestore export gs://[BUCKET_NAME]
  ```

### 6. Seguridad

- Mantén las dependencias actualizadas: `npm audit`
- Revisa las reglas de seguridad de Firebase regularmente
- Usa HTTPS siempre (automático en todas las plataformas)

---

## Costos Estimados

### Firebase Hosting
- **Plan Spark (Gratuito)**:
  - 10 GB almacenamiento
  - 360 MB/día transferencia
  - Suficiente para proyectos pequeños/medianos

- **Plan Blaze (Pago por uso)**:
  - $0.026 por GB almacenamiento/mes
  - $0.15 por GB transferencia

### Vercel
- **Plan Hobby (Gratuito)**:
  - 100 GB transferencia/mes
  - Builds ilimitados
  - Ideal para proyectos pequeños/medianos

### Netlify
- **Plan Starter (Gratuito)**:
  - 100 GB transferencia/mes
  - 300 minutos build/mes
  - Ideal para proyectos pequeños/medianos

---

## Recursos Adicionales

- [Documentación Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Documentación Vercel](https://vercel.com/docs)
- [Documentación Netlify](https://docs.netlify.com/)
- [Documentación Vite](https://vitejs.dev/guide/build.html)

---

**¿Necesitas ayuda?** Consulta la documentación oficial de cada plataforma o contacta al equipo de desarrollo.
