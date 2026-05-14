const WebSocket = require('ws');

const wsUrl = 'ws://127.0.0.1:21210';
const ws = new WebSocket(wsUrl);

// 计数器：记录发送次数
let sendCount = 0;
// 最多发送 10 次
const MAX_COUNT = 10;

// 连接成功
ws.on('open', () => {
  console.log('✅ WebSocket 连接成功');
  ws.send('Hello 服务端！');
});

// 接收消息
ws.on('message', (data) => {
  console.log('📥 服务端回复：', data.toString());
});

// 定时发消息（自动测试）
const timer = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    sendCount++;
    const msg = `定时消息 ${sendCount} | ${Date.now()}`;
    ws.send(msg);
    console.log(`📤 发送：${msg} （${sendCount}/${MAX_COUNT}）`);

    // 达到 10 次 → 关闭连接
    if (sendCount >= MAX_COUNT) {
      clearInterval(timer); // 停止定时器
      console.log('\n✅ 已发送 10 次，准备关闭连接...');
      ws.close(); // 主动关闭 WebSocket
    }
  }
}, 1000); // 1秒发一次，方便快速测试

// 关闭 & 错误
ws.on('close', () => console.log('❌ 连接已关闭'));
ws.on('error', (err) => console.error('⚠️ 错误：', err.message));
