/**
 * Products Service — 模拟商品服务，监听 3003 端口
 * 作为上游服务之一，通过网关对外暴露
 */
const express = require('express');
const app = express();
const PORT = 3003;

app.use(express.json());

// Mock 商品数据
const products = [
  { id: 201, name: 'Laptop', price: 9999, stock: 50, category: 'electronics' },
  { id: 202, name: 'Mouse', price: 199, stock: 200, category: 'electronics' },
  { id: 203, name: 'Keyboard', price: 599, stock: 150, category: 'electronics' },
  { id: 204, name: 'Monitor', price: 2499, stock: 30, category: 'electronics' },
  { id: 205, name: 'Book: Node.js Guide', price: 99, stock: 500, category: 'books' },
];

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ service: 'products-service', status: 'UP', port: PORT });
});

// GET /products — 获取所有商品
app.get('/products', (req, res) => {
  console.log(`[Products] GET /products`);
  res.json({ service: 'products-service', data: products });
});

// GET /products/:id — 获取单个商品
app.get('/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const product = products.find(p => p.id === id);
  console.log(`[Products] GET /products/${id} → ${product ? 'found' : 'not found'}`);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ service: 'products-service', data: product });
});

// GET /products/search?q=xxx — 搜索商品
app.get('/products/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const results = products.filter(p =>
    p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );
  console.log(`[Products] GET /products/search?q=${q} → ${results.length} results`);
  res.json({ service: 'products-service', data: results });
});

app.listen(PORT, () => {
  console.log(`✅ Products Service running on http://localhost:${PORT}`);
});