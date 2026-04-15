import { shell } from 'electron'
import contextMenu from 'electron-context-menu'

export const setupContextMenu = () => {
  contextMenu({
    prepend: (_defaultActions, parameters, _browserWindow) => [
      {
        label: 'Rainbow',
        // Only show it when right-clicking images
        visible: parameters.mediaType === 'image',
      },
      {
        label: 'Search Google for “{selection}”',
        // Only show it when right-clicking text
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          shell.openExternal(
            `https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`
          )
        },
      },
    ],
  })
}
