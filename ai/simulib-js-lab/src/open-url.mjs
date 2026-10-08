/**
 * Opens a URL in the default browser and prints the new window's accessibility snapshot.
 * This steals focus. Pass a URL as the first argument; default is https://example.com.
 *
 *   node src/open-url.mjs
 *   node src/open-url.mjs https://example.com
 */

import { AccessibilityTree, App, FocusPolicy, Visibility, ariaRoleToString } from '@simular/simulib-js'
import { resolveBrowserPid } from './browser-window.mjs'

const url = process.argv[2] || 'https://example.com'
const hint = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
const app = App.defaultBrowser()
console.log(`browser: ${app.canonicalName ?? '(default)'} (${app.launchTarget ?? 'system default'})`)
console.log(`opening ${url}`)

const instance = app.open(url, FocusPolicy.Steal, Visibility.Show, true)
console.log(`pid: ${instance.pid}`)

const windowPid = await resolveBrowserPid(instance.pid, { hint })
if (windowPid !== instance.pid) console.log(`window pid: ${windowPid}`)

const tree = AccessibilityTree.fromPid(windowPid)
const root = tree.snapshot(false)
console.log(`window: "${tree.windowTitle}" role=${ariaRoleToString(root.role)} children=${root.children.length}`)

function print(node, depth, budget) {
  if (budget.left <= 0) return
  budget.left -= 1
  let line = `${'  '.repeat(depth)}- ${ariaRoleToString(node.role)}`
  if (node.name) line += ` ${JSON.stringify(node.name.slice(0, 80))}`
  console.log(line)
  for (const child of node.children) print(child, depth + 1, budget)
}

print(root, 0, { left: 60 })
