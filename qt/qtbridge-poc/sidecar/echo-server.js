'use strict';

/**
 * Node sidecar — interchangeable with echo_server.py.
 * Wire: TCP, one JSON object per line.
 */
const net = require('node:net');
const port = Number(process.argv[2] || 58999);

const server = net.createServer((socket) => {
  let buf = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        msg = { raw: line };
      }
      const reply = {
        from: 'sidecar-node',
        received: msg,
        ts: Date.now(),
      };
      socket.write(JSON.stringify(reply) + '\n');
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`node sidecar listening on ${port}`);
});
