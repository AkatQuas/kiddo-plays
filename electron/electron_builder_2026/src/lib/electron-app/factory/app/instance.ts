import { app } from 'electron'

export const makeAppWithSingleInstanceLock = async (
  fn: () => Promise<void>
) => {
  const isPrimaryInstance = app.requestSingleInstanceLock()

  if (isPrimaryInstance) {
    await fn()
    return
  }
  console.debug('\x1B[97;101;1m --- instance already running --- \x1B[m')
  app.quit()
}
