// room-service/src/index.mjs —— 房间服务（数据面） :8080
// socket.io + express。真相在 Redis：
//   1) 连接前查 Redis 里 `token:{token}->roomId`，取不到/过期 => connect_error（拒）。
//   2) 通过后把在线用户写进 `presence:{roomId}`，控制和它都读同一份 Redis 就知道谁在线。
//   3) 聊天广播仍是 socket.io room —— 只影响"同一厢"。

import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getRedis } from '../../shared/redis.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8080)
const redis = await getRedis()

const app = express()
app.get('/health', (_req, res) => res.json({ ok: true }))
app.use(express.static(join(__dirname, '..', 'static')))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

// socketId -> user（本进程内，供 presence 用；跨实例计数以 Redis 为准）
const members = new Map()

// —— 数据面准入：token 的有效性以 Redis 为准 ——
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  const roomId = token ? await redis.get(`token:${token}`) : null
  if (!roomId) {
    // 取不到 = token 不存在或已过期（Redis TTL 自动删除）或已被控制面吊销
    return next(new Error('auth_failed: token 无效/已过期（默认 1 分钟）'))
  }
  socket.data.roomId = roomId
  socket.data.user = String(socket.handshake.auth?.user || socket.handshake.query?.user || 'anon')
  next()
})

io.on('connection', async (socket) => {
  const { roomId, user } = socket.data
  socket.join(roomId)
  members.set(socket.id, user)
  await redis.sAdd(`presence:${roomId}`, user)   // 对齐：写 Redis 让控制面/别的实例都知道

  emit(roomId, 'system', `${user} 加入了`)
  emit(roomId, 'presence', { users: await usersIn(roomId) })

  socket.on('chat:send', (text) => {
    emit(roomId, 'chat', { user, text: String(text ?? ''), ts: Date.now() })
  })

  socket.on('disconnect', async () => {
    members.delete(socket.id)
    await redis.sRem(`presence:${roomId}`, user)
    emit(roomId, 'presence', { users: await usersIn(roomId) })
  })
})

// 在线用户：以 Redis 为准（跨实例才对齐得起来）
async function usersIn(roomId) {
  return await redis.sMembers(`presence:${roomId}`)
}
function emit(roomId, ev, payload) {
  io.to(roomId).emit(ev, payload)
}

httpServer.listen(PORT, () => {
  console.log(`[room-service] 房间服务 :${PORT}（Redis 共享真相源）`)
  console.log('   token 校验/在线统计都来自 Redis；聊天广播走 socket.io')
})