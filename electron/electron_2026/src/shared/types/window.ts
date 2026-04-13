import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

import type { registerRoute } from 'lib/electron-router-dom'

export type BrowserWindowOrNull = Electron.BrowserWindow | null

type Route = Parameters<typeof registerRoute>[0]

export type WindowType = Route['id']

export interface WindowProps extends Electron.BrowserWindowConstructorOptions {
  id: WindowType
  query?: Route['query']
}

type WindowCreationChannel = string

export interface WindowCreationByIPC {
  channel: WindowCreationChannel
  window(): BrowserWindowOrNull
  callback(window: BrowserWindow, event: IpcMainInvokeEvent): void
}
