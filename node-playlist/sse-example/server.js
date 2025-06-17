const express = require('express');
const { readFileSync } = require('node:fs');
const app = express();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* shortGenerator() {
  for (let i = 1; i <= 3; i++) {
    yield `string ${i}`;
    // Wait for a random time between 100 and 1000 milliseconds
    const delay = Math.floor(Math.random() * 900) + 100;
    await sleep(delay);
  }
}

app.get('/front.html', (req, res) => {
  const content = readFileSync('./front.html');
  res.write(content);
});

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Function to send an event
  const sendData = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const sendEvent = (ev, data) => {
    res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const sendEventOnly = (ev) => {
    res.write(`event: ${ev}\ndata: {}\n\n`);
  };

  // Send initial event
  sendData({ message: 'Connection established' });

  // Send periodic updates
  const interval = setInterval(() => {
    const now = new Date();
    sendData({ message: 'Server update', timestamp: now });
    sendEvent('ping', { time: now });
    sendEvent('custom-event', { hello: 42, time: now });
    sendEventOnly('jack');
  }, 2200);

  // Clean up when the connection is closed
  // req.on('close', () => {
  //   clearInterval(interval);
  //   console.debug('\x1B[97;100;1m --- closed --- \x1B[m', '\n');
  //   res.end();
  // });

  // close connection by timeout
  setTimeout(() => {
    clearInterval(interval);
    res.end();
  }, 6700);
});

app.post('/stream', async (req, res) => {
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.status(200);
  res.on('close', () => {
    res.end();
  });

  try {
    for await (const s of shortGenerator()) {
      const chunkData = {
        content: s,
        role: 'shortGenerator',
        eventType: 'shortGenerator',
      };
      res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
    }
    res.end();
  } catch (error) {
    res.end();
  }

  return res;
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
