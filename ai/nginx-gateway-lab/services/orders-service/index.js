/**
 * Orders Service — 模拟订单服务，监听 3002 端口
 * 作为上游服务之一，通过网关对外暴露
 */
const express = require('express');
const app = express();
const PORT = 3002;

app.use(express.json());

// Mock 订单数据
const orders = [
  { id: 1001, userId: 1, product: 'Laptop', amount: 9999, status: 'delivered' },
  { id: 1002, userId: 1, product: 'Mouse', amount: 199, status: 'shipped' },
  { id: 1003, userId: 2, product: 'Keyboard', amount: 599, status: 'pending' },
  { id: 1004, userId: 3, product: 'Monitor', amount: 2499, status: 'pending' },
];

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ service: 'orders-service', status: 'UP', port: PORT });
});

// GET /orders — 获取所有订单
app.get('/orders', (req, res) => {
  console.log(`[Orders] GET /orders`);
  res.json({ service: 'orders-service', data: orders });
});

// GET /orders/:id — 获取单个订单
app.get('/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find(o => o.id === id);
  console.log(`[Orders] GET /orders/${id} → ${order ? 'found' : 'not found'}`);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ service: 'orders-service', data: order });
});

// GET /orders/user/:userId — 按用户查询订单
app.get('/orders/user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userOrders = orders.filter(o => o.userId === userId);
  console.log(`[Orders] GET /orders/user/${userId} → ${userOrders.length} orders`);
  res.json({ service: 'orders-service', data: userOrders });
});

// POST /orders — 创建订单（模拟）
app.post('/orders', (req, res) => {
  const { userId, product, amount } = req.body;
  console.log(`[Orders] POST /orders → ${product} for user ${userId}`);
  const newOrder = {
    id: orders.length + 1001,
    userId,
    product,
    amount,
    status: 'pending',
  };
  orders.push(newOrder);
  res.status(201).json({ service: 'orders-service', data: newOrder });
});

app.listen(PORT, () => {
  console.log(`✅ Orders Service running on http://localhost:${PORT}`);
});