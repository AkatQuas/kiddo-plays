/**
 * Chat Service — WebSocket 聊天服务 (socket.io)
 * 监听 3004 端口，通过 NGINX 网关代理 WebSocket 连接
 *
 * 测试入口:
 *   浏览器打开 http://localhost:8080/chat.html
 *   WebSocket 连接: ws://localhost:8080/ws/chat
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  path: '/ws/chat',           // socket.io 命名空间路径
  transports: ['websocket', 'polling'],
});

const PORT = 3004;
const ROOMS = {};  // roomName → Set<socket.id>

// ===== HTTP 端点 =====

// 健康检查
app.get('/health', (req, res) => {
  res.json({ service: 'chat-service', status: 'UP', port: PORT, websocket: true });
});

// 在线用户数统计
app.get('/chat/stats', (req, res) => {
  const stats = {};
  for (const [room, members] of Object.entries(ROOMS)) {
    stats[room] = members.size;
  }
  res.json({ service: 'chat-service', rooms: stats, total: io.engine?.clientsCount || 0 });
});

// ===== WebSocket 事件 =====

io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-real-ip']
    || socket.handshake.headers['x-forwarded-for']
    || socket.handshake.address;
  console.log(`[Chat] 🟢 Client connected: ${socket.id} (IP: ${clientIp})`);

  // 加入房间
  socket.on('join-room', (roomName, username) => {
    socket.join(roomName);
    socket.data.room = roomName;
    socket.data.username = username || 'Anonymous';
    socket.data.joinedAt = Date.now();

    if (!ROOMS[roomName]) ROOMS[roomName] = new Set();
    ROOMS[roomName].add(socket.id);

    // 通知房间成员
    io.to(roomName).emit('system-message', {
      text: `${socket.data.username} 加入了 ${roomName}`,
      online: ROOMS[roomName].size,
      timestamp: Date.now(),
    });

    console.log(`[Chat] ${socket.data.username} → joined room: ${roomName}`);
  });

  // 发送消息
  socket.on('message', (text) => {
    const room = socket.data.room;
    const username = socket.data.username;
    if (!room) {
      socket.emit('error-msg', '请先加入房间');
      return;
    }

    const msg = {
      from: username,
      text,
      room,
      timestamp: Date.now(),
      id: `${socket.id}-${Date.now()}`,
    };

    io.to(room).emit('chat-message', msg);
    console.log(`[Chat] ${username}@${room}: ${text}`);
  });

  // 断开连接
  socket.on('disconnect', (reason) => {
    const room = socket.data.room;
    const username = socket.data.username;
    console.log(`[Chat] 🔴 Client disconnected: ${socket.id} (${username}) reason: ${reason}`);

    if (room && ROOMS[room]) {
      ROOMS[room].delete(socket.id);
      if (ROOMS[room].size === 0) delete ROOMS[room];

      io.to(room).emit('system-message', {
        text: `${username} 离开了 ${room}`,
        online: ROOMS[room]?.size || 0,
        timestamp: Date.now(),
      });
    }
  });

  // 错误处理
  socket.on('error', (err) => {
    console.error(`[Chat] ❌ Socket error: ${socket.id}`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Chat Service (WebSocket) running on http://localhost:${PORT}`);
  console.log(`   Socket.IO path: /ws/chat`);
});
