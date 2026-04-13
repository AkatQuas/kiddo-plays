# Electron 2026 - Developer Guide

A modern Electron application built with electron-vite, React 19, TypeScript, and Tailwind CSS 4.

## Project Overview

### Tech Stack
- **Build Tool**: electron-vite 4.x
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn-like components (base-ui)
- **State Management**: Zustand
- **Internationalization**: i18next
- **IPC**: Type-safe bidirectional communication
- **Packaging**: electron-builder

### Architecture
```
src/
├── main/           # Electron main process
│   ├── index.ts    # Entry point
│   ├── ipc/        # IPC handlers
│   ├── shell/      # Menu, tray, context menu
│   ├── updater/    # Auto-update logic
│   └── windows/    # Window management
├── preload/        # Context bridge (exposes IPC to renderer)
│   └── index.ts
├── renderer/       # React frontend
│   ├── components/ # UI components
│   ├── hooks/      # Custom React hooks
│   ├── lib/        # Utilities
│   ├── screens/    # Page components
│   ├── stores/     # Zustand stores
│   └── router.tsx  # React Router setup
├── shared/         # Shared between main & preload
│   ├── types/      # TypeScript types
│   ├── constants/  # Constants
│   └── utils/      # Utilities
└── lib/            # Electron app factory (framework code)
    └── electron-app/
        ├── factory/    # App/window/IPC factories
        ├── release/    # Build & release scripts
        └── utils/      # Electron utilities
```

---

## Running the App

### Development Mode
```bash
pnpm dev      # Start with watch mode
pnpm start    # Preview built app
```

### Build Commands
```bash
pnpm compile:app      # Compile TypeScript (main, preload, renderer)
pnpm build            # Build and package for distribution
pnpm release          # Create release with auto-update
```

### Linting & Type Checking
```bash
pnpm lint        # Check with Biome
pnpm lint:fix    # Auto-fix linting issues
pnpm typecheck   # TypeScript type checking
```

---

## Key Concepts

### 1. Type-Safe IPC Communication

The project uses a centralized type-safe IPC system. All channels are defined in `src/shared/types/ipc.ts`.

**Invoke Channels** (renderer request → main response):
```typescript
// Add to InvokeMap in src/shared/types/ipc.ts
'my-handler': { args: { param1: string }; return: { result: number } }
```

**Main Process Handler** (`src/main/ipc/my-handler.ts`):
```typescript
import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'

export function registerMyHandlers() {
  registerMainHandle('my-handler', (_event, { param1 }) => {
    return { result: param1.length }
  })
}
```

**Renderer Process Call**:
```typescript
const result = await App.invoke('my-handler', { param1: 'hello' })
// Returns: Promise<{ ok: true; data: { result: number } }> | { ok: false; error: string }>
```

**Event Channels** (main → renderer push):
```typescript
// Add to EventMap in src/shared/types/ipc.ts
'my-event': { foo: string; bar: number }

// Main process sends:
windowManager.broadcast('my-event', { foo: 'hello', bar: 42 })

// Renderer process listens:
window.App.on('my-event', (data) => { console.log(data.foo) })
```

### 2. Adding New IPC Handlers

1. Define the channel in `src/shared/types/ipc.ts`:
   - For invoke: add to `InvokeMap`
   - For events: add to `EventMap`

2. Create handler in `src/main/ipc/`:
   ```typescript
   import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'

   export function registerMyHandlers() {
     registerMainHandle('my-channel', (event, ...args) => {
       // Return value or throw Error
       return { success: true }
     })
   }
   ```

3. Register event listeners in `src/main/ipc/index.ts`:
   ```typescript
   export const registerIpcListeners = () => {
     registerMyListeners()
     // ...existing listeners
   }
   ```

### 3. Window Management

Windows are managed through the WindowManager in `src/lib/electron-app/factory/window/`.

A default and required 'main' window exists by default.

**Basic Operations**:
```typescript
import { getWindowManager } from 'main/windows/manager'

const windowManager = getWindowManager()

// Broadcast to all windows
windowManager.broadcast('event-name', data)
// Send event to specific window
windowManager.send('main', 'event-name', data)

// Get window
const mainWindow = windowManager.get('main')

// Create new window (requires registration first)
windowManager.create('settings', { width: 600, height: 400 })
```

> **Note**: The legacy functions in `send-event-to-renderer.ts` (`sendToRenderer`, `sendToFocusedWindow`, `broadcastToRenderer`) are deprecated. Always prefer using `windowManager.send()` or `windowManager.broadcast()`.

**Creating a New Window**:

1. Create a window factory in `src/main/windows/your-feature.ts`:
```typescript
import { createWindow } from 'lib/electron-app/factory/window/create'
import { displayName } from '~/package.json'

export const YourWindow = async () => {
  const window = createWindow({
    id: 'your-feature',
    title: displayName,
    width: 800,
    height: 600,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
  })

  // Optional: Add window-specific event handlers
  window.webContents.on('did-finish-load', () => {
    console.log('Window loaded')
  })

  return window
}
```

2. Register the window in `src/main/windows/manager.ts`:
```typescript
import { WindowManager } from 'lib/electron-app/factory/window/manager'
import { MainWindow } from './main'
import { YourWindow } from './your-feature'

let _instance: WindowManager | undefined

export function getWindowManager(): WindowManager {
  if (!_instance) {
    _instance = new WindowManager(MainWindow)
    // Register additional windows here
    _instance.register('your-feature', YourWindow)
  }
  return _instance
}
```

3. Use the window in your code:
```typescript
const windowManager = getWindowManager()

// Show existing window or create if not exists
await windowManager.getOrCreate('your-feature')

// Or force create (close existing and create new)
await windowManager.create('your-feature')
```

**Window Options** (from `createWindow`):
| Option | Default | Description |
|--------|---------|-------------|
| `show` | `false` | Show window after load |
| `center` | `true` | Center on screen |
| `movable` | `true` | Allow moving |
| `resizable` | `false` | Allow resize |
| `alwaysOnTop` | `true` | Keep above other windows |
| `autoHideMenuBar` | `true` | Hide menu bar |
| `webPreferences` | preload set | Web preferences |
| `htmlFile` | `'index.html'` | Custom HTML entry file |

**Best Practices**:
- Always use `createWindow()` instead of `new BrowserWindow()` directly
- Register windows in `manager.ts` before using `getOrCreate()` or `create()`
- Handle window-specific logic in the factory function before returning
- Use `alwaysOnTop: false` for secondary windows that users might need to interact with behind other apps
- Use `htmlFile` to create lightweight windows with minimal global components

### 4. Settings Store

Settings are synchronized between main and renderer using electron-store.

**Main Process** (`src/main/store/index.ts`):
```typescript
import { settingsStore } from 'main/store'
const store = settingsStore.store
store.get()     // Get all settings
store.set({...}) // Update settings
```

**Settings Fields**:
- `language`: 'en' | 'zh'
- `theme`: 'light' | 'dark'
- `autoCheckUpdate`: boolean
- `proxy`: { enabled: boolean, url: string }

**Renderer Process**:
```typescript
const settings = await App.invoke('settings.get')
await App.invoke('settings.set', { theme: 'dark' })
```

### 5. Adding UI Components

Components follow shadcn pattern using base-ui. Place new components in:

- **UI Components**: `src/renderer/components/ui/`
- **Feature Components**: `src/renderer/components/`

Example component structure:
```typescript
// src/renderer/components/ui/my-component.tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const myComponentVariants = cva(
  'base-styles',
  {
    variants: {
      variant: {
        default: 'default-styles',
        secondary: 'secondary-styles',
      },
      size: {
        default: 'size-default',
        sm: 'size-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

export function MyComponent({ className, variant, size, ...props }: MyComponentProps) {
  return (
    <div className={twMerge(myComponentVariants({ variant, size }), className)} {...props} />
  )
}
```

### 6. Routing

Uses `electron-router-dom` for IPC-aware routing with a shared HTML entry point across windows.

**Route Configuration** (`src/renderer/router.tsx`):
```typescript
import { Router } from 'electron-router-dom'
import { Route } from 'react-router-dom'
import { Layout } from './layout'
import { HomeScreen } from './screens/main'
import { SettingsScreen } from './screens/settings'
import { LoginScreen } from './screens/login'

export const AppRouter = () => {
  return (
    <Router
      main={
        <Route element={<Layout />} path="/">
          <Route element={<HomeScreen />} path="/" />
          <Route element={<SettingsScreen />} path="/settings" />
          <Route element={<LoginScreen />} path="/login" />
          <Route element={<Navigate replace to="/"} />} path="*" />
        </Route>
      }
    />
  )
}
```

**Route Constants** (`src/shared/constants/routes.ts`):
```typescript
export const AppRoutes = {
  main: {
    HOME: '/home',
    LOGIN: '/login',
    SETTINGS: '/settings',
    TEST: '/test',
  },
} as const

// Type-safe route names
export type AppRouteName = ExtractNestedValues<typeof AppRoutes>
```

**Navigate from main process** (uses basename to identify window):
```typescript
import { getWindowManager } from 'main/windows/manager'
import { AppRoutes } from 'shared/constants/routes'

const windowManager = getWindowManager()

// Notify main window to navigate to settings screen
windowManager.send('main', 'navigate', AppRoutes.main.SETTINGS)

// With navigation options (e.g., replace history)
windowManager.send('main', 'navigate', AppRoutes.main.SETTINGS, { replace: true })
```

**Navigate from renderer** (use standard react-router-dom):
```typescript
import { useNavigate } from 'react-router-dom'
import { AppRoutes } from 'shared/constants/routes'

const navigate = useNavigate()
navigate(AppRoutes.main.SETTINGS)
```

### 7. Constants

All application-wide constants should be defined in `src/shared/constants/`.

**Available Constants**:
- `routes.ts` - Route path definitions with type-safe `AppRouteName` type
- `index.ts` - Platform detection (`PLATFORM.IS_MAC`, etc.) and environment variables

**Adding New Constants**:
1. Create a new file in `src/shared/constants/` (e.g., `my-constants.ts`)
2. Export constants using `as const` for type safety
3. Add to `src/shared/constants/index.ts` for clean imports

```typescript
// src/shared/constants/my-constants.ts
export const MyConstants = {
  MAX_RETRY: 3,
  TIMEOUT: 5000,
} as const

// src/shared/constants/index.ts
export { MyConstants } from './my-constants'
```

**Import using alias**:
```typescript
import { AppRoutes } from 'constants/routes'
import { PLATFORM } from 'constants'
```

**Best Practice**: Always use constants instead of hardcoded values:
```typescript
// ✅ Recommended - use constants
import { AppRoutes } from 'constants/routes'
navigate(AppRoutes.main.SETTINGS)

// ❌ Avoid - hardcoded strings
navigate('/settings')
```

### 8. Internationalization (i18n)

Translation files are in `src/shared/locales/`.

**Adding a new language**:
1. Create `src/shared/locales/{lang}.json`
2. Add to electron-builder.ts `extraResources`

**Usage in renderer**:
```typescript
import { useTranslation } from 'react-i18next'

const { t } = useTranslation()
return <p>{t('key.path')}</p>
```

### 9. Logging

The project uses **Winston** for logging in the main process with daily log rotation.

**Log Location**: `{userData}/logs/`

**Available Loggers** (`src/lib/electron-app/factory/logger/index.ts`):
```typescript
import { mainLogger } from 'lib/electron-app/factory/logger'

mainLogger.info('Info message')
mainLogger.warn('Warning message')
mainLogger.error('Error message', error)
```

**Log Levels**: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`

**Features**:
- **Console**: Colored, human-readable format for development
- **File**: JSON format with auto-rotation (daily + 20MB max size, keeps 15 days)
- **Categorized**: Separate log files per label (`main.log`, `error.log`, `window.log`, etc.)

**Creating Custom Loggers**:
```typescript
import { createLogger } from 'lib/electron-app/factory/logger/create-logger'

// Create a custom logger for your module
const myLogger = createLogger('my-module')

myLogger.info('Custom log message')
```

**Best Practices**:
- Use appropriate log levels (info for normal operations, warn for recoverable issues, error for failures)
- Include relevant context in log messages
- Use `error` level with stack traces for exceptions

### 10. HTTP Proxy (Bypassing CORS)

The renderer cannot make direct HTTP requests due to CORS restrictions. All HTTP requests should go through the main process via IPC.

**Configuration**:
Set `BASE_URL` in `src/shared/types/http.ts`:
```typescript
export const BASE_URL = 'https://api.example.com' // Your API base URL
```

**Proxy Support**:
The app supports proxy for HTTP requests. Configure via Settings UI or directly in store:
```typescript
// In settings store (proxy configuration)
{
  proxy: {
    enabled: true,
    url: 'http://127.0.0.1:7890'  // Your proxy URL
  }
}
```
When enabled, HTTP_PROXY/HTTPS_PROXY environment variables are set before each request.

**Usage in Renderer**:
```typescript
import { httpClient } from 'renderer/lib/http'

// GET request (uses BASE_URL)
const response = await httpClient.get('/api/users')

// POST request
const response = await httpClient.post('/api/users', {
  body: JSON.stringify({ name: 'John' }),
  headers: { 'Content-Type': 'application/json' }
})

// Absolute URL (bypasses BASE_URL)
const response = await httpClient.get('https://api.example.com/users')

// Access response data
console.log(response.status)    // 200
console.log(response.body)      // { users: [...] }
```

**Response Structure**:
```typescript
{
  status: number        // HTTP status code
  statusText: string    // HTTP status text
  headers: Record<string, string>
  body: unknown         // Parsed response body
}
```

**Adding New HTTP Channels**:
For specific endpoints, you can create custom handlers in `src/main/ipc/`:
1. Define channel in `src/shared/types/ipc.ts` -> `InvokeMap`
2. Create handler in `src/main/ipc/your-handler.ts`
3. Register in `src/main/ipc/index.ts`

---

## Code Style & Conventions

### Formatting
- **Tool**: Biome (configured in `biome.json`)

### TypeScript Guidelines
- Use strict mode
- Avoid `any` type
- Use explicit return types for IPC handlers
- Prefer interfaces over types for object shapes

### Import Aliases
Configured in `tsconfig.json`:
- `lib/*` → `src/lib/*`
- `shared/*` → `src/shared/*`
- `renderer/*` → `src/renderer/*`
- `main/*` → `src/main/*`
- `constants/*` → `src/shared/constants/*`
- `~/package.json` → `./package.json`

### Lint Before Commit
```bash
pnpm lint:fix
pnpm typecheck
```

---

## Common Tasks

### Add a New Screen
1. Create screen in `src/renderer/screens/`
2. Add route in `src/renderer/router.tsx`
3. Add route constant in `src/shared/constants/routes.ts`
4. Register navigation handler if needed

### Add a Lightweight Window (with custom HTML)
For windows that don't need all global components (like NetworkStatus, Toaster):

1. **Create custom HTML entry** in `src/renderer/`:
   ```html
   <!-- widget.html -->
   <!DOCTYPE html>
   <html lang="en" class="dark">
     <body>
       <app></app>
       <script type="module" src="widget-entry.tsx"></script>
     </body>
   </html>
   ```

2. **Create custom entry point** (e.g., `src/renderer/widget-entry.tsx`):
   ```typescript
   import React from 'react'
   import ReactDom from 'react-dom/client'
   import { AppRouter } from './router'

   ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
     <React.StrictMode>
       <AppRouter />
     </React.StrictMode>
   )
   ```

3. **Create window with custom htmlFile**:
   ```typescript
   // src/main/windows/widget.ts
   export const WidgetWindow = async () => {
     const window = createWindow({
       id: 'widget',
       htmlFile: 'widget.html',  // Uses custom HTML
       width: 60,
       height: 60,
       // ...other options
     })
     return window
   }
   ```

4. **Register in manager** (`src/main/windows/manager.ts`):
   ```typescript
   _instance.register('widget', WidgetWindow)
   ```

This is useful for:
- Floating action buttons (FAB)
- Small utility windows
- Windows that need different global components

### Add Global State
1. Create Zustand store in `src/renderer/stores/`
2. For settings sync with main: use existing pattern in `app.ts`
3. For async data: consider React Query or simple fetch in hooks

### Add System Tray Menu
1. Edit `src/main/shell/tray.ts`

### Add Application Menu
1. Edit `src/main/shell/menu.ts`

### Add Context Menu
1. Edit `src/main/shell/context-menu.ts`

---

## Testing Notes

- No test framework is currently configured
- TODO: Add tests (see `src/main/index.ts` line 52-55)

---

## File Structure Reference

| Path | Purpose |
|------|---------|
| `src/main/index.ts` | App entry, initializes all managers |
| `src/preload/index.ts` | Context bridge, exposes `window.App` |
| `src/renderer/index.tsx` | React entry |
| `src/shared/types/ipc.ts` | All IPC channel definitions |
| `src/lib/electron-app/` | Framework/abstraction layer |
| `electron.vite.config.ts` | Build configuration |
| `electron-builder.ts` | Packager configuration |
| `biome.json` | Linter/formatter config |
| `components.json` | shadcn-like components config |

---

## Troubleshooting

### App doesn't start
```bash
pnpm clean:dev   # Clear compiled .dev folder
pnpm dev         # Start fresh
```

### Type errors
```bash
pnpm typecheck   # Find issues
```

### Lint errors
```bash
pnpm lint:fix    # Auto-fix
```

### Rebuild native modules
```bash
pnpm install:deps
```
