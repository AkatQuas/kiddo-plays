#!/usr/bin/env node
/**
 * lark-cli 凭据解密脚本
 *
 * 加密方案: AES-256-GCM
 * - 密钥文件: ~/Library/Application Support/lark-cli/master.key.file (32 字节原始二进制)
 * - macOS Keychain 后备: service="lark-cli", account="master.key" (Base64 编码)
 * - AppSecret 密文: ~/Library/Application Support/lark-cli/appsecret_cli_<appId>.enc
 * - 用户凭证密文: ~/Library/Application Support/lark-cli/<appId>_<openId>.enc
 * - 格式: nonce(12) || ciphertext || tag(16)
 * - 应用配置: ~/.lark-cli/config.json
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ============================================================
// 路径定义
// ============================================================

/** macOS 凭证存储目录 (keychain.StorageDir) */
const STORAGE_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'lark-cli');

/** 应用配置目录 */
const CONFIG_DIR = path.join(os.homedir(), '.lark-cli');

/** 主密钥文件名 */
const MASTER_KEY_FILE = 'master.key.file';

// ============================================================
// 工具函数
// ============================================================

/** 加密文件名的 account 部分编码方式 (safeFileName) */
function safeFileName(account) {
  return account.replace(/[^a-zA-Z0-9._-]/g, '_') + '.enc';
}

/** 读取应用配置 */
function readConfig() {
  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`应用配置文件不存在: ${configPath}\n请先运行 lark-cli config init --new 进行配置`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

/** 从 macOS Keychain 读取 master key (base64 encoded 32 bytes) */
function readMasterKeyFromKeychain() {
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync('security', [
      'find-generic-password',
      '-s', 'lark-cli',
      '-l', 'master.key',
      '-w'
    ], { encoding: 'utf-8', timeout: 5000 }).trim();
    if (!out) return null;
    return Buffer.from(out, 'base64');
  } catch {
    return null;
  }
}

/** 从文件读取 master key (32 字节原始二进制) */
function readMasterKeyFromFile() {
  const keyPath = path.join(STORAGE_DIR, MASTER_KEY_FILE);
  if (!fs.existsSync(keyPath)) return null;
  const key = fs.readFileSync(keyPath);
  return key;
}

/** 获取主密钥 (文件优先，失败时回退到 Keychain) */
function getMasterKey() {
  // 文件优先（免 Keychain 依赖，适合沙箱）
  let key = readMasterKeyFromFile();
  let source = 'file';

  if (!key) {
    key = readMasterKeyFromKeychain();
    source = 'keychain';
  }

  if (!key) {
    throw new Error(
      `主密钥未找到。\n` +
      `  检查路径: ${path.join(STORAGE_DIR, MASTER_KEY_FILE)}\n` +
      `  或运行 Keychain 降级: lark-cli config keychain-downgrade\n` +
      `  (从 Keychain 导出密钥到文件，后续沙箱环境可直接读取)`
    );
  }

  if (key.length !== 32) {
    throw new Error(`主密钥长度异常: 期望 32 字节, 实际 ${key.length} 字节 (来源: ${source})`);
  }

  console.log(`主密钥来源: ${source}`);
  console.log(`密钥 (hex): ${key.toString('hex')}`);
  console.log(`密钥长度: ${key.length} 字节\n`);

  return { key, source };
}

/** AES-256-GCM 解密 */
function decryptAesGcm(data, key) {
  const NONCE_SIZE = 12;
  const TAG_SIZE = 16;

  if (data.length < NONCE_SIZE + TAG_SIZE) {
    throw new Error(`密文过短: ${data.length} 字节, 至少需要 ${NONCE_SIZE + TAG_SIZE} 字节`);
  }

  const nonce = data.subarray(0, NONCE_SIZE);
  const ciphertext = data.subarray(NONCE_SIZE, data.length - TAG_SIZE);
  const tag = data.subarray(data.length - TAG_SIZE);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(ciphertext);
  try {
    plaintext = Buffer.concat([plaintext, decipher.final()]);
  } catch (e) {
    throw new Error(`解密失败 (密钥不匹配或数据损坏): ${e.message}`);
  }

  return { plaintext, nonce, ciphertext, tag };
}

// ============================================================
// 解密凭证
// ============================================================

/** 解密 AppSecret */
function decryptAppSecret(key, config) {
  const appSecretMeta = config.apps?.[0]?.appSecret;
  if (!appSecretMeta?.id) throw new Error('config.json 中未找到 appSecret.id');

  // Keychain account 名 = appSecret.id（格式: "appsecret:<appId>"）
  // 通过 safeFileName 转换为文件名: appsecret_<appId>.enc
  const account = appSecretMeta.id;
  const encFile = path.join(STORAGE_DIR, safeFileName(account));
  if (!fs.existsSync(encFile)) {
    throw new Error(`AppSecret 密文文件不存在: ${encFile}\n请先运行 lark-cli config init --new`);
  }

  const data = fs.readFileSync(encFile);
  console.log(`AppSecret 密文: ${encFile}`);
  console.log(`密文大小: ${data.length} 字节`);
  console.log(`密文 (hex): ${data.toString('hex')}\n`);

  const result = decryptAesGcm(data, key);

  console.log(`Nonce (hex): ${result.nonce.toString('hex')} (${result.nonce.length} 字节)`);
  console.log(`Ciphertext (hex): ${result.ciphertext.toString('hex')} (${result.ciphertext.length} 字节)`);
  console.log(`Tag (hex): ${result.tag.toString('hex')} (${result.tag.length} 字节)`);
  console.log(`\n✅ AppSecret 解密成功! (${result.plaintext.length} 字节)`);

  const secret = result.plaintext.toString('utf-8');
  console.log(`AppSecret: ${secret}\n`);

  return secret;
}

/** 解密用户凭证 (UAT / RefreshToken) */
function decryptUserCredentials(key) {
  // 找出所有 <appId>_<openId>.enc 文件
  const files = fs.readdirSync(STORAGE_DIR)
    .filter(f => f.endsWith('.enc') && f.includes('_') && !f.startsWith('appsecret_'));

  if (files.length === 0) {
    console.log('⚠️  未找到用户凭证加密文件。请先运行 lark-cli auth login 完成授权。\n');
    return null;
  }

  for (const file of files) {
    const encFile = path.join(STORAGE_DIR, file);
    const data = fs.readFileSync(encFile);
    const sizeKB = (data.length / 1024).toFixed(1);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`用户凭证: ${file}`);
    console.log(`密文大小: ${sizeKB} KB`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const result = decryptAesGcm(data, key);

      console.log(`✅ 解密成功! (${result.plaintext.length} 字节)`);
      console.log(`\n--- JSON 明文 ---`);
      console.log(result.plaintext.toString('utf-8'));

      // 解析 JSON
      try {
        const creds = JSON.parse(result.plaintext.toString('utf-8'));
        console.log(`\n--- 结构化数据 ---`);
        console.log(JSON.stringify(creds, null, 2));

        if (creds.access_token) {
          console.log(`\n🎫 User Access Token  : ${creds.access_token}`);
        }
        if (creds.refresh_token) {
          console.log(`🔄 Refresh Token      : ${creds.refresh_token}`);
        }
        if (creds.scope) {
          console.log(`📋 Scope              : ${creds.scope}`);
        }
        if (creds.open_id || creds.openId) {
          console.log(`👤 OpenID             : ${creds.open_id || creds.openId}`);
        }
        if (creds.expires_in) {
          console.log(`⏱️ Expires in         : ${creds.expires_in}秒`);
        }
        return creds;
      } catch (e) {
        console.log(`⚠️  明文不是合法 JSON: ${e.message}`);
      }
    } catch (e) {
      console.log(`❌ 解密失败: ${e.message}`);
    }
  }

  return null;
}

// ============================================================
// 主程序
// ============================================================

function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   lark-cli 凭证解密工具                     ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // 1. 读取配置
  console.log('--- 应用配置 ---');
  const config = readConfig();
  console.log(JSON.stringify(config, null, 2));
  console.log('');

  // 2. 获取主密钥
  console.log('--- 主密钥 ---');
  const { key } = getMasterKey();

  // 3. 解密 AppSecret
  console.log('--- AppSecret ---');
  const appSecret = decryptAppSecret(key, config);

  // 4. 解密用户凭证
  console.log('--- 用户凭证 ---');
  const userCreds = decryptUserCredentials(key);

  // 5. 汇总输出
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   凭证萃取完成                              ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const appId = config.apps?.[0]?.appId || '未知';
  const brand = config.apps?.[0]?.brand || 'feishu';
  const users = config.apps?.[0]?.users || [];

  console.log(`应用 ID:     ${appId}`);
  console.log(`品牌:        ${brand}`);
  console.log(`AppSecret:   ${appSecret}`);
  if (users.length > 0) {
    console.log(`已授权用户:   ${users.map(u => `${u.userName} (${u.userOpenId})`).join(', ')}`);
  }
  if (userCreds?.access_token) {
    console.log(`有効 UAT:    ${userCreds.access_token}`);
  }

  // 6. 输出可复用的环境变量配置
  console.log('\n--- 可复用的环境变量 (直接注入沙箱) ---\n');

  const envVars = [
    `export LARKSUITE_CLI_APP_ID=${appId}`,
    `export LARKSUITE_CLI_APP_SECRET=${appSecret}`,
    `export LARKSUITE_CLI_BRAND=${brand}`,
    `export LARKSUITE_CLI_DEFAULT_AS=user`,
  ];

  if (userCreds?.access_token) {
    envVars.push(`export LARKSUITE_CLI_USER_ACCESS_TOKEN=${userCreds.access_token}`);
  }

  envVars.forEach(e => console.log(`  ${e}`));
  console.log('');

  // 如需同时注入租户令牌（bot 身份）
  console.log('# 可选: 如需 Bot 身份 (租户级别操作):');
  console.log(`  export LARKSUITE_CLI_DEFAULT_AS=bot`);
  console.log(`  export LARKSUITE_CLI_TENANT_ACCESS_TOKEN=<tenant_access_token>`);
  console.log('');

  console.log('# 可选: 严格模式限制身份类型:');
  console.log('  export LARKSUITE_CLI_STRICT_MODE=user    # 仅允许用户身份');
  console.log('  export LARKSUITE_CLI_STRICT_MODE=bot     # 仅允许 Bot 身份');
  console.log('  export LARKSUITE_CLI_STRICT_MODE=off     # 允许任意身份\n');

  console.log('# 使用示例 (沙箱内):');
  console.log(`  eval "$(node lark-decrypt.js | grep '^export ')" && lark-cli auth status`);
}

try {
  main();
} catch (e) {
  console.error(`\n❌ 错误: ${e.message}`);
  process.exit(1);
}
