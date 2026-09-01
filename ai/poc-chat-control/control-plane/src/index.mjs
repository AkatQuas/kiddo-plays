// control-plane/src/index.mjs —— 控制面 :3030
// 只管理"房间"资源：建/列/删 + 签发 token。它与房间服务的"共同真相"在 Redis——
// 建房时把 `token:{token}->roomId`(带 TTL) 和 `room:{roomId}` 写进 Redis，
// 房间服务读它来校验 token、并回写在线人数。控制面自己不再维护内存房间表，
// 列表也从 Redis 实时读出来（这就是"数据对齐"）。

import express from 'express'
import { randomUUID } from 'node:crypto'
import { getRedis } from '../../shared/redis.mjs'

const PORT = Number(process.env.PORT || 3030)
const DEFAULT_TTL_MS = 60_000        // token 有效 = 1 分钟
const DEFAULT_ROOM_TTL_MS = 3600_000 // 房间保留 1 小时（超过 token，允许后续另发 token）

const redis = await getRedis()
const app = express()

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

// 建房 + 签发短时效 token（真相写进 Redis）
app.post('/api/rooms', async (req, res) => {
  const name = String(req.body?.name || req.query.name || '未命名房间')
  const ttlMs = Number(req.query.ttl || req.body?.ttlMs || DEFAULT_TTL_MS)
  const roomId = 'room-' + randomUUID().slice(0, 8)
  const token = randomUUID().replace(/-/g, '')        // 不透明 token；Redis 反查它属于哪间房

  await Promise.all([
    redis.set(`token:${token}`, roomId, { PX: Math.max(1, ttlMs) }),           // 过期=Redis 删除=>拒
    redis.set(`room:${roomId}`, JSON.stringify({ name }), { EX: Math.ceil(DEFAULT_ROOM_TTL_MS / 1000) }),
  ])

  res.status(201).json({
    roomId, name, token, ttlMs,
    expiresAt: Date.now() + ttlMs,
    connectUrlKong: process.env.GATEWAY_SOCKET || 'http://localhost:8000',
    connectUrlDirect: process.env.DIRECT_SOCKET || 'http://localhost:8080',
  })
})

// 列房间：实时读 Redis，并顺带查每个房间当前在线数（房间服务写回来的）
app.get('/api/rooms', async (_req, res) => {
  const roomKeys = await redis.keys('room:*')
  const rooms = await Promise.all(roomKeys.map(async (k) => {
    const roomId = k.replace(/^room:/, '')
    const name = await redis.get(k)
    const online = await redis.sCard(`presence:${roomId}`)
    return { roomId, name: name ?? '', online }
  }))
  res.json({ rooms })
})

// 关房：真删 Redis 里的房间（对应"控制面有生杀大权"）
app.delete('/api/rooms/:id', async (req, res) => {
  const id = req.params.id
  // 找出该房间的 token 一并删掉，避免残留的"票"
  const tokenKeys = await redis.keys('token:*')
  await redis.del(`room:${id}`)
  for (const k of tokenKeys) {
    if ((await redis.get(k)) === id) await redis.del(k)
  }
  await redis.del(`presence:${id}`)
  res.json({ ok: true, roomId: id })
})

app.listen(PORT, () => {
  console.log(`[control-plane] 控制面 :${PORT}（Redis 为共享真相源）`)
  console.log('   POST /api/rooms  建房+签 token（token 1 分钟，过期自动作废）')
  console.log('   GET  /api/rooms  列房间（在线数来自房间服务写回的 Redis）')
  console.log('   REDIS_URL=', process.env.REDIS_URL || 'redis://localhost:6379')
})