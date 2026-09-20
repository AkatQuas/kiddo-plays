import { getRedis } from './client.js';

export async function usernameExists(username) {
  const redis = getRedis();
  const userId = await redis.get(`username:${username}`);
  return Boolean(userId);
}

export async function getUserIdByUsername(username) {
  const redis = getRedis();
  return redis.get(`username:${username}`);
}

export async function getUserById(userId) {
  const redis = getRedis();
  const data = await redis.hgetall(`user:${userId}`);
  if (!data || !data.username) return null;
  return {
    userId,
    username: data.username,
    displayName: data.displayName || data.username,
    createdAt: data.createdAt,
  };
}

export async function getUserByUsername(username) {
  const userId = await getUserIdByUsername(username);
  if (!userId) return null;
  return getUserById(userId);
}

export async function createUserWithCredential({ userId, username, displayName, credential }) {
  const redis = getRedis();
  const now = new Date().toISOString();

  const reserved = await redis.set(`username:${username}`, userId, 'NX');
  if (reserved !== 'OK') {
    return { ok: false };
  }

  try {
    const multi = redis.multi();
    multi.hset(`user:${userId}`, {
      username,
      displayName: displayName || username,
      createdAt: now,
    });
    multi.hset(`cred:${credential.credentialId}`, {
      userId,
      publicKey: credential.publicKey,
      counter: String(credential.counter),
      deviceName: credential.deviceName,
      backedUp: String(credential.backedUp),
      transports: JSON.stringify(credential.transports || []),
      createdAt: now,
      lastUsedAt: now,
    });
    multi.sadd(`user:${userId}:creds`, credential.credentialId);
    await multi.exec();
    return { ok: true };
  } catch (err) {
    await redis.del(`username:${username}`);
    throw err;
  }
}
