// shared/redis.mjs —— 控制面 & 房间服务 共享的 Redis 客户端（单一真相源）
// 用 Redis 把"房间存在 + token 有效性 + 当前在线"对齐起来：
//   键                  值               生命周期
//   token:{token}   -> roomId           PX = token 有效时间(默认1分钟)
//   room:{roomId}   -> name(JSON)       EX = 房间保留时间
//   presence:{roomId} -> SET of 用户名  有连接时由房间服务维护
import { createClient } from 'redis'

let client = null
let conn = null

export async function getRedis() {
  if (client) return client
  if (!conn) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379'
    client = createClient({ url })
    client.on('error', (e) => console.error('[redis] error:', e.message))
    conn = client.connect().catch((e) => {
      console.error('[redis] 连接失败:', e.message)
      conn = null
      throw e
    })
  }
  await conn
  return client
}