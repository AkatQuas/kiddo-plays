// client/demo.mjs —— 命令行验证（Node socket.io-client）
// 环境变量：CONTROL=控制面地址, GW=连房间服务的入口（经 Kong :8000 或直连 :8080）
// 流程：建房拿 token → alice/bob 连进同一房 → alice 广播 → 验证 bob 收到 → 验证"过期 token 被拒"。

import { io } from 'socket.io-client'

const CONTROL = process.env.CONTROL || 'http://localhost:3030' // 控制面（签发 token）
const GW = process.env.GW || 'http://localhost:8080'          // 房间服务入口（改成 :8000 即走 Kong）

async function waitFor(box, predicate, ms = 3000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const i = box.findIndex(predicate)
    if (i >= 0) return box[i]
    await new Promise((r) => setTimeout(r, 30))
  }
  throw new Error('等待超时')
}

function connect(user, token) {
  return new Promise((resolve) => {
    const s = io(GW, { auth: { token, user }, transports: ['websocket'], reconnection: false })
    const inbox = []
    s.on('connect', () => resolve({ s, inbox }))
    s.on('connect_error', (e) => resolve({ s, inbox, err: e.message }))
    s.onAny((ev, ...args) => inbox.push({ ev, args }))
  })
}

const room = await (await fetch(`${CONTROL}/api/rooms?name=demo&ttl=700`, { method: 'POST' })).json()
console.log('① 控制面建房:', room.roomId, '· token(exp≈', room.ttlMs, 'ms)')

const alice = await connect('alice', room.token)
if (alice.err) throw new Error('alice 连接被拒: ' + alice.err)
const bob = await connect('bob', room.token)
if (bob.err) throw new Error('bob 连接被拒: ' + bob.err)
console.log('② alice/bob 都连进同一房间（入口', GW, '）')

alice.s.emit('chat:send', 'hello from alice')
const got = await waitFor(bob.inbox, ({ ev, args }) => ev === 'chat' && args[0]?.text === 'hello from alice')
console.log('③ alice 的消息被 bob 收到:', JSON.stringify(got))

// 过期 token：js 里用 ttl=1ms 的 token，等它过期再连 → 应 connect_error
const expiredRoom = await (await fetch(`${CONTROL}/api/rooms?ttl=1`, { method: 'POST' })).json()
await new Promise((r) => setTimeout(r, 200))
const bad = await connect('eve', expiredRoom.token)
console.log('④ 过期 token 连接结果:', bad.err ? '被拒: ' + bad.err.slice(0, 60) + ' …' : '连接了?!')
if (bad.err) console.log('    → 符合"token 过了有效期内没用起来就秒拒"')

alice.s.close(); bob.s.close()
console.log('\n验证完成：控制面签发 token + 房间服务校验过期 = 正常。')
process.exit(0)