# Module Federation Monorepo

A production-ready demonstration of **Webpack 5 Module Federation** within a **pnpm monorepo** managed by **Turborepo**. This project showcases how multiple independent applications can share components and state at runtime, enabling a micro-frontend architecture while maintaining full application independence.

![Module Federation](https://img.shields.io/badge/Module-Federation-5.x-blue)
![React](https://img.shields.io/badge/React-18.x-blue)
![pnpm](https://img.shields.io/badge/pnpm-10.x-purple)
![Turborepo](https://img.shields.io/badge/Turborepo-2.x-red)

## Features

- **Module Federation** - Dynamic runtime module sharing between apps
- **pnpm Workspaces** - Efficient monorepo package management
- **Turborepo** - Fast, intelligent task orchestration with caching
- **shadcn/ui Components** - Modern, accessible UI components
- **TypeScript** - Full type safety across the monorepo
- **Tailwind CSS** - Utility-first styling

## Project Structure

```
module-federation-monorepo/
├── apps/
│   ├── host/       # Main application (port 3000) - consumes all remotes
│   ├── products/   # Products module (port 3001)
│   ├── cart/       # Cart module (port 3002)
│   └── user/       # User/Auth module (port 3003)
├── packages/
│   ├── config/     # Shared webpack configurations
│   ├── ui/         # shadcn/ui style components
│   └── utils/      # Shared utilities and contexts
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm run build
```

### Development

Start all applications simultaneously:

```bash
pnpm run dev
```

This will start:
- Host app: http://localhost:3000
- Products remote: http://localhost:3001
- Cart remote: http://localhost:3002
- User remote: http://localhost:3003

Alternatively, run apps individually:

```bash
# Terminal 1 - Host
cd apps/host && pnpm run dev

# Terminal 2 - Products
cd apps/products && pnpm run dev

# Terminal 3 - Cart
cd apps/cart && pnpm run dev

# Terminal 4 - User
cd apps/user && pnpm run dev
```

### Build

Build all apps for production:

```bash
pnpm run build
```

Build specific app:

```bash
cd apps/host && pnpm run build
cd apps/products && pnpm run build
```

### Clean

Remove build artifacts:

```bash
pnpm run clean
```

## Module Federation in Action

### Host Application

The host app (`apps/host`) dynamically imports remote modules:

```tsx
import { Suspense, lazy } from 'react';

// Lazy load remote modules
const ProductsList = lazy(() => import('products/ProductsList'));
const CartWidget = lazy(() => import('cart/CartWidget'));
const UserMenu = lazy(() => import('user/UserMenu'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ProductsList />
    </Suspense>
  );
}
```

### Remote Applications

Each remote app exposes its components via webpack:

```javascript
// apps/products/webpack.config.js
new ModuleFederationPlugin({
  name: 'products',
  exposes: {
    './ProductsList': './src/components/ProductsList',
    './ProductCard': './src/components/ProductCard',
    './ProductDetail': './src/components/ProductDetail',
  },
  // ...
})
```

## Exposed Modules

### Products (port 3001)

| Module | Description |
|--------|-------------|
| `ProductsList` | Grid display of all products |
| `ProductCard` | Individual product card with add-to-cart |
| `ProductDetail` | Full product details page |

### Cart (port 3002)

| Module | Description |
|--------|-------------|
| `CartWidget` | Mini cart icon with item count |
| `CartDrawer` | Slide-out cart panel |
| `Checkout` | Complete checkout flow |

### User (port 3003)

| Module | Description |
|--------|-------------|
| `UserMenu` | User avatar with auth dropdown |
| `LoginForm` | Login/registration form |
| `Profile` | User profile page |

## Technology Stack

| Tool | Version |
|------|---------|
| pnpm | 10.x |
| Turborepo | 2.x |
| Webpack | 5.x |
| React | 18.x |
| TypeScript | 5.x |
| Tailwind CSS | 3.x |

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start all apps in development mode |
| `pnpm run build` | Build all apps for production |
| `pnpm run clean` | Remove build artifacts |

## Understanding Module Federation

Module Federation allows JavaScript applications to dynamically load code from other applications at runtime. Key concepts:

- **Remote**: An app that exposes components for other apps to use
- **Host**: An app that consumes components from remotes
- **Shared Dependencies**: Libraries (like React) loaded once and shared
- **Dynamic Loading**: Components load on-demand via `React.lazy()`

## Architecture Highlights

### Shared State

Cross-app communication uses CustomEvents:

```typescript
// Add to cart (from products app)
window.dispatchEvent(new CustomEvent('mf:add-to-cart', {
  detail: { id, name, price, quantity }
}));
```

### Shared UI Components

All apps use shared components from `@mf-monorepo/ui`:

```tsx
import { Button, Card, Badge } from '@mf-monorepo/ui';
```

## License

MIT
