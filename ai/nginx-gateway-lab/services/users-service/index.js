/**
 * Users Service — 模拟用户服务，监听 3001 端口
 * 作为上游服务之一，通过网关对外暴露
 */
const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

// Mock 用户数据
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
];

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ service: 'users-service', status: 'UP', port: PORT });
});

// GET /users — 获取用户列表
app.get('/users', (req, res) => {
  console.log(`[Users] GET /users`);
  res.json({ service: 'users-service', data: users });
});

// GET /users/:id — 获取单个用户
app.get('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  console.log(`[Users] GET /users/${id} → ${user ? 'found' : 'not found'}`);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ service: 'users-service', data: user });
});

// POST /users — 创建用户（模拟）
app.post('/users', (req, res) => {
  const { name, email, role } = req.body;
  console.log(`[Users] POST /users → ${name}`);
  const newUser = { id: users.length + 1, name, email, role: role || 'user' };
  users.push(newUser);
  res.status(201).json({ service: 'users-service', data: newUser });
});

app.listen(PORT, () => {
  console.log(`✅ Users Service running on http://localhost:${PORT}`);
});