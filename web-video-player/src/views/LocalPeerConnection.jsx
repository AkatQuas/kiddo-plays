import React, { Fragment, useCallback, useRef, useState } from 'react';
import { error, log } from '../utils/logger';

function onSignalError(e) {
  error('Failde to create signaling message: ', e);
}

let localStream, localPeerConnection, remotePeerConnection;

export const LocalPeerConnection = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [buttonStatus, setButtonStatus] = useState(3); // b000 stands for start/call/hangup buttons active or disabled
  const startCallback = useCallback(() => {
    log('Requesting local stream');
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        const localVideo = localVideoRef.current;

        log('Received local stream');
        if ('srcObject' in localVideo) {
          localVideo.srcObject = stream;
        } else {
          localVideo.src = window.URL.createObjectURL(stream);
        }
        localVideo.onloadedmetadata = function (e) {
          localVideo.play();
        };
        localStream = stream;
        setButtonStatus(5);
      })
      .catch((e) => {
        error('navigator.mediaDevices.getUserMedia error:', e);
        setButtonStatus(3);
      });
  }, []);

  const callCallback = useCallback(() => {
    setButtonStatus(6);
    log('starting call');
    if (!localStream) {
      return;
    }
    if (localStream.getVideoTracks().length > 0) {
      log('Using video device: ' + localStream.getVideoTracks()[0].label);
    }

    if (localStream.getAudioTracks().length > 0) {
      log('Using video device: ' + localStream.getAudioTracks()[0].label);
    }

    log('RTCPeerConnection object: ', RTCPeerConnection);

    const servers = null;

    localPeerConnection = new RTCPeerConnection(servers);
    log('Created local peer connection object localPeerConnection');

    remotePeerConnection = new RTCPeerConnection(servers);
    log('Create remote peer connection object remotePeerConnection');

    remotePeerConnection.onicecandidate = (ev) => {
      if (ev.candidate) {
        localPeerConnection.addIceCandidate(new RTCIceCandidate(ev.candidate));
        log('Remote ICE candidate: \n', ev.candidate.candidate);
      }
    };
    remotePeerConnection.onaddstream = (ev) => {
      const remoteVideo = remoteVideoRef.current;
      if ('srcObject' in remoteVideo) {
        remoteVideo.srcObject = ev.stream;
      } else {
        // Avoid using this in new browsers, as it is going away.
        remoteVideo.src = window.URL.createObjectURL(ev.stream);
      }
      remoteVideo.onloadedmetadata = function (e) {
        remoteVideo.play();
      };
      log('Receieved remote stream');
    };

    localPeerConnection.addStream(localStream);

    localPeerConnection.createOffer((description) => {
      localPeerConnection.setLocalDescription(description);

      log('Offer from localPeerConnection: \n' + description.sdp);

      remotePeerConnection.setRemoteDescription(description);

      remotePeerConnection.createAnswer((description2) => {
        remotePeerConnection.setLocalDescription(description2);

        log('Answer from remotePeerConnection: \n', description2.sdp);

        localPeerConnection.setRemoteDescription(description2);
      }, onSignalError);
    }, onSignalError);
  }, []);

  const hangupCallback = useCallback(() => {
    log('Ending call');
    // Close PeerConnection and reset local variables
    if (localPeerConnection) {
      localPeerConnection.close();
      localPeerConnection = null;
    }

    if (remotePeerConnection) {
      remotePeerConnection.close();
      remotePeerConnection = null;
    }

    if (localStream) {
      const tracks = localStream.getTracks();

      tracks.forEach((track) => void track.stop());
    }
    localStream = null;

    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;

    setButtonStatus(3);
  }, []);

  log('buttonStatus ->', buttonStatus);

  return (
    <Fragment>
      <p>
        View the native implementation in a single
        <a
          className="text-blue-500"
          href="/local-peer-connection.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          html
        </a>
        file
      </p>
      <table border="1" width="100%">
        <thead>
          <tr>
            <th>Local video</th>
            <th>Remote video</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <video id="local" ref={localVideoRef} autoPlay></video>
            </td>
            <td>
              <video id="remote" ref={remoteVideoRef} autoPlay></video>
            </td>
          </tr>
          <tr>
            <td align="center">
              <div className="flex justify-around">
                <button
                  className="border"
                  onClick={startCallback}
                  disabled={buttonStatus & 4}
                >
                  Start
                </button>
                <button
                  className="border"
                  onClick={callCallback}
                  disabled={buttonStatus & 2}
                >
                  Call
                </button>
                <button
                  className="border"
                  onClick={hangupCallback}
                  disabled={buttonStatus & 1}
                >
                  Hang Up
                </button>
              </div>
            </td>
            <td>{/* void */}</td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
};
