/**
 * @returns {string}
 */
function currentTime() {
  return 'Time: ' + (performance.now() / 1000).toFixed(3) + ' --&gt;';
}
window.onload = function () {
  const channel = prompt('Enter signaling channel name: ');
  if (!channel) {
    window.location.reload();
    return;
  }

  let isInitiator = false;
  console.log('Trying to create or join channel: ', channel);

  // Get <div> placeholder element from DOM
  const div = document.getElementById('scratchPad');
  // Connect to server
  const socket = io.connect('http://localhost:8181');

  // console.log(socket);

  // handle remote logging message from server
  socket.on('log', (args) => {
    console.log.apply(console, args);
  });

  socket.on('created', (channel) => {
    console.log('channel ' + channel + ' has been created!');
    console.log('This peer is the initiator...');
    isInitiator = true;

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Channel ${channel} has been created! </p>`
    );
    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} This peer is the initiator...</p>`
    );
  });

  // handle `full` event
  socket.on('full', (channel) => {
    console.log(
      `channel ${channel} is too crowded! \n Cannot allow you to join, sorry :-(`
    );

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} channel ${channel} is too crowded! \n Cannot allow you to join, sorry :-(`
    );
  });

  // handle `remotePeerJoining` message
  socket.on('remotePeerJoining', (channel) => {
    console.log(`Request to join ${channel}`);
    console.log(`You are the initiator!`);

    div.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red">${currentTime()} Message from server: request to join channel ${channel} </p>`
    );
  });

  // handle `joined` event
  socket.on('joined', (msg) => {
    console.log('Message from server: ', msg);

    const color = isInitiator ? 'blue' : 'red';

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Message from server: </p><p style="color:${color}">${msg}</p>`
    );
  });

  // handle `broadcast: joined` event
  socket.on('broadcast: joined', (msg) => {
    console.log('Broadcast message from server: ', msg);

    div.insertAdjacentHTML(
      'beforeend',
      `<p style="color:red">${currentTime()} Broadcast message from server: <br />${msg}</p>`
    );

    const myMessage = prompt(
      'Insert message to be sent to your peer:',
      'Hello'
    );

    socket.emit('message', {
      channel: channel,
      message: myMessage,
    });
  });

  // handle `message` event
  socket.on('message', (msg) => {
    console.log('Got message from other peer: ', msg);

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Got Message from other peer: </p><p style="color: blue">${msg}</p>`
    );

    const myResponse = prompt('Send response to ther peer: ', 'Hi');

    socket.emit('response', {
      channel: channel,
      message: myResponse,
    });
  });

  // handle `response` event
  socket.on('response', (response) => {
    console.log('Got response from other peer: ', response);

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Got response from other peer: </p><p style="color:blue">${response}</p>`
    );

    const chatMessage = prompt(
      'keep on chatting. Write "Bye" to quit conversation',
      ''
    );

    if (chatMessage !== 'Bye') {
      socket.emit('response', {
        channel: channel,
        message: chatMessage,
      });
      return;
    }

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Sending "Bye" to server...</p>`
    );
    console.log('Sending "Bye" to server');

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Going to disconnect...</p>`
    );
    console.log('Going to disconnect...');

    socket.disconnect();
  });

  // handle `Bye` event
  socket.on('Bye', () => {
    console.log('Got "Bye" from other peer! Going to disconnect...');

    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Got "Bye" from other peer!</p>`
    );

    console.log('Senidng "Ack" to server');
    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Sending "Ack" to server.</p>`
    );
    socket.emit('Ack');
    div.insertAdjacentHTML(
      'beforeend',
      `<p>${currentTime()} Going to disconnect...`
    );

    socket.disconnect();
  });

  socket.emit('create or join', channel);
};
