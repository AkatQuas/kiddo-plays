/**
 * Open Chrome on https://cn.bing.com, type 洛天依 into the page search box,
 * and submit. Steals focus. Verifies the results window title.
 *
 *   node src/bing-search.mjs
 */

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AccessibilityTree,
  App,
  AriaRole,
  FocusPolicy,
  Screen,
  TraversalOrder,
  Visibility,
  Window,
  ariaRoleToString,
  screenshotFull,
} from '@simular/simulib-js'
import { resolveBrowserPid } from './browser-window.mjs'

const QUERY = '洛天依'
const PAGE = 'https://cn.bing.com'
const browserName = process.platform === 'darwin' ? 'Google Chrome' : 'Chrome'
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../out')

const ADDRESS_BAR = /地址|address|omnibox|location/i
const SEARCH_NAME = /搜索|search|必应|bing/i
const SUBMIT_NAMES = new Set(['Search', '搜索'])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Chrome on macOS leaves its AX tree off until something turns it on.
// The Windows method is still `todo!()` in simulib-rs and aborts the process;
// UIA clients wake Chrome's accessibility tree without this call.
function enableAccessibility(instance) {
  if (process.platform !== 'darwin') return
  instance.enableAccessibility()
}

function describe(node) {
  const name = node.name ? JSON.stringify(node.name.slice(0, 60)) : '""'
  return `${ariaRoleToString(node.role)} ${name} ref=${node.refId ?? '-'}`
}

function chromeTree(pid) {
  return AccessibilityTree.fromPid(pid)
}

function chromeWindowTitles(pid) {
  const own = Window.allForPid(pid).map((win) => win.title)
  const others = Window.all()
    .filter((win) => win.pid !== pid && /chrome|谷歌/i.test(win.title))
    .map((win) => win.title)
  return [...new Set([...own, ...others])]
}

function titled(titles) {
  return titles.find((title) => title.length > 0) ?? ''
}

function findSearchBox(tree) {
  const roles = [AriaRole.Searchbox, AriaRole.Combobox, AriaRole.Textbox]
  for (const role of roles) {
    const nodes = tree.find(TraversalOrder.DepthFirst, role, null, false, 30, false)
    const candidates = nodes.filter((node) => node.refId != null && !ADDRESS_BAR.test(node.name))
    const match =
      candidates.find((node) => SEARCH_NAME.test(node.name)) ??
      (role === AriaRole.Searchbox ? candidates[0] : null)
    if (match) return match
  }
  return null
}

function findSubmitButton(tree) {
  for (const name of SUBMIT_NAMES) {
    const nodes = tree.find(TraversalOrder.DepthFirst, AriaRole.Button, name, false, 20, false)
    const match = nodes.find((node) => node.refId != null && node.name === name)
    if (match) return match
  }
  return null
}

async function waitFor(label, timeoutMs, fn) {
  const deadline = Date.now() + timeoutMs
  let detail = ''
  while (Date.now() < deadline) {
    const found = fn()
    if (found?.value) return found.value
    if (found?.detail) detail = found.detail
    await sleep(400)
  }
  throw new Error(`timed out waiting for ${label}${detail ? `; last seen: ${detail}` : ''}`)
}

const app = App.exactName(browserName)
console.log(`opening ${PAGE} in ${browserName}`)
const instance = app.open(PAGE, FocusPolicy.Steal, Visibility.Show, true)
console.log(`pid=${instance.pid}`)
if (!instance.pid) throw new Error('Chrome launched without a pid')

const windowPid = await resolveBrowserPid(instance.pid, { hint: 'bing' })
if (windowPid !== instance.pid) console.log(`window pid=${windowPid}`)

enableAccessibility(instance)

const loadedTitle = await waitFor('a Chrome window', 30_000, () => {
  enableAccessibility(instance)
  const own = Window.allForPid(windowPid)
  const titles = chromeWindowTitles(windowPid)
  const detail = JSON.stringify(titles)
  const bing = titles.find((title) => /bing|必应/i.test(title))
  if (bing) return { value: bing, detail }
  // A window for this pid is enough. Windows Chrome often leaves Window.title
  // empty, or uses a page title that does not contain "Bing".
  if (own.length > 0) return { value: titled(titles) || '(untitled Chrome window)', detail }
  const any = titled(titles)
  return any ? { value: any, detail } : { detail }
})
console.log(`window: "${loadedTitle}"`)

const search = await waitFor('the Bing search box', 20_000, () => {
  const tree = chromeTree(windowPid)
  const box = findSearchBox(tree)
  return box ? { value: { tree, box } } : null
})

console.log(`search box: ${describe(search.box)}`)
search.tree.setValue(search.box.refId, QUERY)

const submit = await waitFor('the Bing search button', 15_000, () => {
  const tree = chromeTree(windowPid)
  const button = findSubmitButton(tree)
  return button ? { value: { tree, button } } : null
})
console.log(`submit: ${describe(submit.button)}`)
submit.tree.activate(submit.button.refId)

const resultsTitle = await waitFor(`results for ${QUERY}`, 25_000, () => {
  const titles = chromeWindowTitles(windowPid)
  const matchedTitle = titles.find((title) => title.includes(QUERY))
  if (matchedTitle) return { value: matchedTitle }
  const tree = chromeTree(windowPid)
  const address = tree
    .find(TraversalOrder.DepthFirst, AriaRole.Textbox, null, false, 10, false)
    .find((node) => ADDRESS_BAR.test(node.name) && node.value.includes(QUERY))
  if (address) return { value: address.value }
  return { detail: JSON.stringify(titles) }
})
console.log(`results: "${resultsTitle}"`)

mkdirSync(outDir, { recursive: true })
const shotPath = resolve(outDir, 'bing-luotianyi.png')
const shot = screenshotFull(true, Screen.mainScreen())
shot.save(shotPath)
console.log(`screenshot: ${shotPath}`)
