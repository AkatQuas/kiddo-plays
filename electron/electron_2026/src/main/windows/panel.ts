import { screen } from 'electron'

import { createWindow } from 'lib/electron-app/factory/window/create'

export const PanelWindow = async () => {
  const display = screen.getPrimaryDisplay()
  const { workArea } = display
  const margin = 20

  const panel = createWindow({
    id: 'panel',
    width: 320,
    height: 400,
    x: workArea.x + workArea.width - 320 - margin,
    y: workArea.y + workArea.height - 420 - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    movable: true,
  })

  return panel
}
