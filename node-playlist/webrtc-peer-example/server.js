const http = require('http');
const Koa = require('koa');
const koaStatic = require('koa-static');
const path = require('path');

const app = new Koa();
app.use(koaStatic(path.resolve(__dirname, 'public')));
const server = http.createServer(app.callback());

const io = require('socket.io')(server);

server.listen(8181, () => {
  console.log('Server running at 8181');
});

io.sockets.on('connection', (socket) => {
  function log(...args) {
    const array = ['>>> '].concat(args);
    socket.emit('log', array);
  }

  socket.on('message', (msg) => {
    log('S --> got message: ', msg);
    console.log('msg.channel -> ', msg.channel);

    socket.broadcast.to(msg.channel).emit('message', msg);
  });

  socket.on('create or join', (channel) => {
    io.in(channel).clients((err, clients) => {
      const amount = clients.length;

      log(`S --> Room ${channel} has ${amount} client(s)`);
      log(`S --> Request to create or join room ${channel}`);

      if (amount === 0) {
        socket.join(channel);
        socket.emit('created', channel);
      } else if (amount === 1) {
        io.sockets.in(channel).emit('join', channel);
        socket.join(channel);
        socket.emit('joined', channel);
      } else {
        socket.emit('full', channel);
      }
    });
  });
  socket.on('close', () => {
    console.log('DEAD');
  });
});
