import { createLogger } from './create-logger'

export const mainLogger = createLogger('main')
export const errorLogger = createLogger('error')
export const windowLogger = createLogger('window')
export const ipcLogger = createLogger('ipc')
export const updaterLogger = createLogger('updater')
