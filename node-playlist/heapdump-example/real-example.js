const express = require('express');
const session = require('express-session');
const { writeHeapSnapshot } = require('node:v8');

const app = express();

app.use(
  session({
    secret: 'secret goes here',
  })
);

app.get('/', (req, res) => {
  res.send(`
    <h2>Take a look at the network tab in devtools</h2>
    <script>
        function loops(func) {
          return func().then(_ => setTimeout(loops, 10, func))
        }

        loops(_ => fetch('/',{ mode: 'same-origin', credentials: 'omit' }))
    </script>
    `);
});

app.get('/snapshot', (req, res) => {
  writeHeapSnapshot();
  res.end();
});

app.listen(8080, () => {
  console.log(
    'Server running at http://localhost:8080 🚀 \nVisit http://localhost:8080/snapshot to create snapshot files.'
  );
});
