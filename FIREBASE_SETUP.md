# Firebase Setup Guide - Uniformes Martha Romero POS

This guide will walk you through setting up Firebase for the Uniformes Martha Romero POS system.

## Step 1: Create a Firebase Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your Google account (or create one if you don't have it)

## Step 2: Create a New Firebase Project

1. Click on "Add project" or "Create a project"
2. Enter project name: `uniformes-martha-romero` (or your preferred name)
3. Click "Continue"
4. Disable Google Analytics (optional, but recommended for simplicity)
5. Click "Create project"
6. Wait for the project to be created, then click "Continue"

## Step 3: Register Your Web App

1. In the Firebase Console, click on the Web icon (</>) to add a web app
2. Enter app nickname: `POS Web App`
3. Check "Also set up Firebase Hosting" (optional but recommended)
4. Click "Register app"
5. **IMPORTANT**: Copy the Firebase configuration object - you'll need this later
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "uniformes-martha-romero.firebaseapp.com",
     projectId: "uniformes-martha-romero",
     storageBucket: "uniformes-martha-romero.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc..."
   };
   ```
6. Click "Continue to console"

## Step 4: Enable Authentication

1. In the left sidebar, click on "Build" > "Authentication"
2. Click "Get started"
3. Click on "Sign-in method" tab
4. Click on "Email/Password"
5. Enable "Email/Password" (first toggle)
6. Click "Save"

## Step 5: Create Firestore Database

1. In the left sidebar, click on "Build" > "Firestore Database"
2. Click "Create database"
3. Select "Start in production mode" (we'll set up security rules later)
4. Choose a Cloud Firestore location (select the one closest to your users, e.g., `us-central1` for USA, `southamerica-east1` for Brazil/South America)
5. Click "Enable"

## Step 6: Set Up Firestore Security Rules

1. Once your database is created, click on the "Rules" tab
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user is admin
    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection - only admins can write
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Products collection
    match /products/{productId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Clients collection
    match /clients/{clientId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Sales collection
    match /sales/{saleId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAdmin();
    }

    // Pedidos collection
    match /pedidos/{pedidoId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Apartados collection
    match /apartados/{apartadoId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Devoluciones collection
    match /devoluciones/{devolucionId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Config collection - only admins
    match /config/{document} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Colegios collection
    match /colegios/{colegioId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

3. Click "Publish"

## Step 7: Enable Firebase Storage

1. In the left sidebar, click on "Build" > "Storage"
2. Click "Get started"
3. Keep the default security rules (we'll update them later)
4. Click "Next"
5. Choose the same location as your Firestore database
6. Click "Done"

## Step 8: Set Up Storage Security Rules

1. Click on the "Rules" tab in Storage
2. Replace with the following rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile photos - authenticated users can upload their own
    match /profile-photos/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Company logo - only admins can upload
    match /company/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                      get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

3. Click "Publish"

## Step 9: Create Your First Admin User

1. In Firebase Console, go to "Authentication" > "Users"
2. Click "Add user"
3. Enter email: `admin@martharomero.com` (or your preferred admin email)
4. Enter password: Create a secure password
5. Click "Add user"
6. Copy the User UID (you'll need it for the next step)

## Step 10: Set User Role in Firestore

1. Go to "Firestore Database"
2. Click "Start collection"
3. Collection ID: `users`
4. Click "Next"
5. Document ID: Paste the User UID you copied in Step 9
6. Add fields:
   - Field: `email`, Type: string, Value: `admin@martharomero.com`
   - Field: `role`, Type: string, Value: `admin`
   - Field: `displayName`, Type: string, Value: `Administrator`
   - Field: `createdAt`, Type: timestamp, Value: (current timestamp)
7. Click "Save"

## Step 11: Initialize Company Configuration

1. In Firestore Database, click "Start collection"
2. Collection ID: `config`
3. Click "Next"
4. Document ID: `company`
5. Add fields:
   - Field: `name`, Type: string, Value: `Uniformes Martha Romero`
   - Field: `nit`, Type: string, Value: `Your NIT here`
   - Field: `address`, Type: string, Value: `Your address`
   - Field: `phone`, Type: string, Value: `Your phone`
   - Field: `logoUrl`, Type: string, Value: `` (empty for now)
   - Field: `invoiceFooter`, Type: string, Value: `Gracias por su compra`
   - Field: `ivaPercentage`, Type: number, Value: `19`
   - Field: `lowStockThreshold`, Type: number, Value: `5`
6. Click "Save"

## Step 12: Configure Environment Variables Locally

1. In your project root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in the values from Step 3:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=uniformes-martha-romero.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=uniformes-martha-romero
   VITE_FIREBASE_STORAGE_BUCKET=uniformes-martha-romero.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc...
   ```

3. Save the file

## Step 13: Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:5173`

3. You should see the login page

4. Log in with the admin credentials you created in Step 9

5. If successful, you should be redirected to the Dashboard

## Firestore Database Structure

Your Firestore database will have the following collections:

### users
```
{
  uid: "auto-generated-uid",
  email: "user@email.com",
  role: "admin" | "vendedor",
  displayName: "User Name",
  photoURL: "optional-url",
  createdAt: timestamp
}
```

### products
```
{
  id: "auto-generated",
  nombre: "Camisa Colegio San José",
  referencia: "CSJ001",
  talla: "M",
  tipo: "diario" | "deportivo",
  colegio: "San José",
  precio: 50000,
  stockTotal: 100,
  stockReservadoPedidos: 10,
  stockReservadoApartados: 5,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### clients
```
{
  id: "auto-generated",
  nombreCompleto: "Juan Pérez",
  tipoDocumento: "CC" | "CE" | "NIT",
  numeroDocumento: "123456789",
  telefono: "3001234567",
  email: "optional@email.com",
  direccion: "Optional address",
  createdAt: timestamp
}
```

### sales
```
{
  id: "auto-generated",
  numeroFactura: 1,
  clienteId: "client-doc-id",
  items: [
    {
      productoId: "product-id",
      nombre: "Product name",
      cantidad: 2,
      precio: 50000,
      descuento: 10,
      subtotal: 90000
    }
  ],
  subtotal: 90000,
  iva: 17100,
  total: 107100,
  metodoPago: "efectivo" | "nequi" | "daviplata",
  aplicaIva: true,
  vendedorId: "user-uid",
  createdAt: timestamp
}
```

### pedidos
```
{
  id: "auto-generated",
  numeroPedido: 1,
  clienteId: "client-doc-id",
  items: [
    {
      productoId: "product-id-or-custom",
      nombre: "Product name",
      talla: "M",
      cantidad: 3,
      precio: 60000
    }
  ],
  total: 180000,
  abono: 90000,
  saldo: 90000,
  observaciones: "Special measurements...",
  estado: "En Proceso" | "Apartado" | "Entregado",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### apartados
```
{
  id: "auto-generated",
  numeroApartado: 1,
  clienteId: "client-doc-id",
  items: [
    {
      productoId: "product-id",
      nombre: "Product name",
      cantidad: 2,
      precio: 50000
    }
  ],
  total: 100000,
  abono: 50000,
  saldo: 50000,
  estado: "Activo" | "Completado",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### devoluciones
```
{
  id: "auto-generated",
  ventaId: "sale-doc-id",
  numeroFactura: 123,
  tipo: "devolucion" | "cambio",
  items: [
    {
      productoId: "product-id",
      nombre: "Product name",
      cantidad: 1,
      precio: 50000
    }
  ],
  productosNuevos: [], // Only for "cambio"
  diferencia: 0,
  vendedorId: "user-uid",
  createdAt: timestamp
}
```

### config
```
company: {
  name: "Uniformes Martha Romero",
  nit: "123456789",
  address: "Calle 123 #45-67",
  phone: "3001234567",
  logoUrl: "https://...",
  invoiceFooter: "Gracias por su compra",
  ivaPercentage: 19,
  lowStockThreshold: 5
}
```

### colegios
```
{
  id: "auto-generated",
  nombre: "Colegio San José",
  codigo: "CSJ",
  activo: true,
  createdAt: timestamp
}
```

## Indexes Required

You may need to create composite indexes for complex queries. Firebase will prompt you with a link when you run a query that needs an index. Common indexes needed:

1. **sales**: `createdAt` (Descending) + `vendedorId` (Ascending)
2. **pedidos**: `estado` (Ascending) + `createdAt` (Descending)
3. **products**: `colegio` (Ascending) + `tipo` (Ascending)

## Troubleshooting

### "Permission denied" errors
- Check that you're logged in
- Verify Firestore security rules are published
- Ensure user document exists in `users` collection with correct `role`

### Can't log in
- Verify email/password provider is enabled in Authentication
- Check that user exists in Authentication > Users
- Ensure `.env` file has correct Firebase config values

### App won't start
- Run `npm install` to ensure all dependencies are installed
- Check that `.env` file exists and has all required variables
- Clear browser cache and try again

## Next Steps

Now that Firebase is set up, you can:
1. Start the development server: `npm run dev`
2. Log in with your admin account
3. Begin adding products, clients, and making sales!

For deployment to production, see the DEPLOYMENT.md guide (to be created).

## Important Security Notes

- Never commit your `.env` file to Git (it's already in .gitignore)
- Keep your Firebase API key secure
- Regularly review Firestore security rules
- Enable 2FA on your Firebase/Google account
- Create different Firebase projects for development and production

---

**Need help?** Contact the development team or refer to [Firebase Documentation](https://firebase.google.com/docs)
