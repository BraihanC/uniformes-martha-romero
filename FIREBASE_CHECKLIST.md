# Firebase Setup Checklist ✅

Use this checklist to ensure your Firebase setup is complete and correct.

## 📋 Pre-Setup

- [ ] Have a Google account ready
- [ ] Have your admin email ready
- [ ] Have a secure admin password prepared

## 🔥 Firebase Console Setup

### 1. Project Creation
- [ ] Logged into [Firebase Console](https://console.firebase.google.com/)
- [ ] Created new project named `uniformes-martha-romero`
- [ ] Disabled Google Analytics (optional)
- [ ] Project created successfully

### 2. Web App Registration
- [ ] Clicked Web icon (</>)
- [ ] Named app: `POS Web App`
- [ ] Registered app
- [ ] **COPIED Firebase config values** (save them!)
  ```javascript
  {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
  ```

### 3. Authentication Setup
- [ ] Navigated to Authentication section
- [ ] Clicked "Get started"
- [ ] Enabled "Email/Password" sign-in method
- [ ] Saved changes

### 4. Firestore Database
- [ ] Navigated to Firestore Database
- [ ] Clicked "Create database"
- [ ] Selected "Start in production mode"
- [ ] Chose Cloud Firestore location: ________
- [ ] Database created successfully

### 5. Security Rules
- [ ] Clicked on "Rules" tab in Firestore
- [ ] Replaced default rules with rules from `FIREBASE_SETUP.md` Step 6
- [ ] Published rules successfully
- [ ] No syntax errors

### 6. Firebase Storage
- [ ] Navigated to Storage
- [ ] Clicked "Get started"
- [ ] Kept default security rules
- [ ] Chose same location as Firestore
- [ ] Storage enabled successfully

### 7. Storage Security Rules
- [ ] Clicked on "Rules" tab in Storage
- [ ] Replaced with rules from `FIREBASE_SETUP.md` Step 8
- [ ] Published rules successfully

## 👤 User Setup

### 8. Create Admin User
- [ ] Navigated to Authentication > Users
- [ ] Clicked "Add user"
- [ ] Entered email: ________________
- [ ] Created secure password
- [ ] User created successfully
- [ ] **COPIED User UID**: ________________

### 9. User Document in Firestore
- [ ] Navigated to Firestore Database
- [ ] Clicked "Start collection"
- [ ] Collection ID: `users`
- [ ] Document ID: (pasted User UID)
- [ ] Added field: `email` (string) = your email
- [ ] Added field: `role` (string) = `admin`
- [ ] Added field: `displayName` (string) = `Administrador`
- [ ] Added field: `createdAt` (timestamp) = current time
- [ ] Saved successfully

## ⚙️ Configuration Documents

### 10. Company Config
- [ ] In Firestore, clicked "Start collection"
- [ ] Collection ID: `config`
- [ ] Document ID: `company`
- [ ] Added field: `name` (string) = `Uniformes Martha Romero`
- [ ] Added field: `nit` (string) = your NIT
- [ ] Added field: `address` (string) = your address
- [ ] Added field: `phone` (string) = your phone
- [ ] Added field: `logoUrl` (string) = (empty)
- [ ] Added field: `invoiceFooter` (string) = `Gracias por su compra`
- [ ] Added field: `ivaPercentage` (number) = `19`
- [ ] Added field: `lowStockThreshold` (number) = `5`
- [ ] Saved successfully

## 💻 Local Setup

### 11. Environment Variables
- [ ] Copied `.env.example` to `.env`
- [ ] Opened `.env` file
- [ ] Pasted `VITE_FIREBASE_API_KEY` from Firebase config
- [ ] Pasted `VITE_FIREBASE_AUTH_DOMAIN` from Firebase config
- [ ] Pasted `VITE_FIREBASE_PROJECT_ID` from Firebase config
- [ ] Pasted `VITE_FIREBASE_STORAGE_BUCKET` from Firebase config
- [ ] Pasted `VITE_FIREBASE_MESSAGING_SENDER_ID` from Firebase config
- [ ] Pasted `VITE_FIREBASE_APP_ID` from Firebase config
- [ ] Saved `.env` file
- [ ] Verified `.env` is in `.gitignore` ✅ (already done)

## 🧪 Testing

### 12. Test the Application
- [ ] Opened terminal in project directory
- [ ] Ran `npm run dev`
- [ ] Server started successfully
- [ ] Opened browser to `http://localhost:5173`
- [ ] Saw login page
- [ ] Login page looks correct (colors, logo, form)

### 13. Test Login
- [ ] Entered admin email
- [ ] Entered admin password
- [ ] Clicked "Iniciar Sesión"
- [ ] **Successfully logged in** ✅
- [ ] Redirected to Dashboard
- [ ] Dashboard shows welcome message
- [ ] Sidebar shows all menu items
- [ ] Header shows user info

### 14. Test Navigation
- [ ] Clicked on different menu items
- [ ] All pages load correctly
- [ ] No console errors (press F12 to check)
- [ ] Can navigate back to Dashboard
- [ ] Logout button works
- [ ] After logout, redirected to login page

### 15. Test Role-Based Access
- [ ] Logged in as admin
- [ ] Can see "Reportes" in sidebar ✅
- [ ] Can see "Configuración" in sidebar ✅
- [ ] Can access `/reportes` page ✅
- [ ] Can access `/config` page ✅

## 🔍 Verification

### Firebase Console Checks
- [ ] Authentication > Users: Shows 1 user (admin)
- [ ] Firestore > Data: `users` collection exists
- [ ] Firestore > Data: `config` collection exists
- [ ] Firestore > Rules: Custom rules published
- [ ] Storage: Enabled with custom rules

### Local App Checks
- [ ] Login works
- [ ] Dashboard loads with stats (may show 0 - that's OK)
- [ ] All pages accessible
- [ ] No console errors
- [ ] Responsive design works (try resizing browser)
- [ ] Mobile menu works (try < 768px width)

## ✅ Completion Checklist

Mark when fully complete:

- [ ] ✅ Firebase project created
- [ ] ✅ Authentication enabled and tested
- [ ] ✅ Firestore database created with rules
- [ ] ✅ Storage enabled with rules
- [ ] ✅ Admin user created and working
- [ ] ✅ Company config document created
- [ ] ✅ Local .env configured
- [ ] ✅ App runs successfully
- [ ] ✅ Login works
- [ ] ✅ Navigation works
- [ ] ✅ No console errors

## 🎉 All Done!

If all items are checked, your Firebase setup is complete!

**What's Next?**
- Start building the Inventory module
- Add your first products
- Build the Clients module
- Start making sales!

## ⚠️ Troubleshooting

If something doesn't work:

### Can't log in?
1. Check Authentication is enabled in Firebase Console
2. Verify user exists in Authentication > Users
3. Confirm user document exists in Firestore `users` collection
4. Check role is set to "admin" in user document

### "Permission denied" errors?
1. Verify Firestore security rules are published
2. Check user has `role: "admin"` in Firestore
3. Try signing out and signing in again

### App won't start?
1. Run `npm install` again
2. Check `.env` file exists and has all values
3. Verify no syntax errors in `.env`
4. Clear browser cache

### Console errors?
1. Open browser console (F12)
2. Read the error message
3. Check if Firebase credentials are correct
4. Verify all Firebase services are enabled

## 📞 Need More Help?

- Re-read `FIREBASE_SETUP.md` for detailed instructions
- Check Firebase Console for any warnings
- Review `QUICK_START.md` for common issues
- Check that all steps above are completed

---

**Setup Date**: __________
**Completed By**: __________
**Firebase Project ID**: __________
**Admin Email**: __________

Save this checklist for future reference!
