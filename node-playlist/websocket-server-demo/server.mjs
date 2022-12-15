import express from 'express';
import { createServer, IncomingMessage, Server } from 'http';
import { parse, URLSearchParams } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = 10100;
let /** @type {Server} */ server;
let /** @type {WebSocketServer} */ wss;
function main() {
  const app = express();
  app.get('/api/test', function (req, res) {
    //
    // "Log in" user and set userId to session.
    //
    const id = Math.random().toString(36).slice(2);

    console.log(req.query);
    console.log(`Updating session for user ${id}`);
    res.send({ result: 'OK', message: 'Session updated' });
  });

  app.use(express.static('./'));

  // route handler with express
  app.all('*', (req, res, next) => {
    console.debug('\x1B[97;42;1m --- req --- \x1B[m', '\n', { url: req.url });
    if (req.url.includes('/battle-room/apply')) {
      res.json({ room_id: 'Hello World!', token: 'hello_42' });
      return;
    }
    res.json({ message: 'the fallback' });
  });
  server = createServer(app);
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
      ws.send('hello, stranger. -- from Express');
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
