import { registerMainHandle } from 'lib/electron-app/factory/ipc/register-main-handle'
import { AppRoutes } from 'shared/constants/routes'
import { userStore } from '../store'
import { getWindowManager } from '../windows/manager'

/**
 * Mock JWT generation for demo purposes
 */
const generateMockJwt = async (email: string): Promise<string> => {
  const payload = {
    email,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  }
  return btoa(JSON.stringify(payload))
}

/**
 * Register auth-related IPC handlers
 */
export function registerAuthHandlers() {
  registerMainHandle('auth.get-status', () => {
    const jwt = userStore.get('auth.jwt')
    return { isLoggedIn: !!jwt }
  })

  registerMainHandle('auth.login', async (_event, credentials) => {
    const { email, password } = credentials
    if (!email || !password) {
      throw new Error('Invalid credentials')
    }
    const jwt = await generateMockJwt(email)
    userStore.set('auth.jwt', jwt)
  })

  registerMainHandle('auth.logout', () => {
    userStore.delete('auth.jwt')

    const windowManager = getWindowManager()
    // Close all other windows tracked by WindowManager
    // Navigate main window to login route
    for (const [type, win] of windowManager.getAll()) {
      if (type === 'main') {
        windowManager.send('main', 'navigate', AppRoutes.main.LOGIN, {
          replace: true,
        })
      } else {
        win.close()
      }
    }
  })
}
