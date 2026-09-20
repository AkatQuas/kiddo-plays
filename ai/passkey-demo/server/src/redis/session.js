import { randomUUID } from 'crypto';
import { getRedis } from './client.js';
import { config } from '../config.js';

export async function createSession({ userId, ip, userAgent }) {
  const redis = getRedis();
  const sid = randomUUID();
  const createdAt = new Date().toISOString();

  await redis.hset(`session:${sid}`, {
    userId,
    createdAt,
    ip: ip || '',
    userAgent: userAgent || '',
  });
  await redis.expire(`session:${sid}`, config.sessionTtlSec);

  return { sid, userId, createdAt, ip, userAgent };
}

export async function getSession(sid) {
  if (!sid) return null;
  const redis = getRedis();
  const data = await redis.hgetall(`session:${sid}`);
  if (!data || !data.userId) return null;
  return {
    sid,
    userId: data.userId,
    createdAt: data.createdAt,
    ip: data.ip,
    userAgent: data.userAgent,
  };
}

export async function destroySession(sid) {
  if (!sid) return;
  const redis = getRedis();
  await redis.del(`session:${sid}`);
}
