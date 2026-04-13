import { WindowManager } from 'lib/electron-app/factory/window/manager'
import { MainWindow } from './main'
import { PanelWindow } from './panel'

let _instance: WindowManager | undefined

export function getWindowManager(): WindowManager {
  if (!_instance) {
    _instance = new WindowManager(MainWindow)
    _instance.register('panel', PanelWindow)
  }
  return _instance
}
