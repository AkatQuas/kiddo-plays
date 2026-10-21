#!/usr/bin/env node
/**
 * wecom-cli 凭据解密脚本
 *
 * 加密方案: AES-256-GCM
 * - 密钥: ~/.config/wecom/.encryption_key (Base64 编码的 32 字节)
 * - 密文文件: ~/.config/wecom/credentials.enc
 * - 格式: nonce(12) || ciphertext || tag(16)
 * - 明文: JSON { bot: { id, secret }, token: "..." }
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// 配置目录
const configDir = path.join(require('node:os').homedir(), '.config', 'wecom');

function decryptCredentials(configDir) {
  // 1. 读密钥文件 (Base64)
  const keyPath = path.join(configDir, '.encryption_key');
  const keyB64 = fs.readFileSync(keyPath, 'utf-8').trim();
  const key = Buffer.from(keyB64, 'base64');

  if (key.length !== 32) {
    throw new Error(`密钥长度异常: 期望 32 字节, 实际 ${key.length} 字节`);
  }

  console.log(`密钥文件: ${keyPath}`);
  console.log(`密钥 (Base64): ${keyB64}`);
  console.log(`密钥 (hex): ${key.toString('hex')}`);
  console.log(`密钥长度: ${key.length} 字节\n`);

  // 2. 读密文
  const encPath = path.join(configDir, 'credentials.enc');
  const data = fs.readFileSync(encPath);

  console.log(`密文文件: ${encPath}`);
  console.log(`密文大小: ${data.length} 字节`);
  console.log(`密文 (hex): ${data.toString('hex')}\n`);

  // 3. 解析格式: nonce(12) || ciphertext || tag(16)
  const NONCE_SIZE = 12;
  const TAG_SIZE = 16;

  if (data.length < NONCE_SIZE + TAG_SIZE) {
    throw new Error(`密文过短: ${data.length} 字节, 至少需要 ${NONCE_SIZE + TAG_SIZE} 字节`);
  }

  const nonce = data.subarray(0, NONCE_SIZE);
  const ciphertext = data.subarray(NONCE_SIZE, data.length - TAG_SIZE);
  const tag = data.subarray(data.length - TAG_SIZE);

  console.log(`Nonce (hex): ${nonce.toString('hex')} (${nonce.length} 字节)`);
  console.log(`Ciphertext (hex): ${ciphertext.toString('hex')} (${ciphertext.length} 字节)`);
  console.log(`Tag (hex): ${tag.toString('hex')} (${tag.length} 字节)`);

  // 4. 解密 (AES-256-GCM)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(ciphertext);
  try {
    plaintext = Buffer.concat([plaintext, decipher.final()]);
  } catch (e) {
    throw new Error(`解密失败 (密钥不匹配或数据损坏): ${e.message}`);
  }

  console.log(`\n✅ 解密成功! (${plaintext.length} 字节)`);
  console.log(`\n--- JSON 明文 ---`);
  console.log(plaintext.toString('utf-8'));

  // 5. 解析 JSON
  try {
    const creds = JSON.parse(plaintext.toString('utf-8'));
    console.log(`\n--- 结构化数据 ---`);
    console.log(JSON.stringify(creds, null, 2));

    if (creds.bot) {
      console.log(`\n🤖 Bot ID:     ${creds.bot.id}`);
      console.log(`🤖 Bot Secret: ${creds.bot.secret}`);
    }
    if (creds.token) {
      console.log(`🎫 Bearer Token: ${creds.token}`);
    }
  } catch (e) {
    console.log(`\n⚠️  明文不是合法 JSON: ${e.message}`);
  }

  return plaintext.toString('utf-8');
}

// 主程序
try {
  decryptCredentials(configDir);
} catch (e) {
  console.error(`\n❌ 错误: ${e.message}`);
  process.exit(1);
}
