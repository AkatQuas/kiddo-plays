#!/usr/bin/env node
/**
 * WebSocket 聊天客户端 CLI — 通过 NGINX 网关连接
 * 用法: node demo/chat-client.js [username] [room]
 *
 * 测试网关的 WebSocket 代理功能:
 *   客户端 → NGINX(:8080) → chat-service(:3004)
 *   连接路径: http://localhost:8080/ws/chat
 */

const { io } = require('socket.io-client');

const GATEWAY = 'http://localhost:8080';
const username = process.argv[2] || 'pi-agent';
const room = process.argv[3] || 'general';

console.log(`
╔══════════════════════════════════════════╗
║  WebSocket Chat Client (via NGINX)      ║
║  Gateway: ${GATEWAY}
║  Path:   /ws/chat                       ║
║  User:   ${username.padEnd(27)}║
║  Room:   ${room.padEnd(28)}║
╚══════════════════════════════════════════╝
`);

const socket = io(GATEWAY, {
  path: '/ws/chat',
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log(`✅ Connected to gateway ${GATEWAY}`);
  console.log(`   Socket ID: ${socket.id}`);

  // 加入房间
  socket.emit('join-room', room, username);
  console.log(`   Joined room: ${room}`);
  console.log(`\n📝 输入消息回车发送，输入 /exit 退出\n`);
});

socket.on('connect_error', (err) => {
  console.error(`❌ Connection failed: ${err.message}`);
  console.log(`   确保 NGINX 网关(:8080) 和 chat-service(:3004) 已启动`);
  process.exit(1);
});

// 聊天消息
socket.on('chat-message', (msg) => {
  const time = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`[${time}] ${msg.from}: ${msg.text}`);
});

// 系统消息
socket.on('system-message', (msg) => {
  const time = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`[${time}] 🔔 ${msg.text} (在线: ${msg.online})`);
});

socket.on('error-msg', (msg) => {
  console.error(`❌ ${msg}`);
});

socket.on('disconnect', (reason) => {
  console.log(`🔴 Disconnected: ${reason}`);
});

// 从 stdin 读取消息
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (line) => {
  const text = line.trim();
  if (!text) return;
  if (text === '/exit') {
    console.log('👋 退出');
    socket.disconnect();
    process.exit(0);
  }
  socket.emit('message', text);
});

process.stdin.on('end', () => {
  socket.disconnect();
  process.exit(0);
});
