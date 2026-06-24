#!/usr/bin/env node
/**
 * 本地 Caddy：HTTPS → HTTP 反向代理，监听 0.0.0.0 供局域网访问。
 *
 * 用法：
 *   node ./caddy-dev.mjs init          # 从 example 复制 proxy-map.json
 *   node ./caddy-dev.mjs gen             # 仅生成 Caddyfile
 *   node ./caddy-dev.mjs start           # 前台启动
 *   node ./caddy-dev.mjs start -d        # 后台启动
 *   node ./caddy-dev.mjs stop
 *   node ./caddy-dev.mjs status
 *   node ./caddy-dev.mjs urls            # 打印本机 / 局域网访问地址
 *
 * 配置：编辑 ./proxy-map.json
 *   - routes[].hosts      按 Host 匹配（可多个）
 *   - routes[].path       按路径匹配，如 "/web/*"
 *   - routes[].default    设为 true 的路由承接局域网 IP 直连（仅一条）
 *   - includeLanIPs       自动把本机 LAN IP 加入站点与 default 路由
 *
 * 局域网其他机器访问自签证书：
 *   1. 用 mkcert 生成含局域网 IP 的证书，填 tlsCert/tlsKey，tls 设为 "off"
 *   2. 或在客户端安装 Caddy local CA（仅适合本机调试）
 *
 * 依赖：本机已安装 caddy（brew install caddy）
 */

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const CONFIG_PATH = path.join(ROOT, 'proxy-map.json')
const EXAMPLE_PATH = path.join(ROOT, 'proxy-map.example.json')
const GENERATED_DIR = path.join(ROOT, '.generated')
const CADDYFILE_PATH = path.join(GENERATED_DIR, 'Caddyfile')
const PID_FILE = path.join(GENERATED_DIR, 'caddy.pid')
const LOG_FILE = path.join(GENERATED_DIR, 'caddy.log')

function die(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

function ensureCaddy() {
  const r = spawnSync('caddy', ['version'], { encoding: 'utf8' })
  if (r.status !== 0) {
    die('未找到 caddy，请先安装：brew install caddy')
  }
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    die(`缺少 ${CONFIG_PATH}\n运行: node ./caddy-dev.mjs init`)
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch (e) {
    die(`解析 proxy-map.json 失败: ${e.message}`)
  }
}

function routeId(route, index) {
  const raw = String(route.name || `route${index}`).replace(/[^a-zA-Z0-9_-]/g, '_')
  return raw || `route${index}`
}

function prepareRoutes(cfg) {
  const routes = Array.isArray(cfg.routes) ? cfg.routes : []
  if (routes.length === 0) die('proxy-map.json: routes 不能为空')

  const lanIPs = cfg.includeLanIPs ? getLanIPv4().map((x) => x.address) : []
  let defaultIndex = routes.findIndex((r) => r.default)
  if (defaultIndex < 0) defaultIndex = 0

  return routes.map((route, index) => {
    const upstream = String(route.upstream || '').trim()
    if (!upstream) die(`路由 ${route.name || `(#${index})`} 缺少 upstream`)
    if (!/^https?:\/\//i.test(upstream)) {
      die(`路由 ${route.name || upstream} 的 upstream 必须以 http:// 或 https:// 开头`)
    }

    const hosts = Array.isArray(route.hosts) ? [...route.hosts] : [route.host].filter(Boolean)
    const normalizedHosts = [...new Set(hosts.map(normalizeHost).filter(Boolean))]
    if (index === defaultIndex && lanIPs.length > 0) {
      for (const ip of lanIPs) {
        if (!normalizedHosts.includes(ip)) normalizedHosts.push(ip)
      }
    }

    const handlePath = route.path || route.matchers?.path || ''
    return {
      id: routeId(route, index),
      name: route.name || upstream,
      comment: route.comment || '',
      upstream,
      hosts: normalizedHosts,
      path: String(handlePath || '').trim(),
      isDefault: index === defaultIndex,
    }
  })
}

function allSiteHosts(routes, cfg) {
  const hosts = new Set()
  for (const route of routes) {
    for (const h of route.hosts) hosts.add(h)
  }
  if (cfg.includeLanIPs) {
    for (const { address } of getLanIPv4()) hosts.add(address)
  }
  return [...hosts]
}

function generateCaddyfile(cfg) {
  const httpsPort = Number(cfg.httpsPort) || 8443
  const httpPort = Number(cfg.httpPort) || 0
  const bind = cfg.bind || '0.0.0.0'
  const routes = prepareRoutes(cfg)
  const siteHosts = allSiteHosts(routes, cfg)
  if (siteHosts.length === 0) {
    die('没有可用的 hosts，请在 routes[].hosts 中配置域名或 IP')
  }

  const lines = [
    '# 自动生成 — 编辑 proxy-map.json 后执行 caddy-dev.mjs gen / start',
    '{',
    '\tadmin off',
    '\tauto_https disable_redirects',
    '}',
    '',
  ]

  if (httpPort > 0) {
    lines.push(
      `# 可选 HTTP（无 TLS）`,
      `http://${bind === '0.0.0.0' ? ':' : bind}${httpPort} {`,
      '\trespond "Caddy dev proxy — use HTTPS" 404',
      '}',
      '',
    )
  }

  lines.push(`# HTTPS :${httpsPort}（${bind}，局域网可访问）`)
  lines.push(`${siteAddress(siteHosts, httpsPort)} {`)
  lines.push(tlsBlock(cfg))

  const pathRoutes = routes.filter((r) => r.path)
  const hostRoutes = routes.filter((r) => !r.path && r.hosts.length > 0)
  const defaultRoute = routes.find((r) => r.isDefault) || routes[routes.length - 1]

  for (const route of pathRoutes) {
    lines.push(`\t# ${route.name}${route.comment ? ` — ${route.comment}` : ''}`)
    lines.push(`\t@${route.id} path ${route.path}`)
    lines.push(`\thandle @${route.id} {`)
    lines.push(`\t\treverse_proxy ${route.upstream}`)
    lines.push('\t}')
    lines.push('')
  }

  for (const route of hostRoutes) {
    if (route.isDefault && pathRoutes.length === 0 && hostRoutes.length === 1) {
      continue
    }
    lines.push(`\t# ${route.name}${route.comment ? ` — ${route.comment}` : ''}`)
    lines.push(`\t@${route.id} host ${route.hosts.join(' ')}`)
    lines.push(`\thandle @${route.id} {`)
    lines.push(`\t\treverse_proxy ${route.upstream}`)
    lines.push('\t}')
    lines.push('')
  }

  lines.push(`\t# default → ${defaultRoute.name}`)
  lines.push('\thandle {')
  lines.push(`\t\treverse_proxy ${defaultRoute.upstream}`)
  lines.push('\t}')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function tlsBlock(cfg) {
  const cert = (cfg.tlsCert || '').trim()
  const key = (cfg.tlsKey || '').trim()
  if (cert && key) {
    return `\ttls ${quotePath(cert)} ${quotePath(key)}`
  }
  const mode = (cfg.tls || 'internal').toLowerCase()
  if (mode === 'internal') {
    return '\ttls internal'
  }
  return `\ttls ${mode}`
}

function quotePath(p) {
  return JSON.stringify(p)
}

function normalizeHost(host) {
  const h = String(host || '').trim()
  if (!h) return ''
  if (h.includes(':')) return h.split(':')[0]
  return h
}

function siteAddress(hosts, httpsPort) {
  return hosts.map((host) => `https://${host}:${httpsPort}`).join(', ')
}

function writeCaddyfile(cfg) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  const content = generateCaddyfile(cfg)
  fs.writeFileSync(CADDYFILE_PATH, content, 'utf8')
  return content
}

function getLanIPv4() {
  const nets = os.networkInterfaces()
  const candidates = []
  for (const name of Object.keys(nets)) {
    if (/^(lo|utun|bridge|docker|veth|tailscale)/i.test(name)) continue
    for (const addr of nets[name] || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue
      candidates.push({ name, address: addr.address })
    }
  }
  return candidates
}

function printUrls(cfg) {
  const httpsPort = Number(cfg.httpsPort) || 8443
  const routes = prepareRoutes(cfg)
  const lan = getLanIPv4()
  const defaultRoute = routes.find((r) => r.isDefault)

  console.log('HTTPS 代理（编辑 proxy-map.json 的 routes）：\n')
  for (const route of routes) {
    console.log(`[${route.name}] → ${route.upstream}${route.isDefault ? ' (default)' : ''}`)
    if (route.path) console.log(`  path: ${route.path}`)
    for (const h of route.hosts) {
      console.log(`  https://${h}:${httpsPort}/`)
    }
    console.log('')
  }

  if (cfg.includeLanIPs && lan.length > 0) {
    console.log('局域网直连（命中 default 路由）：')
    for (const { name, address } of lan) {
      console.log(`  https://${address}:${httpsPort}/  (${name}) → ${defaultRoute?.upstream}`)
    }
    console.log('')
    console.log('其他域名：在客户端 hosts 把自定义域名指到上述 LAN IP。')
  }

  console.log(`Caddyfile: ${CADDYFILE_PATH}`)
}

function cmdInit() {
  if (fs.existsSync(CONFIG_PATH)) {
    console.log(`已存在 ${CONFIG_PATH}，跳过 init`)
    return
  }
  fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH)
  console.log(`已创建 ${CONFIG_PATH}`)
  console.log('编辑 routes 后执行: node ./caddy-dev.mjs start')
}

function cmdGen() {
  const cfg = loadConfig()
  writeCaddyfile(cfg)
  console.log(`已生成 ${CADDYFILE_PATH}`)
  printUrls(cfg)
}

function readPid() {
  if (!fs.existsSync(PID_FILE)) return null
  const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim())
  return Number.isFinite(pid) && pid > 0 ? pid : null
}

function isRunning(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function cmdStop() {
  const pid = readPid()
  if (!pid || !isRunning(pid)) {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE)
    console.log('Caddy 未在运行')
    return
  }
  process.kill(pid, 'SIGTERM')
  console.log(`已停止 Caddy (pid ${pid})`)
  fs.unlinkSync(PID_FILE)
}

function cmdStatus() {
  const pid = readPid()
  if (pid && isRunning(pid)) {
    console.log(`Caddy 运行中 pid=${pid}`)
    console.log(`日志: ${LOG_FILE}`)
    printUrls(loadConfig())
  } else {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE)
    console.log('Caddy 未运行')
  }
}

function cmdStart(daemon) {
  ensureCaddy()
  const cfg = loadConfig()
  writeCaddyfile(cfg)

  const existing = readPid()
  if (existing && isRunning(existing)) {
    die(`Caddy 已在运行 (pid ${existing})，先执行 stop`)
  }

  const args = ['run', '--config', CADDYFILE_PATH, '--adapter', 'caddyfile']
  if (daemon) {
    const logFd = fs.openSync(LOG_FILE, 'a')
    const child = spawn('caddy', args, {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    })
    child.unref()
    fs.writeFileSync(PID_FILE, String(child.pid))
    fs.closeSync(logFd)
    console.log(`Caddy 已在后台启动 pid=${child.pid}`)
    console.log(`日志: ${LOG_FILE}`)
    printUrls(cfg)
    return
  }

  console.log('前台启动 Caddy（Ctrl+C 停止）\n')
  printUrls(cfg)
  const child = spawn('caddy', args, { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
}

function main() {
  const [cmd = 'help', ...rest] = process.argv.slice(2)
  const daemon = rest.includes('-d') || rest.includes('--daemon')

  switch (cmd) {
    case 'init':
      cmdInit()
      break
    case 'gen':
      cmdGen()
      break
    case 'start':
      cmdStart(daemon)
      break
    case 'stop':
      cmdStop()
      break
    case 'status':
      cmdStatus()
      break
    case 'urls':
      printUrls(loadConfig())
      break
    case 'help':
    default:
      console.log(`用法: node ./caddy-dev.mjs <command>

命令:
  init     从 proxy-map.example.json 复制 proxy-map.json
  gen      根据 proxy-map.json 生成 Caddyfile
  start    启动（加 -d 后台）
  stop     停止后台进程
  status   查看状态
  urls     打印访问地址

配置: ${CONFIG_PATH}`)
      break
  }
}

main()
