import { session } from 'electron'
import { resolve } from 'node:path'

export async function loadReactDevtools() {
  const reactDevToolsPath = resolve(
    'src',
    'lib/electron-app/extension',
    'react-developer-tools'
  )

  try {
    await session.defaultSession.extensions.loadExtension(reactDevToolsPath, {
      allowFileAccess: true,
    })

    console.log('\nReact Developer Tools loaded!\n')
  } catch (err) {
    console.error('Error loading React Developer Tools:', err)
  }
}
