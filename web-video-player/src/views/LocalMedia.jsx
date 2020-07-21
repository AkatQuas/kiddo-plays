import React, { useCallback, useRef } from 'react';
import { error } from '../utils/logger';

export const LocalMedia = () => {
  const mainVideo = useRef(null);
  const getLocalMedia = useCallback((ev) => {
    const { size } = ev.target.dataset;
    const [width = 400, height = 400] = size.split('.');
    const constraints = {
      audio: true,
      video: {
        frameRate: { ideal: 60, max: 120 },
        width,
        height,
      },
    };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        var video = mainVideo.current;
        // Note: make the returned stream available to console for inspection
        window.stream = stream;

        // Older browsers may not have srcObject
        if ('srcObject' in video) {
          video.srcObject = stream;
        } else {
          // Avoid using this in new browsers, as it is going away.
          video.src = window.URL.createObjectURL(stream);
        }
        video.onloadedmetadata = function (e) {
          video.play();
        };
      })
      .catch((e) => {
        error('navigator.getUserMedia error: ', e);
      });
  }, []);

  const stopMedia = useCallback(() => {
    const video = mainVideo.current;
    const stream = video.srcObject;
    if (!stream) {
      return;
    }
    const tracks = stream.getTracks();

    tracks.forEach(function (track) {
      track.stop();
    });

    video.srcObject = null;
  }, []);

  return (
    <div>
      <h1>
        <code>getUserMedia()</code> very naive demo
      </h1>
      <p>
        With this example, we simply call <code>getUserMedia()</code> and
        display the received stream inside an HTML5 &lt;video&gt; elment
      </p>
      <p>
        View
        <a
          className="text-blue-500"
          href="https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints"
          target="_blank"
          rel="noopener noreferrer"
        >
          MDN MediaStreamConstraints
        </a>
        for details
      </p>
      <p>
        View the native implementation in a single
        <a
          className="text-blue-500"
          href="/local-media.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          html
        </a>
        file
      </p>
      <div className="p-2">
        <video id="mainVideo" ref={mainVideo} autoPlay></video>
      </div>
      <div className="flex justify-around">
        <button className="border" data-size="320.240" onClick={getLocalMedia}>
          get QVGA(320x240) stream
        </button>
        <button className="border" data-size="640.480" onClick={getLocalMedia}>
          get VGA(640x480) stream
        </button>
        <button className="border" data-size="1280.960" onClick={getLocalMedia}>
          get HD(1280x960) stream
        </button>
        <button className="border" onClick={stopMedia}>
          stop stream
        </button>
      </div>
    </div>
  );
};
