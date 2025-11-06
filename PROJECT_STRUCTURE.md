# Project Structure

```
uniformes-martha-romero/
├── 📄 Configuration Files
│   ├── .env.example                 # Environment variables template
│   ├── .gitignore                   # Git ignore rules
│   ├── package.json                 # Dependencies and scripts
│   ├── vite.config.js              # Vite configuration
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   ├── postcss.config.js           # PostCSS configuration
│   ├── eslint.config.js            # ESLint configuration
│   └── index.html                   # HTML entry point
│
├── 📚 Documentation
│   ├── README.md                    # Project overview and installation
│   ├── QUICK_START.md              # 5-minute getting started guide
│   ├── FIREBASE_SETUP.md           # Detailed Firebase setup guide
│   ├── PROJECT_STATUS.md           # Current implementation status
│   └── PROJECT_STRUCTURE.md        # This file
│
├── 🎨 Public Assets
│   └── public/
│       └── vite.svg                # Vite logo (replace with your logo)
│
└── 💻 Source Code (src/)
    ├── main.jsx                     # Application entry point
    ├── App.jsx                      # Main App component with routing
    ├── index.css                    # Global styles with Tailwind
    │
    ├── 🔐 Authentication
    │   └── context/
    │       └── AuthContext.jsx      # Auth state and role management
    │
    ├── 🔥 Services
    │   └── services/
    │       └── firebase.js          # Firebase initialization
    │
    ├── 🧩 Components
    │   ├── auth/
    │   │   └── PrivateRoute.jsx    # Route protection HOC
    │   │
    │   └── layout/
    │       ├── MainLayout.jsx      # Main app layout wrapper
    │       ├── Sidebar.jsx         # Navigation sidebar (responsive)
    │       └── Header.jsx          # Top header with user menu
    │
    └── 📄 Pages
        ├── Login.jsx               # ✅ Login page (complete)
        ├── Dashboard.jsx           # ✅ Dashboard with KPIs (functional)
        ├── POS.jsx                 # ⏳ Point of Sale (placeholder)
        ├── Inventory.jsx           # ⏳ Inventory management (placeholder)
        ├── Clients.jsx             # ⏳ Client management (placeholder)
        ├── Pedidos.jsx             # ⏳ Production orders (placeholder)
        ├── Apartados.jsx           # ⏳ Reservations (placeholder)
        ├── Devoluciones.jsx        # ⏳ Returns/exchanges (placeholder)
        ├── Reportes.jsx            # ⏳ Reports - Admin only (placeholder)
        └── Config.jsx              # ⏳ Configuration - Admin only (placeholder)
```

## 📂 Folder Organization

### `/src/components/`
Reusable React components organized by feature:

- **`auth/`** - Authentication-related components
  - `PrivateRoute.jsx` - Protects routes requiring authentication

- **`layout/`** - Layout components
  - `MainLayout.jsx` - Main application layout
  - `Sidebar.jsx` - Responsive navigation sidebar
  - `Header.jsx` - Top header with user info

- **`common/`** *(to be created)* - Shared UI components
  - Buttons, Inputs, Cards, Modals, etc.

- **Feature-specific folders** *(to be created)*:
  - `dashboard/` - Dashboard-specific components
  - `pos/` - POS module components
  - `inventory/` - Inventory components
  - `clients/` - Client management components
  - etc.

### `/src/pages/`
Top-level page components (one per route):

- `Login.jsx` - Public login page
- `Dashboard.jsx` - Main dashboard
- `POS.jsx` - Point of sale interface
- `Inventory.jsx` - Product inventory management
- `Clients.jsx` - Customer management
- `Pedidos.jsx` - Production order management
- `Apartados.jsx` - Stock reservation management
- `Devoluciones.jsx` - Returns and exchanges
- `Reportes.jsx` - Sales and production reports (admin only)
- `Config.jsx` - System configuration (admin only)

### `/src/context/`
React Context providers for global state:

- `AuthContext.jsx` - Authentication state and user roles

*(Future contexts to add)*:
- `CartContext.jsx` - Shopping cart state for POS
- `ConfigContext.jsx` - App configuration
- `NotificationContext.jsx` - Toast notifications

### `/src/services/`
External service integrations:

- `firebase.js` - Firebase configuration and initialization

*(Future services)*:
- `firestore.js` - Firestore helper functions
- `storage.js` - Firebase Storage helpers
- `excel.js` - Excel import/export utilities
- `print.js` - Print/invoice generation

### `/src/hooks/` *(to be created)*
Custom React hooks:

- `useProducts.js` - Product data and operations
- `useClients.js` - Client data and operations
- `useSales.js` - Sales data and operations
- `useFirestore.js` - Generic Firestore CRUD
- etc.

### `/src/utils/` *(to be created)*
Utility functions:

- `formatters.js` - Date, currency, number formatting
- `validators.js` - Form validation functions
- `calculations.js` - Business logic calculations
- `constants.js` - App-wide constants

## 🎯 Naming Conventions

### Files
- **Components**: PascalCase (e.g., `Sidebar.jsx`, `ProductCard.jsx`)
- **Utilities**: camelCase (e.g., `formatCurrency.js`, `useProducts.js`)
- **Constants**: UPPER_SNAKE_CASE or camelCase (e.g., `API_ENDPOINTS.js`)

### Components
- **React Components**: PascalCase (e.g., `ProductList`, `InvoiceModal`)
- **Props**: camelCase (e.g., `isOpen`, `onClose`, `productData`)
- **Hooks**: camelCase starting with "use" (e.g., `useAuth`, `useProducts`)

### CSS Classes (Tailwind)
- Use utility classes directly in JSX
- Custom classes in `index.css` use kebab-case

## 🔄 Data Flow

```
User Action
    ↓
Component Event Handler
    ↓
Service/Firebase Call
    ↓
Firestore Database
    ↓
Real-time Update (onSnapshot)
    ↓
Component Re-render
```

## 🚀 Build & Deploy

### Development
```bash
npm run dev          # Start dev server
```

### Production
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Deployment Options
- Firebase Hosting (recommended)
- Vercel
- Netlify
- Any static hosting service

## 📦 Key Dependencies

### Core
- `react` - UI library
- `react-dom` - React rendering
- `react-router-dom` - Routing

### Firebase
- `firebase` - Backend services

### UI & Styling
- `tailwindcss` - Utility-first CSS
- `@tailwindcss/postcss` - PostCSS plugin
- `autoprefixer` - CSS vendor prefixing

### Data & Charts
- `recharts` - Chart library
- `xlsx` - Excel import/export

### Development
- `vite` - Build tool
- `eslint` - Code linting

## 🎨 Styling Strategy

### Tailwind Utilities
Use Tailwind utility classes directly in components for:
- Layout (flexbox, grid)
- Spacing (margin, padding)
- Colors (from custom palette)
- Typography
- Responsive design

### Custom CSS
Add custom styles in `src/index.css` for:
- Global resets
- Custom scrollbar
- Animations
- Print styles

### Color Palette
Defined in `tailwind.config.js`:
```javascript
colors: {
  primary: '#D50565',      // Magenta
  accent: '#EA5C2E',       // Orange
  'bg-beige': '#FFF1E5',   // Background
  'bg-blue': '#C5D6EF',    // Sidebar
}
```

## 🔐 Security

### Environment Variables
- Never commit `.env` to version control
- Use `VITE_` prefix for client-side variables
- Store Firebase config in environment variables

### Firestore Rules
- Implemented role-based access control
- Admin-only operations protected
- All reads require authentication

### Authentication
- Email/password authentication
- Session persistence
- Secure logout

## 📱 Responsive Breakpoints

Tailwind's default breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

Mobile-first approach used throughout the app.

---

**Last Updated**: 2025-10-22
