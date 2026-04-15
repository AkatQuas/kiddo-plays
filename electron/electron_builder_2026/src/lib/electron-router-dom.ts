import { createElectronRouter } from 'electron-router-dom'

/*
 * https://electron-router-dom.daltonmenezes.com/en/docs/api/create-electron-router
 */
export const { Router, registerRoute, settings } = createElectronRouter({
  port: 4927,

  types: {
    /**
     * The ids of the windows of your application, think of these ids as the basename of the routes
     * this new way will allow your editor's intellisense to help you know which ids are available to use
     * both in the main and renderer process
     */
    ids: ['main', 'panel'],
  },
})
