// 安装依赖：npm install express ws
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const PORT = 21210;
const app = express();

function statusData() {
  return {
    port: PORT,
    userId: '002',
    version: '3.1.8',
    pid: process.pid, // 当前进程ID
    time: new Date().toISOString()
  };
}

// 创建 HTTP 服务器（给 Express + WebSocket 共用）
const server = http.createServer(app);

// ==================== 【本地测试】全局跨域（已开启） ====================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});


// ==================== WebSocket 服务 ====================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('✅ WebSocket 客户端已连接');

  // 接收客户端消息
  ws.on('message', (data) => {
    const msg = data.toString();
    console.log('📩 收到客户端消息：', msg);

    // 回复客户端
    ws.send(`服务端已收到：${msg}`);
  });

  // 断开连接
  ws.on('close', () => {
    console.log('❌ WebSocket 客户端断开连接');
  });
});

// ==================== Express 接口（完全保留你原来的逻辑） ====================
// 日志
app.use((req, res, next) => {
  console.log('got request, method %s url %s', req.method, req.path);
  next();
});

// 根路径 /
app.get('/', (req, res) => {
  res.json({
    code: 200,
    message: '服务运行正常',
    data: statusData()
  });
});

// /api/status
app.get('/api/status', (req, res) => {
  res.json({
    code: 200,
    message: '服务运行正常',
    data: statusData()
  });
});

// /api/random
app.get('/api/random', (req, res) => {
  res.json({
    code: 200,
    message: '服务运行正常',
    data: {
      random: Math.random().toString(32).slice(2),
      time: new Date().toISOString()
    }
  });
});

// 404
app.use((req, res) => {
  console.warn('404 fallback, method %s url %s', req.method, req.path);
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  });
});

// ==================== 启动服务 ====================
server.listen(PORT, '127.0.0.1', () => {
  console.log(`服务已启动：http://127.0.0.1:${PORT}`);
  console.log(`WebSocket：ws://127.0.0.1:${PORT}`);
  console.log(`状态接口：http://127.0.0.1:${PORT}/api/status`);
});
