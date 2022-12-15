import { WebSocket } from 'ws';

function connect() {
  const ws = new WebSocket(
    'ws://localhost:10100/battle-room/join?token=aoh23nt&ticket=room_123&role=ide&target=phone'
  );
  ws.on('open', () => {
    console.debug('\x1B[97;42;1m --- client connected --- \x1B[m', '\n', {});
    setInterval(() => {
      ws.send('--PING--');
    }, 1500);
  });
  ws.on('message', (raw) => {
    console.debug('\x1B[97;100;1m --- message heard --- \x1B[m', '\n', {
      message: raw.toString(),
    });
  });
  ws.on('error', (err) => {
    console.debug('\x1B[97;101;1m --- on error --- \x1B[m', '\n', { err });
  });
  ws.on('close', (code, reason) => {
    console.log('client closed', {
      code,
      reason: reason.toString(),
    });
  });

  console.debug('\x1B[91;103;1m --- close the client with CTRL+C --- \x1B[m');
}

connect();
