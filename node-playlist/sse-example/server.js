const express = require('express');
const { readFileSync } = require('node:fs');
const app = express();

app.get('/front.html', (req, res) => {
  const content = readFileSync('./front.html');
  res.write(content);
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
