const Koa = require('koa');
const koaStatic = require('koa-static');
const path = require('path');
const http = require('http');

const koaApp = new Koa();
koaApp.use(koaStatic(path.resolve(__dirname, 'public')));

// use the http module
// and use the instance of node-static to serve the file
const server = http.createServer(koaApp.callback());

const io = require('socket.io')(server);

io.on('connection', (socket) => {
  // handle `message` event
  socket.on('message', (msg) => {
    log('S --> Got message: ', msg);

    socket.broadcast.to(msg.channel).emit('message', msg.message);
  });

  // handle `create or join` event
  socket.on('create or join', (channel) => {
    io.in(channel).clients((err, clients) => {
      const clientsAmount = clients.length;
      console.log('clientsAmount = ', clientsAmount);

      if (clientsAmount === 0) {
        // first client joining
        socket.join(channel);
        socket.emit('created', channel);
      } else if (clientsAmount === 1) {
        // inform initiator
        io.sockets.in(channel).emit('remotePeerJoining', channel);
        // Let the new peer join channel
        socket.join(channel);

        socket.broadcast
          .to(channel)
          .emit(
            'broadcast: joined',
            'S --> broadcast(): client ' +
              socket.id +
              ' jioned channel ' +
              channel
          );
      } else {
        // max two clients
        console.log('Channel full!');
        socket.emit('full', channel);
      }
    });
  });

  // handle `response` event
  socket.on('response', (response) => {
    log('S --> Got Response: ', response);

    // just forward message to the other peer
    socket.broadcast.to(response.channel).emit('response', response.message);
  });

  // handle `Bye` event
  socket.on('Bye', (channel) => {
    // notify other peer
    socket.broadcast.to(channel).emit('Bye');

    // close socket from server's side
    socket.disconnect();
  });

  // handle `Ack` event
  socket.on('Ack', () => {
    console.log('Got an Ack!');

    // close socket from server's side
    socket.disconnect();
  });

  function log(...args) {
    const array = ['>>> '].concat(args);
    socket.emit('log', array);
  }
});

server.listen(8181, () => {
  console.log('server running on 8181');
});
