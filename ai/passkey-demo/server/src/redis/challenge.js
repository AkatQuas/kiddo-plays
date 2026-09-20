import { getRedis } from './client.js';
import { config } from '../config.js';

export async function setChallenge(key, payload) {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(payload), 'EX', config.challengeTtlSec);
}

export async function consumeChallenge(key) {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
