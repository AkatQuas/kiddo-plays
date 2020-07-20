window.onload = () => {
  const channel = prompt('Enter channel name:');
  if (!channel) {
    window.location.reload();
    return;
  }

  let sendChannel, receiveChannel;
  let localStream, remoteStream;

  let pc; // peer connection

  let isChannelReady = false;
  let isInitiator = false;
  let isStarted = false;

  const pc_config = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }] };
  // const pc_config = { iceServers: [{ url: 'stun:23.21.150.121' }] };

  const pc_constraints = {
    optional: [
      {
        DtlsSrtpKeyAgreement: true,
      },
    ],
  };

  const sdpContstraints = {};

  const constraints = { video: true, audio: true };

  const sendButton = document.querySelector('#sendButton');
  const sendTextarea = document.querySelector('#dataChannelSend');
  const receiveTextarea = document.querySelector('#dataChannelReceive');

  const localVideo = document.querySelector('#localVideo');
  const remoteVideo = document.querySelector('#remoteVideo');

  sendButton.addEventListener('click', sendData);

  const socket = io.connect('http://localhost:8181');

  console.log('Temptation to Create or join channel', channel);

  socket.emit('create or join', channel);

  socket.on('created', (channel) => {
    console.log(`Created channel ${channel}`);
    isInitiator = true;

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(handleUserMedia)
      .catch(handleUserMediaError);

    console.log('Getting user media with constrains ', constraints);
  });
  socket.on('full', (channel) => {
    console.log(`Channel ${channel} is full.`);
  });

  // handle `join` event,
  // another peer is joining the channel
  socket.on('join', (channel) => {
    console.log('Another peer made a request to join channel ', channel);
    console.log('This is the is the initiator of channel ', channel);
    isChannelReady = true;
    checkAndStart();
  });

  // handle `joined` event,
  // this is the second peer joining the channel
  socket.on('joined', (channel) => {
    console.log('This peer has joined channel ', channel);
    isChannelReady = true;

    // call getUserMedia
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(handleUserMedia)
      .catch(handleUserMediaError);

    console.log('Getting user media with constraints', constraints);
  });

  socket.on('log', (args) => {
    console.log.apply(console, args);
  });

  socket.on('message', (msg) => {
    console.log('Received mesasge: ', msg);
    const { channel, data } = msg;

    if (data === 'got user media') {
      console.log('got user media!!!');
      checkAndStart();
    } else if (data.type === 'offer') {
      if (!isInitiator) {
        checkAndStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(data));
      doAnswer();
    } else if (data.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === 'candidate' && isStarted) {
      const candidate = new RTCIceCandidate({
        sdpMLineIndex: data.label,
        candidate: data.candidate,
      });
      pc.addIceCandidate(candidate);
    } else if (data === 'bye' && isStarted) {
      handleRemoteHangup();
    }
  });

  window.onbeforeunload = () => {
    hangup();
  };

  function checkAndStart() {
    // started
    // no localstream
    // channel not ready
    if (isStarted || !localStream || !isChannelReady) {
      return;
    }
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }

  function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpContstraints);
  }

  // create Offer
  function doCall() {
    console.log('Creating Offer...');
    pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpContstraints);
  }

  function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
  }

  function onSignalingError(err) {
    console.error(`Failed to create signaling message: ${err.name}`);
  }

  function createPeerConnection() {
    try {
      pc = new RTCPeerConnection(pc_config, pc_constraints);

      pc.addStream(localStream);

      pc.onicecandidate = handleIceCandidate;
      console.log(
        `Created RTCPeerConnection with:\n    config:${JSON.stringify(
          pc_config
        )}\n    constraints: ${JSON.stringify(pc_constraints)}\n.`
      );
    } catch (err) {
      console.error(
        `Failed to create PeerConnection, exception: ${err.message}`
      );
      window.alert('Cannot create RTCPeerConnection object.');
      return;
    }

    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;

    if (isInitiator) {
      try {
        sendChannel = pc.createDataChannel('sendDataChannel', {
          reliable: true,
        });
        trace('Created send data channel');
      } catch (err) {
        window.alert(`Failed to create data channel.`);
        trace(`createDataChannel() failed with exception: ${err.message}`);
        return;
      }

      sendChannel.onopen = handleSendChannelStateChange;
      sendChannel.onmessage = handleMessage;
      sendChannel.onclose = handleSendChannelStateChange;
    } else {
      // Joiner
      pc.ondatachannel = gotReceiveChannel;
    }
  }

  function handleIceCandidate(ev) {
    console.log('handleIceCandidate event: ', ev);
    if (ev.candidate) {
      sendMessage({
        type: 'candidate',
        label: ev.candidate.sdpMLineIndex,
        id: ev.candidate.sdpMid,
        candidate: ev.candidate.candidate,
      });
    } else {
      console.log('End of candidates');
    }
  }
  function handleRemoteStreamAdded(ev) {
    console.log('Remote stream added.');
    attachMediaStream(remoteVideo, ev.stream);
    remoteStream = ev.stream;
    console.log('Remote stream attached!!');
  }

  function handleRemoteStreamRemoved(ev) {
    console.log('Remote stream removed. Event: ', ev);
  }
  function handleSendChannelStateChange() {
    const readyState = sendChannel.readyState;
    trace('SendChannel state is : ', readyState);

    if (readyState === 'open') {
      sendTextarea.disabled = false;
      sendTextarea.focus();
      sendTextarea.placeholder = '';
      sendButton.disabled = false;
    } else {
      sendTextarea.disabled = true;
      sendButton.disabled = true;
    }
  }

  function handleMessage(ev) {
    trace(`Receive message: ${ev.data}`);
    receiveTextarea.value += `${ev.data}\n`;
  }
  function gotReceiveChannel(ev) {
    trace('Receive Channel callback');
    receiveChannel = ev.channel;
    receiveChannel.onmessage = handleMessage;
    receiveChannel.onopen = handleReceiveChannelStateChange;
    receiveChannel.onclose = handleReceiveChannelStateChange;
  }

  function handleReceiveChannelStateChange() {
    const readyState = receiveChannel.readyState;
    trace('ReceiveChannel state is: ', readyState);
  }

  function handleUserMedia(stream) {
    localStream = stream;
    console.log(localVideo);
    attachMediaStream(localVideo, stream);
    console.log('Adding local stream');
    sendMessage('got user media');
  }

  function handleUserMediaError(err) {
    console.error('navigator.mediaDevice.getUserMedia error: ', err);
  }

  function sendData() {
    const data = sendTextarea.value;
    if (isInitiator) {
      sendChannel.send(data);
    } else {
      receiveChannel.send(data);
    }
    trace('Send data: ' + data);
  }

  // send message to the other peer via the signaling server
  function sendMessage(msg) {
    console.log('Sending message', msg);
    socket.emit('message', {
      data: msg,
      channel,
    });
  }

  function hangup() {
    console.log('Hanging up');
    stop();
    sendMessage('bye');
  }
  function stop() {
    isStarted = false;
    if (sendChannel) sendChannel.close();

    if (receiveChannel) receiveChannel.close();

    if (pc) pc.close();

    pc = null;

    sendButton.disabled = true;
  }
  function handleRemoteHangup() {
    console.log('Session terminated');
    stop();
    isInitiator = false;
  }
};
