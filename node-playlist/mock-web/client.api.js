const http = require('http');

// 服务地址
const host = '127.0.0.1';
const port = 21210;

// 要测试的接口列表
const apis = [
  '/',
  '/api/status',
  '/api/random',
  '/api/notfound' // 测试404
];

// 逐个请求测试
for (const path of apis) {
  testApi(path);
}

// 测试单个接口
function testApi(path) {
  const options = { host, port, path, method: 'GET' };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`\n=== 接口：${path} ===`);
      console.log('状态码：', res.statusCode);
      try {
        console.log('返回数据：', JSON.parse(data));
      } catch (e) {
        console.log('返回数据：', data);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`请求 ${path} 失败：`, err.message);
  });

  req.end();
}
