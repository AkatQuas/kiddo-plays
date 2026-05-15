import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

export async function hashPassword(password: string): Promise<string> {
  return await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);
}

export async function verifyPassword(
  input: string,
  storedHash: string
): Promise<boolean> {
  const hash = await hashPassword(input);
  return hash === storedHash;
}

export function generateOrderNo(): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${dateStr}${rand}`;
}