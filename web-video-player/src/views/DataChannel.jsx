import React, { useCallback, useRef, useState } from 'react';
import { error, log } from '../utils/logger';

// JS variables associated with send and receive channels
let sendChannel, receiveChannel;
let localPeerConnection, remotePeerConnection;

function onSignalingError(e) {
  error('Failed to create signaling message : ' + e.name);
}

function gotLocalCandidate(ev) {
  log('Local ice callback');
  if (ev.candidate) {
    remotePeerConnection.addIceCandidate(ev.candidate);
    log('Local ICE candidate: \n' + ev.candidate.candidate);
  }
}
function gotRemoteIceCandidate(ev) {
  log('remote ice callback');
  if (ev.candidate) {
    localPeerConnection.addIceCandidate(ev.candidate);
    log('Remote ICE candidate: \n', ev.candidate.candidate);
  }
}

function gotLocalDescription(desc) {
  // set local SDP as the right (local/remote) description for both local
  // and remote parties
  localPeerConnection.setLocalDescription(desc);
  log('LocalPeerConnection SDP: ', desc.sdp);

  remotePeerConnection.setRemoteDescription(desc);

  // create answer from the remote party, based on the local SDP
  remotePeerConnection.createAnswer(gotRemoteDescription, onSignalingError);
}
function gotRemoteDescription(desc) {
  remotePeerConnection.setLocalDescription(desc);

  log('Answer from remotePeerConnection SDP: \n', desc.sdp);
  localPeerConnection.setRemoteDescription(desc);
}

export const DataChannel = () => {
  const dataChannelSend = useRef(null);
  const dataChannelReceive = useRef(null);
  const [buttonStatus, setButtonStatus] = useState(3);

  const handleSendChannelStateChange = useCallback(() => {
    if (dataChannelSend.current === null) {
      return;
    }
    const readyState = sendChannel.readyState;
    const textarea = dataChannelSend.current;
    log('Send channel state is: ', readyState);
    if (readyState === 'open') {
      textarea.disabled = false;
      textarea.focus();
      textarea.placeholder = '';

      setButtonStatus(4);
    } else {
      textarea.disabled = true;
      setButtonStatus(7);
    }
  }, []);

  const handleMessage = useCallback((ev) => {
    log('Received message: ' + ev.data);
    // Show message in the HTML5 page
    dataChannelReceive.current.value = ev.data;
    // Clean 'Send' text area in the HTML page
    dataChannelSend.current.value = '';
  }, []);

  const handleReceiveChannelStateChange = useCallback(() => {
    const readyState = receiveChannel.readyState;
    log('Receive channel state is: ', readyState);
  }, []);

  const gotReceiveChannel = useCallback(
    (ev) => {
      log('Receive Channel Callback: event -->', ev);
      receiveChannel = ev.channel;

      receiveChannel.onopen = handleReceiveChannelStateChange;
      receiveChannel.onmessage = handleMessage;
      receiveChannel.onclose = handleReceiveChannelStateChange;
    },
    [handleMessage, handleReceiveChannelStateChange]
  );

  const startHandler = useCallback(() => {
    const servers = null;

    const pc_constraints = {
      optional: [
        {
          DtlsSrtpKeyAgreement: true,
        },
      ],
    };

    localPeerConnection = new RTCPeerConnection(servers, pc_constraints);
    log('Created local peer connection object, with Data Channel');

    try {
      sendChannel = localPeerConnection.createDataChannel('sendDataChannel', {
        reliable: true,
      });
      log('Created reliable send data channel');
    } catch (e) {
      window.alert('Failed to create data channel');
      error(
        'createDataChannel() failed with the following message: ' + e.message
      );
      return;
    }
    localPeerConnection.onicecandidate = gotLocalCandidate;

    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onclose = handleSendChannelStateChange;

    remotePeerConnection = new RTCPeerConnection(servers, pc_constraints);
    log('Created remote peer connection object, with DataChannel');
    remotePeerConnection.onicecandidate = gotRemoteIceCandidate;

    remotePeerConnection.ondatachannel = gotReceiveChannel;

    localPeerConnection.createOffer(gotLocalDescription, onSignalingError);

    setButtonStatus(5);
  }, [gotReceiveChannel, handleSendChannelStateChange]);

  const sendHandler = useCallback(() => {
    const data = dataChannelSend.current.value;
    sendChannel.send(data);
    log('Send data: ', data);
  }, []);

  const stopHandler = useCallback(() => {
    log('Closing data channels');

    sendChannel.close();
    log('Close data channel with label: ', sendChannel.label);

    receiveChannel.close();
    log('Close data channel with label: ', receiveChannel.label);

    localPeerConnection.close();
    remotePeerConnection.close();

    localPeerConnection = null;
    remotePeerConnection = null;

    log('Closed Peer Connection');

    setButtonStatus(3);
    const textarea1 = dataChannelSend.current;
    const textarea2 = dataChannelReceive.current;
    textarea1.value = '';
    textarea1.disabled = true;
    textarea1.placeholder = '1: Press Start; 2: Enter text;  3: Press Send.';
    textarea2.value = '';
  }, []);

  return (
    <div className="mx-32">
      <div className="flex justify-around py-2">
        <textarea
          className="border"
          rows="5"
          cols="50"
          ref={dataChannelSend}
          id="dataChannelSend"
          placeholder="1: Press Start; 2: Enter text; 3: Press Send."
        ></textarea>
        <textarea
          className="border"
          rows="5"
          cols="50"
          id="dataChannelReceive"
          ref={dataChannelReceive}
        ></textarea>
      </div>
      <div id="buttons" className="flex justify-around">
        <button
          className="border"
          id="start"
          disabled={buttonStatus & 4}
          onClick={startHandler}
        >
          Start
        </button>
        <button
          className="border"
          id="send"
          disabled={buttonStatus & 2}
          onClick={sendHandler}
        >
          Send
        </button>
        <button
          className="border"
          id="stop"
          disabled={buttonStatus & 1}
          onClick={stopHandler}
        >
          Stop
        </button>
      </div>
    </div>
  );
};
