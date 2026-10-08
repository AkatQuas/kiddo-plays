/**
 * Capability probe for @simular/simulib-js.
 *
 * Default (`safe`) never clicks, types, closes windows, or launches apps.
 * Clipboard is written briefly, then restored.
 *
 *   node src/probe.mjs
 *   node src/probe.mjs clipboard screenshot
 */

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'out')

const SAFE = ['load', 'apps', 'windows', 'files', 'clipboard', 'screenshot', 'ax']

const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  const mark = ok ? 'ok ' : 'FAIL'
  console.log(`[${mark}] ${name}`)
  if (detail) {
    for (const line of String(detail).split('\n')) console.log(`       ${line}`)
  }
}

async function step(name, fn) {
  try {
    record(name, true, (await fn()) ?? '')
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error))
  }
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function countNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
}

const suites = {
  async load() {
    const lib = await import('@simular/simulib-js')
    const names = Object.keys(lib).sort()
    return `${names.length} exports\n${names.join(', ')}`
  },

  async apps() {
    const { System } = await import('@simular/simulib-js')
    const list = System.listApps()
    const preview = list
      .slice(0, 12)
      .map((app) => `${app.canonicalName ?? '?'} -> ${app.launchTarget ?? '?'}`)
      .join('\n')
    const query = process.platform === 'darwin' ? 'TextEdit' : 'notepad'
    let fuzzy
    try {
      const found = System.fuzzySearch(query)
      fuzzy = `fuzzy "${query}": ${found.canonicalName} -> ${found.launchTarget}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      fuzzy = `fuzzy "${query}" skipped: ${message}`
    }
    return `${list.length} apps\n${preview}\n${fuzzy}`
  },

  async windows() {
    const { Window } = await import('@simular/simulib-js')
    const list = Window.all()
    const preview = list
      .slice(0, 12)
      .map((win) => `pid=${win.pid} "${win.title}"`)
      .join('\n')
    const hint =
      list.length === 0 && process.platform === 'darwin'
        ? '\nhint: an empty list usually means this terminal is missing Accessibility permission'
        : ''
    return `${list.length} visible windows\n${preview || '(none)'}${hint}`
  },

  async files() {
    const { Directory, File } = await import('@simular/simulib-js')
    const dir = Directory.temp()
    try {
      const file = new File(`${dir.path()}/probe.txt`, true)
      file.write('hello from simulib-js-lab', false)
      const text = file.read()
      if (text !== 'hello from simulib-js-lab') {
        throw new Error(`round-trip mismatch: ${JSON.stringify(text)}`)
      }
      return `${file.path()} (${file.size()} bytes)`
    } finally {
      dir.delete()
    }
  },

  async clipboard() {
    const { Clipboard } = await import('@simular/simulib-js')
    const clip = new Clipboard()
    const token = `simulib-probe-${Date.now()}`
    const previous = clip.setString(token)
    try {
      const current = clip.getString()
      if (current !== token) {
        throw new Error(`expected ${JSON.stringify(token)}, got ${JSON.stringify(current)}`)
      }
      return 'wrote a token and read it back; previous clipboard restored'
    } finally {
      if (previous === null) clip.clear()
      else clip.setString(previous)
    }
  },

  async screenshot() {
    const { Screen, hasScreenCapturePermission, screenshotFull } = await import('@simular/simulib-js')
    if (!hasScreenCapturePermission()) {
      throw new Error(
        'screen recording is not granted to this terminal (System Settings → Privacy & Security → Screen Recording)',
      )
    }
    const screen = Screen.mainScreen()
    const [x, y, width, height] = screen.dimensions()
    const shot = screenshotFull(true, screen)
    const [sw, sh] = shot.dimensions
    mkdirSync(outDir, { recursive: true })
    const path = resolve(outDir, 'screenshot.png')
    shot.save(path)
    return `screen ${width}x${height} at (${x}, ${y}); saved ${path} (${sw}x${sh})`
  },

  async ax() {
    const { AccessibilityTree, AriaRole, TraversalOrder, ariaRoleToString, enableAccessibilityForFrontmostApp } =
      await import('@simular/simulib-js')

    try {
      enableAccessibilityForFrontmostApp()
    } catch {
      // Snapshot still runs when the frontmost app already exposes a tree.
    }

    const tree = AccessibilityTree.fromForeground()
    const root = tree.snapshot(false)
    const buttons = tree.find(TraversalOrder.DepthFirst, AriaRole.Button, null, false, 5, false)
    const lines = []
    const print = (node, depth) => {
      if (lines.length >= 40) return
      let line = `${'  '.repeat(depth)}- ${ariaRoleToString(node.role)}`
      if (node.name) line += ` ${JSON.stringify(truncate(node.name, 80))}`
      lines.push(line)
      for (const child of node.children) print(child, depth + 1)
    }
    print(root, 0)
    const buttonNames = buttons.map((node) => node.name || '(unnamed)').join(', ') || '(none)'
    const more = countNodes(root) > lines.length ? '\n… truncated' : ''
    const empty = !tree.windowTitle && root.children.length === 0
    const hint =
      empty && process.platform === 'darwin'
        ? '\nhint: grant Accessibility to this terminal, then re-run (System Settings → Privacy & Security → Accessibility)'
        : ''
    return `window "${tree.windowTitle}" role=${ariaRoleToString(root.role)} children=${root.children.length}\nbuttons: ${buttonNames}\n${lines.join('\n')}${more}${hint}`
  },
}

function selectedSuites(argv) {
  const names = argv.filter((arg) => arg !== '--')
  if (names.length === 0 || names.includes('safe') || names.includes('all')) return SAFE
  const unknown = names.filter((name) => !(name in suites))
  if (unknown.length > 0) {
    console.error(`Unknown suite: ${unknown.join(', ')}`)
    console.error(`Available: ${SAFE.join(', ')}`)
    process.exit(2)
  }
  return names
}

const chosen = selectedSuites(process.argv.slice(2))
console.log(`@simular/simulib-js probe (${process.platform} ${process.arch}, node ${process.version})`)
console.log(`suites: ${chosen.join(', ')}\n`)

for (const name of chosen) {
  await step(name, suites[name])
  console.log()
}

const failed = results.filter((item) => !item.ok)
console.log(`${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) process.exitCode = 1
