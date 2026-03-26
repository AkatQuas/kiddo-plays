# Module Federation Monorepo - Architecture Design

## Overview

This project demonstrates the power of **Webpack 5 Module Federation** in a **pnpm monorepo** managed by **Turborepo**. The architecture enables multiple independent applications to share components and state at runtime, creating a micro-frontend-like experience while maintaining full application independence.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MODULE FEDERATION MONOREPO                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                        TURBOREPO                                │ │
│  │  ┌─────────┐  ┌────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐   │ │
│  │  │  build  │  │  dev   │  │  lint   │  │  clean  │  │  test │   │ │
│  │  └─────────┘  └────────┘  └─────────┘  └─────────┘  └───────┘   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────┐    ┌──────────────────────────────┐  │
│  │          APPS              │    │          PACKAGES            │  │
│  │                            │    │                              │  │
│  │  ┌─────────┐               │    │  ┌──────────┐  ┌───────────┐ │  │
│  │  │  HOST   │◄── consumes   │    │  │  CONFIG  │  │  UTILS    │ │  │
│  │  │ :3000   │    remotes    │    │  │  shared  │  │  contexts │ │  │
│  │  └────┬────┘               │    │  │  webpack │  │  helpers  │ │  │
│  │       │                    │    │  └──────────┘  └───────────┘ │  │
│  │  ┌────┴────┐               │    │                              │  │
│  │  │         │               │    │  ┌──────────┐                │  │
│  │  ▼         ▼               │    │  │    UI    │                │  │
│  │ Products  Cart  User       │    │  │ shadcn/ui│                │  │
│  │  :3001    :3002  :3003     │    │  │ Radix UI │                │  │
│  │ (remote) (remote)(remote)  │    │  │ Tailwind │                │  │
│  │                            │    │  └──────────┘                │  │
│  └────────────────────────────┘    └──────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
module-federation-monorepo/
├── apps/                          # Application packages
│   ├── host/                      # Main host application
│   │   ├── src/
│   │   │   ├── App.tsx            # Main app with lazy-loaded remotes
│   │   │   ├── components/Layout.tsx
│   │   │   └── index.tsx
│   │   ├── webpack.config.js      # Host MF config (consumes remotes)
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   ├── products/                  # Products remote (port 3001)
│   │   ├── src/components/
│   │   │   ├── ProductsList.tsx   # Exposed: ./ProductsList
│   │   │   ├── ProductCard.tsx    # Exposed: ./ProductCard
│   │   │   └── ProductDetail.tsx  # Exposed: ./ProductDetail
│   │   └── webpack.config.js      # Remote MF config (exposes modules)
│   │
│   ├── cart/                      # Cart remote (port 3002)
│   │   ├── src/components/
│   │   │   ├── CartWidget.tsx     # Exposed: ./CartWidget
│   │   │   ├── CartDrawer.tsx     # Exposed: ./CartDrawer
│   │   │   └── Checkout.tsx       # Exposed: ./Checkout
│   │   └── webpack.config.js
│   │
│   └── user/                      # User remote (port 3003)
│       ├── src/components/
│       │   ├── UserMenu.tsx       # Exposed: ./UserMenu
│       │   ├── LoginForm.tsx      # Exposed: ./LoginForm
│       │   └── Profile.tsx        # Exposed: ./Profile
│       └── webpack.config.js
│
├── packages/                      # Shared packages
│   ├── config/                    # Shared webpack/MF configurations
│   │   └── src/
│   │       ├── webpack.federation.ts
│   │       └── webpack.common.ts
│   │
│   ├── ui/                        # Shared UI components (shadcn/ui style)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── button.tsx
│   │       │   ├── card.tsx
│   │       │   ├── dialog.tsx
│   │       │   ├── dropdown-menu.tsx
│   │       │   ├── input.tsx
│   │       │   └── badge.tsx
│   │       └── lib/utils.ts
│   │
│   └── utils/                     # Shared utilities and contexts
│       └── src/
│           ├── cart-context.tsx   # Cart state management
│           ├── user-context.tsx   # User/auth state management
│           └── index.ts           # Helper functions
│
├── turbo.json                     # Turborepo task configuration
├── pnpm-workspace.yaml            # pnpm workspace definition
└── package.json                   # Root package.json
```

---

## Module Federation Architecture

### How It Works

1. **Remote Apps (Products, Cart, User)**
   - Each app exposes specific components via `exposes` in webpack config
   - Each app runs on its own port
   - Each app has its own `remoteEntry.js` that lists available modules

2. **Host App**
   - Defines remotes in webpack config via `remotes`
   - Uses `React.lazy()` + `Suspense` to dynamically load remote components
   - Components are loaded on-demand when needed

3. **Shared Dependencies**
   - React and React-DOM are marked as `singleton` and `eager`
   - This ensures only one copy of React is loaded in the browser
   - Version alignment via `requiredVersion` semantic versioning

### webpack Configuration Pattern

```javascript
// Remote (products/webpack.config.js)
new ModuleFederationPlugin({
  name: 'products',
  filename: 'remoteEntry.js',
  exposes: {
    './ProductsList': './src/components/ProductsList',
    './ProductCard': './src/components/ProductCard'
  },
  remotes: {}, // No remotes for remote apps
  shared: {
    react: { singleton: true, eager: true, requiredVersion: '^18.2.0' },
    'react-dom': { singleton: true, eager: true, requiredVersion: '^18.2.0' }
  }
});

// Host (host/webpack.config.js)
new ModuleFederationPlugin({
  name: 'host',
  filename: 'remoteEntry.js',
  exposes: {},
  remotes: {
    products: 'products@http://localhost:3001/remoteEntry.js',
    cart: 'cart@http://localhost:3002/remoteEntry.js',
    user: 'user@http://localhost:3003/remoteEntry.js'
  },
  shared: {
    /* same as remote */
  }
});
```

---

## State Management

### Cross-App Communication

The architecture uses **CustomEvents** for loose coupling between modules:

```typescript
// In ProductCard (products app)
window.dispatchEvent(
  new CustomEvent('mf:add-to-cart', {
    detail: { id, name, price, image }
  })
);

// In CartWidget (cart app)
useEffect(() => {
  const handleAddToCart = (e: CustomEvent) => {
    // Add item to cart
  };
  window.addEventListener('mf:add-to-cart', handleAddToCart);
  return () => window.removeEventListener('mf:add-to-cart', handleAddToCart);
}, []);
```

### Context Providers

Shared state contexts in `packages/utils`:

- **CartContext** - Shopping cart state (items, totals, actions)
- **UserContext** - User authentication state

These are provided via the host app and can be consumed by remote modules.

---

## Turborepo Configuration

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "cache": true },
    "clean": { "cache": false }
  }
}
```

Key features:

- **`dev` runs independently** - No build dependency, apps use source code directly
- **`outputs`** - Define build artifacts for caching (used when packages need to be built)
- **`cache: true`** - Enable build caching for faster rebuilds
- **`persistent: true`** - Dev servers stay running

---

## Technology Stack

| Category        | Technology               |
| --------------- | ------------------------ |
| Package Manager | pnpm 10.x                |
| Task Runner     | Turborepo 2.x            |
| Build Tool      | Webpack 5                |
| Federation      | Module Federation Plugin |
| Framework       | React 18                 |
| Language        | TypeScript               |
| Styling         | **Tailwind CSS 3.x** (primary) |
| UI Components   | **shadcn/ui** (Radix UI) (preferred) |
| Icons           | Lucide React             |

> **Note:** All styling should use Tailwind CSS utility classes. Use shadcn/ui components as the primary UI library. Avoid custom CSS or inline styles unless absolutely necessary.

---

## Key Design Decisions

1. **Tailwind CSS First** - Use utility classes for all styling; avoid custom CSS files
2. **shadcn/ui Preferred** - Use shadcn/ui components (built on Radix UI) as the primary UI component source
3. **Custom Webpack** - Full control over Module Federation configuration
4. **Shared UI Package** - Single source of truth for components (install via shadcn CLI, customize in packages/ui)
5. **Event-Based Communication** - Loose coupling between remote modules
6. **Eager Loading** - React loaded as singleton for optimal performance
7. **Port-Based Isolation** - Each app runs independently for development

---

## Benefits of This Architecture

1. **Independent Deployment** - Each remote can be deployed separately
2. **Code Sharing** - Common components in shared packages (styled with Tailwind)
3. **Consistent UI** - shadcn/ui provides accessible, consistent components across all apps
4. **Lazy Loading** - Remote modules load only when needed
5. **Team Autonomy** - Teams can work on different remotes independently
6. **Runtime Integration** - Apps share the same React instance
7. **Build Performance** - Turborepo caches builds for speed

---

## TypeScript Configuration

This monorepo uses source code imports directly - packages export their TypeScript source files, and apps import them at runtime. No build step is required for packages.

### Configuration Files

```
module-federation-monorepo/
├── tsconfig.base.json              # Base config shared by all packages
├── packages/
│   ├── types/tsconfig.json         # Types package
│   ├── config/tsconfig.json        # Config package
│   ├── utils/tsconfig.json         # Utils package
│   └── ui/tsconfig.json            # UI package
└── apps/
    ├── host/tsconfig.json          # Host application
    ├── products/tsconfig.json      # Products remote
    ├── cart/tsconfig.json          # Cart remote
    └── user/tsconfig.json          # User remote
```

### Base Configuration (`tsconfig.base.json`)

The root `tsconfig.base.json` defines common compiler options and path aliases:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@mf-monorepo/types": ["packages/types/src/index.ts"],
      "@mf-monorepo/config": ["packages/config/src/index.ts"],
      "@mf-monorepo/ui": ["packages/ui/src/index.ts"],
      "@mf-monorepo/utils": ["packages/utils/src/index.ts"]
    }
  }
}
```

### Source Code Imports

All packages export their source files directly. This allows apps to use the latest code without waiting for package builds.

```typescript
// In any app or package
import { Button } from '@mf-monorepo/ui';
import { CartProvider } from '@mf-monorepo/utils';
import { getFederationConfig } from '@mf-monorepo/config';
import { CartItem, Product, User } from '@mf-monorepo/types';
```

### Package Exports

Each package defines its exports in package.json pointing to source files:

```json
{
  "name": "@mf-monorepo/ui",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./button": "./src/components/button.tsx",
    "./card": "./src/components/card.tsx"
  }
}
```

### Shared Types Package (`@mf-monorepo/types`)

The monorepo includes a dedicated types package for sharing common type definitions across all apps and packages. This ensures type consistency and reduces duplication.

#### Package Structure

```
packages/types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Main exports
    ├── types/
    │   ├── cart.ts           # Cart-related types
    │   ├── user.ts           # User-related types
    │   └── product.ts        # Product-related types
    └── constants/
        └── index.ts          # Shared constants
```

#### Type Definitions

```typescript
// Cart types
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
}
```

#### Shared Constants

```typescript
// Event names for Module Federation communication
export const MF_EVENTS = {
  ADD_TO_CART: 'mf:add-to-cart',
  REMOVE_FROM_CART: 'mf:remove-from-cart',
  UPDATE_CART: 'mf:update-cart',
  CLEAR_CART: 'mf:clear-cart',
  USER_LOGIN: 'mf:user-login',
  USER_LOGOUT: 'mf:user-logout',
} as const;

// Default ports for development
export const DEFAULT_PORTS = {
  HOST: 3000,
  PRODUCTS: 3001,
  CART: 3002,
  USER: 3003,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  CART: 'mf-cart-items',
  USER: 'mf-user-session',
} as const;
```

#### Usage

```typescript
// Import types
import type { CartItem, Product, User } from '@mf-monorepo/types';

// Import constants
import { MF_EVENTS, DEFAULT_PORTS } from '@mf-monorepo/types';

// Use in components
const handleAddToCart = (item: Omit<CartItem, 'quantity'>) => {
  window.dispatchEvent(new CustomEvent(MF_EVENTS.ADD_TO_CART, { detail: item }));
};
```

### Package Configuration

Shared packages (`packages/*/tsconfig.json`) extend the base and use source imports:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Note: No `composite`, `declaration`, or `outDir` options are needed since packages export source code directly.

### App Configuration

Application packages (`apps/*/tsconfig.json`) extend the base with app-specific paths:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@mf-monorepo/ui": ["../../packages/ui/src/index.ts"],
      "@mf-monorepo/utils": ["../../packages/utils/src/index.ts"],
      "@mf-monorepo/config": ["../../packages/config/src/index.ts"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

### Type Declarations for Module Federation

Remote modules loaded via Module Federation need type declarations. Create a `federation.d.ts` file:

```typescript
// apps/host/src/federation.d.ts
declare module 'products/ProductsList' {
  const ProductsList: React.ComponentType<any>;
  export default ProductsList;
}

declare module 'cart/CartWidget' {
  const CartWidget: React.ComponentType<any>;
  export default CartWidget;
}

declare module 'user/UserMenu' {
  const UserMenu: React.ComponentType<any>;
  export default UserMenu;
}
```

### Type Checking Commands

```bash
# Type check all packages (runs tsc on each package config)
pnpm exec tsc -b packages/types
pnpm exec tsc -b packages/config
pnpm exec tsc -b packages/utils
pnpm exec tsc -b packages/ui

# Type check specific app
pnpm exec tsc --noEmit -p apps/host/tsconfig.json

# Type check all apps
pnpm exec tsc --noEmit -p apps/products/tsconfig.json
pnpm exec tsc --noEmit -p apps/cart/tsconfig.json
pnpm exec tsc --noEmit -p apps/user/tsconfig.json

# Full project type check (from root)
pnpm exec tsc --noEmit
```

### Required Type Dependencies

Install these types at the root level:

```bash
pnpm add -Dw typescript @types/react @types/react-dom @types/node @types/webpack
```

---

## Future Enhancements

- Add `@module-federation/react` for better React integration
- Implement shared routing for navigation between modules
- ~~Add TypeScript project references for better type safety~~
- Implement environment-based remote URLs for production
- Add CI/CD pipelines for independent deployments
