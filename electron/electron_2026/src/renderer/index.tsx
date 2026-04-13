import React from 'react'
import ReactDom from 'react-dom/client'
import { Toaster } from 'sonner'
import { NetworkStatus } from './components/network-status'
import './globals.css'
import { initRendererI18n } from './i18n'
import { registerIpcListeners } from './lib/ipc-events'
import { AppRouter } from './router'
import { useAppStore } from './stores/app'

registerIpcListeners()

window.App.invoke('settings.get')
  .then(res => {
    if (res.ok) {
      useAppStore.getState().initFromSettings(res.data)
      return res.data.language
    }
    return undefined
  })
  .then(lang => initRendererI18n(lang))
  .then(() => {
    ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
      <React.StrictMode>
        <NetworkStatus />
        <AppRouter />
        <Toaster
          closeButton
          position="bottom-right"
          richColors
          style={{ zIndex: 99999 }}
        />
      </React.StrictMode>
    )
  })
