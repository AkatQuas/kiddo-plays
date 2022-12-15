import { readFileSync } from 'fs';
import { createServer, IncomingMessage, Server } from 'http';
import { resolve } from 'path';
import * as url from 'url';
import { parse, URLSearchParams } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const PORT = 10100;
let /** @type {Server} */ server;
let /** @type {WebSocketServer} */ wss;
function main() {
  server = createServer();
  wss = new WebSocketServer({ noServer: true });
  wss.on(
    'connection',
    (/** @type {WebSocket} */ ws, /** @type {IncomingMessage} */ request) => {
      const parsed = parse(request.url);

      const searchParams = new URLSearchParams(parsed.search);

      ws.on('message', (raw) => {
        const message = raw.toString();
        if (message.includes('--PING--')) {
          ws.send('--PONG--');
          return;
        }
        if (message === 'close') {
          console.debug('\x1B[97;101;1m --- closing --- \x1B[m', '\n');
          ws.send('See ya');
          ws.close();
          return;
        }
        console.debug('\x1B[97;100;1m --- received --- \x1B[m', '\n', message);

        ws.send(message);
      });
      ws.send('hello, stranger. -- from RAW');
    }
  );
  server.on('upgrade', function upgrade(request, socket, head) {
    const { pathname } = parse(request.url);

    if (pathname !== '/battle-room/join') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(
      request,
      socket,
      head,
      /* done  */ (ws) => {
        wss.emit('connection', ws, request);
      }
    );
  });

  // raw handler for request
  server.on('request', (request, res) => {
    const { pathname } = parse(request.url);
    if (pathname === '/index.html') {
      const content = readFileSync(resolve(__dirname, './index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }
    if (pathname !== '/battle-room/apply') {
      // we only handle apply
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 404, message: 'Invalid Path' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        roomid: 'Hello World!',
        token: 'aouhnsho',
      })
    );
  });
  /* allow callback registered successfully */
  process.nextTick(() => {
    server.listen(PORT, () => {
      console.log(
        'visit http://localhost:10100/index.html if you prefer connect websocket from the web page.'
      );
    });
  });
}

main();
