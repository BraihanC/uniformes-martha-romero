# Uniformes Martha Romero - Sistema POS

Sistema de Punto de Venta (POS) y gestión integral para tienda de uniformes colegiales.

## Características

- Sistema de autenticación con roles (Administrador/Vendedor)
- Dashboard con KPIs en tiempo real
- Punto de Venta (POS) con soporte para lector de códigos de barras
- Gestión de inventario con stock complejo (Total, Reservado Pedidos, Reservado Apartados)
- Gestión de clientes
- Sistema de pedidos de producción
- Sistema de apartados de stock existente
- Gestión de devoluciones y cambios
- Reportes (solo administradores)
- Configuración del sistema (solo administradores)
- Diseño responsive (Desktop, Tablet, Mobile)

## Tecnologías

- **Frontend**: React 18 + Vite
- **Estilos**: Tailwind CSS
- **Backend & Base de Datos**: Firebase (Authentication, Firestore, Storage)
- **Enrutamiento**: React Router DOM
- **Gráficos**: Recharts
- **Excel**: xlsx.js

## Requisitos Previos

- Node.js 18+ y npm
- Cuenta de Firebase (gratis)
- Navegador web moderno

## Instalación

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Configurar Firebase**

   Sigue la guía detallada en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```

   Edita `.env` y añade tus credenciales de Firebase

4. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**

   Visita `http://localhost:5173`

## Guía de Instalación Detallada para Windows

### Paso 1: Instalar Node.js

1. **Descargar Node.js**
   - Visita [https://nodejs.org/](https://nodejs.org/)
   - Descarga la versión **LTS (Long Term Support)** recomendada (debe ser 18 o superior)
   - Descarga el instalador para Windows (archivo `.msi`)

2. **Ejecutar el instalador**
   - Haz doble clic en el archivo descargado
   - Sigue el asistente de instalación:
     - Acepta los términos de licencia
     - Deja la ruta de instalación por defecto (normalmente `C:\Program Files\nodejs\`)
     - Asegúrate de marcar la opción **"Automatically install the necessary tools"**
     - Haz clic en "Next" y luego en "Install"
   - Espera a que termine la instalación y haz clic en "Finish"

3. **Verificar la instalación**
   - Abre **PowerShell** o **Símbolo del sistema (CMD)**
     - Presiona `Windows + R`
     - Escribe `powershell` o `cmd` y presiona Enter
   - Ejecuta los siguientes comandos para verificar:
     ```bash
     node --version
     npm --version
     ```
   - Deberías ver las versiones instaladas (ejemplo: `v20.11.0` y `10.2.4`)

### Paso 2: Instalar Git (Opcional pero recomendado)

1. **Descargar Git**
   - Visita [https://git-scm.com/download/win](https://git-scm.com/download/win)
   - Descarga el instalador para Windows

2. **Ejecutar el instalador**
   - Acepta las opciones por defecto
   - En "Choosing the default editor", puedes seleccionar tu editor preferido

3. **Verificar instalación**
   ```bash
   git --version
   ```

### Paso 3: Descargar el Proyecto

**Opción A: Con Git (Recomendado)**
```bash
git clone <url-del-repositorio>
cd uniformes-martha-romero
```

**Opción B: Sin Git**
1. Descarga el proyecto como ZIP desde el repositorio
2. Extrae el archivo ZIP en una carpeta de tu preferencia
3. Abre PowerShell o CMD
4. Navega a la carpeta del proyecto:
   ```bash
   cd ruta\a\la\carpeta\uniformes-martha-romero
   ```
   Ejemplo: `cd C:\Users\TuUsuario\Documentos\uniformes-martha-romero`

### Paso 4: Instalar las Dependencias del Proyecto

1. **Abrir la terminal en la carpeta del proyecto**
   - Si ya estás en la carpeta, continúa
   - O puedes abrir la carpeta en el Explorador de Windows, hacer clic derecho y seleccionar **"Abrir en Terminal"** o **"Open PowerShell window here"**

2. **Instalar dependencias**
   ```bash
   npm install
   ```
   - Este proceso puede tardar varios minutos
   - Verás que se crea una carpeta llamada `node_modules`
   - Espera a que termine completamente (verás un mensaje indicando el número de paquetes instalados)

### Paso 5: Configurar Firebase

1. **Crear proyecto en Firebase**
   - Sigue todos los pasos detallados en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
   - Necesitarás crear una cuenta de Google si no tienes una
   - El proceso te dará las credenciales necesarias para el siguiente paso

### Paso 6: Configurar Variables de Entorno

1. **Copiar el archivo de ejemplo**

   En PowerShell:
   ```powershell
   copy .env.example .env
   ```

   O en CMD:
   ```cmd
   copy .env.example .env
   ```

2. **Editar el archivo `.env`**
   - Abre el archivo `.env` con un editor de texto (Notepad, Notepad++, VS Code, etc.)
   - Reemplaza los valores de ejemplo con tus credenciales de Firebase que obtuviste en el Paso 5

   Ejemplo:
   ```
   VITE_FIREBASE_API_KEY=tu_api_key_aqui
   VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
   VITE_FIREBASE_PROJECT_ID=tu_project_id_aqui
   VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id_aqui
   VITE_FIREBASE_APP_ID=tu_app_id_aqui
   ```

   - Guarda el archivo (Ctrl + S)

### Paso 7: Ejecutar el Proyecto

1. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

2. **Verificar que está corriendo**
   - Verás un mensaje en la terminal indicando:
     ```
     VITE v5.x.x  ready in XXX ms

     ➜  Local:   http://localhost:5173/
     ➜  Network: use --host to expose
     ```

3. **Abrir en el navegador**
   - Abre tu navegador web (Chrome, Firefox, Edge, etc.)
   - Visita: `http://localhost:5173`
   - Deberías ver la página de login del sistema POS

### Paso 8: Detener el Servidor

- Para detener el servidor de desarrollo, presiona `Ctrl + C` en la terminal
- Te preguntará si deseas terminar el proceso, escribe `S` (Sí) y presiona Enter

### Solución de Problemas Comunes en Windows

**Error: "npm no se reconoce como comando"**
- Cierra y vuelve a abrir la terminal después de instalar Node.js
- O reinicia tu computadora
- Verifica que Node.js se instaló correctamente ejecutando `node --version`

**Error: "Puerto 5173 ya en uso"**
- Otro programa está usando ese puerto
- Presiona `Ctrl + C` para detener cualquier servidor anterior
- O cambia el puerto en el archivo `vite.config.js`

**Error de permisos al instalar dependencias**
- Abre PowerShell o CMD **como Administrador**
- Clic derecho en el ícono de PowerShell/CMD y selecciona "Ejecutar como administrador"

**La aplicación no carga datos**
- Verifica que configuraste correctamente el archivo `.env`
- Revisa que completaste la configuración de Firebase en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- Abre la consola del navegador (F12) para ver posibles errores

**Error: "Scripts deshabilitados" en PowerShell**
- PowerShell puede tener restricciones de ejecución de scripts
- Ejecuta este comando en PowerShell como Administrador:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- Luego intenta nuevamente ejecutar `npm run dev`

## Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza el build de producción

## Despliegue a Producción

Para desplegar la aplicación a producción, consulta las guías detalladas:

### [DEPLOYMENT.md](./DEPLOYMENT.md) - Plataformas en la Nube
Instrucciones paso a paso para:
- **Firebase Hosting** (Recomendado)
- **Vercel**
- **Netlify**

### [DEPLOYMENT_HOSTINGER.md](./DEPLOYMENT_HOSTINGER.md) - Hosting Tradicional
Guía completa para:
- **Hostinger, GoDaddy, Bluehost** (Hosting compartido)
- **VPS con Nginx/Apache**
- **Configuración FTP/FileZilla**
- **Configuración de .htaccess y SSL**

## Paleta de Colores

- **Primario (Magenta)**: #D50565
- **Acento (Naranja)**: #EA5C2E
- **Fondo Beige**: #FFF1E5
- **Fondo Azul (Sidebar)**: #C5D6EF

## Roles de Usuario

### Administrador
Acceso completo incluyendo Reportes y Configuración

### Vendedor
Acceso limitado (sin Reportes ni Configuración)

## Lógica de Inventario

- **Stock Total**: Total de unidades físicas
- **Stock Reservado (Pedidos)**: Unidades en producción
- **Stock Reservado (Apartados)**: Unidades apartadas
- **Stock Disponible**: Total - Res.Pedidos - Res.Apartados

---

**Desarrollado para Uniformes Martha Romero**
