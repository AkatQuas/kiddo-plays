const express = require('express');
const app = express();
const port = 3000;

const marquee = ['log', 'warn', 'debug', 'error'];

let id = 0;
function nonce() {
  console.log('Visit /');

  id = (id + 1) % 4;
  const method = marquee[id];
  console[method](`${method} works`);
}

app.get('/', (req, res) => {
  nonce();
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
