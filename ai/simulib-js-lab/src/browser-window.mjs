import { AccessibilityTree, Window } from '@simular/simulib-js'

const BROWSER_TITLE = /chrome|edge|firefox|谷歌|microsoft edge/i

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function browserWindows() {
  return Window.all().filter((win) => BROWSER_TITLE.test(win.title))
}

function canBind(pid) {
  try {
    AccessibilityTree.fromPid(pid)
    return true
  } catch {
    return false
  }
}

/**
 * `App.open` on Windows often returns a Chrome process that owns no HWND.
 * The visible window belongs to a different browser process, and
 * `AccessibilityTree.fromPid` then throws
 * "No visible top-level window found for process …".
 *
 * Prefer the launch pid when it has a window. Otherwise use a browser
 * window whose title contains `hint`, then the foreground browser window.
 */
export async function resolveBrowserPid(launchPid, { hint, timeoutMs = 15_000 } = {}) {
  const hintText = hint?.toLowerCase() ?? ''
  const deadline = Date.now() + timeoutMs
  let seen = []

  while (Date.now() < deadline) {
    if (Window.allForPid(launchPid).length > 0 && canBind(launchPid)) return launchPid

    const windows = browserWindows()
    seen = Window.all().map((win) => ({ pid: win.pid, title: win.title }))
    const hinted = hintText ? windows.find((win) => win.title.toLowerCase().includes(hintText)) : null
    if (hinted && canBind(hinted.pid)) return hinted.pid

    try {
      const foregroundTitle = AccessibilityTree.fromForeground().windowTitle
      const foreground = windows.find((win) => win.title === foregroundTitle)
      if (foreground && canBind(foreground.pid)) return foreground.pid
    } catch {
      // Foreground app has no tree yet.
    }

    await sleep(400)
  }

  throw new Error(
    `No visible browser window for process ${launchPid}. Windows: ${JSON.stringify(seen)}`,
  )
}
