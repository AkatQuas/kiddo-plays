import { registerAuthHandlers } from './auth'
import { registerHttpHandlers } from './http'
import { registerSettingsHandlers } from './settings'

export const registerIpcHandlers = () => {
  registerSettingsHandlers()
  registerAuthHandlers()
  registerHttpHandlers()
}
