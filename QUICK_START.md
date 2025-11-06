# Quick Start Guide - Uniformes Martha Romero POS

## 🚀 Get Started in 5 Minutes!

### What You Have Now

Your POS system foundation is ready! Here's what's working:

✅ Beautiful login page with corporate colors
✅ Responsive sidebar navigation
✅ Dashboard with basic stats
✅ All page routes configured
✅ Authentication with role-based access

### What You Need To Do

#### Step 1: Set Up Firebase (15 minutes)

1. **Create Firebase Account**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Sign in with your Google account

2. **Create Project**
   - Click "Add project"
   - Name: `uniformes-martha-romero`
   - Disable Google Analytics
   - Click "Create project"

3. **Add Web App**
   - Click the Web icon (</>)
   - Nickname: `POS Web App`
   - Register app
   - **Copy the config values!** You'll need them next

4. **Enable Authentication**
   - Go to Authentication > Get started
   - Sign-in method > Email/Password > Enable > Save

5. **Create Database**
   - Go to Firestore Database > Create database
   - Start in production mode
   - Choose location (e.g., us-central1)
   - Enable

6. **Set Security Rules**
   - Go to Firestore > Rules tab
   - Copy the rules from `FIREBASE_SETUP.md` (Step 6)
   - Publish

7. **Enable Storage**
   - Go to Storage > Get started
   - Use default rules for now
   - Choose same location as Firestore
   - Done

#### Step 2: Configure Your App (2 minutes)

1. **Create .env file**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env** and paste your Firebase config:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456
   VITE_FIREBASE_APP_ID=1:123456:web:abc...
   ```

#### Step 3: Create Your Admin User (3 minutes)

1. **In Firebase Console**
   - Go to Authentication > Users
   - Click "Add user"
   - Email: `admin@martharomero.com` (or your email)
   - Password: Create a secure password
   - Copy the User UID

2. **Create User Document**
   - Go to Firestore Database
   - Click "Start collection"
   - Collection ID: `users`
   - Document ID: Paste the UID you copied
   - Add fields:
     ```
     email: admin@martharomero.com (string)
     role: admin (string)
     displayName: Administrador (string)
     createdAt: (timestamp - click icon)
     ```
   - Save

3. **Create Company Config**
   - In Firestore, click "Start collection"
   - Collection ID: `config`
   - Document ID: `company`
   - Add fields:
     ```
     name: Uniformes Martha Romero (string)
     nit: 123456789 (string)
     address: Tu dirección (string)
     phone: 3001234567 (string)
     logoUrl: (string - leave empty)
     invoiceFooter: Gracias por su compra (string)
     ivaPercentage: 19 (number)
     lowStockThreshold: 5 (number)
     ```
   - Save

#### Step 4: Run The App! (1 minute)

```bash
npm run dev
```

Open your browser to: **http://localhost:5173**

Login with:
- Email: `admin@martharomero.com`
- Password: (the one you created)

## 🎉 You're In!

You should now see:
- Dashboard with welcome message
- Sidebar with all menu options
- Working navigation between pages

## 🔨 What's Next?

The app is ready for development! The next modules to build are:

### 1. Inventory Module (Recommended First)
This is the foundation - you'll need products before you can sell anything.

**Features to build:**
- Add/edit/delete products
- Track stock levels
- Import from Excel
- Filter by school and type

### 2. Clients Module
Manage your customer database.

**Features to build:**
- Add/edit/delete clients
- Search by document
- Import from Excel

### 3. POS Module
The core sales functionality.

**Features to build:**
- Product catalog
- Shopping cart
- Invoice generation
- Barcode scanner
- Print receipts

### 4. Pedidos & Apartados
Manage production orders and reservations.

### 5. Everything Else
Reports, returns, configuration, etc.

## 📚 Need Help?

- **Detailed Firebase Setup**: See `FIREBASE_SETUP.md`
- **Project Structure**: See `README.md`
- **Current Status**: See `PROJECT_STATUS.md`
- **Firebase Issues**: Check Firestore security rules and authentication

## 💡 Pro Tips

1. **Always test with your admin account first** before creating vendedor users
2. **Start with just a few products** to test the system
3. **Use the browser console** (F12) to see any errors
4. **Firebase has generous free tier** - perfect for getting started
5. **Keep your `.env` file secure** - never commit it to Git!

## 🐛 Common Issues

**Can't log in?**
- Check that Email/Password auth is enabled in Firebase
- Verify user exists in Authentication > Users
- Confirm user document exists in Firestore with role: "admin"

**"Permission denied" errors?**
- Check Firestore security rules are published
- Verify user role in Firestore users collection

**Blank page?**
- Check browser console for errors
- Verify .env file has all Firebase credentials
- Try clearing browser cache

**Build errors?**
- Run `npm install` again
- Delete `node_modules` and run `npm install`
- Check that all dependencies installed correctly

## 🎨 Customization

Want to change colors? Edit `tailwind.config.js`:

```javascript
colors: {
  primary: '#D50565',    // Your main brand color
  accent: '#EA5C2E',     // Button confirms
  'bg-beige': '#FFF1E5', // Background
  'bg-blue': '#C5D6EF',  // Sidebar
}
```

---

**Happy Building!** 🚀

Your POS system is ready to grow. Start with Inventory and Clients, then build out the POS module.

Questions? Check the Firebase Console for real-time data and errors.
