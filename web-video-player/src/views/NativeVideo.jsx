import React, { Fragment } from 'react';
import { CenterBox } from '../components/CenterBox';

export const NativeVideo = () => (
  <Fragment>
    <div>Native video tag</div>
    <CenterBox>
      <video
        controls
        width="250"
        poster="https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217"
      >
        <source
          src="https://interactive-examples.mdn.mozilla.net/media/examples/flower.webm"
          type="video/webm"
        ></source>
        <source
          src="https://interactive-examples.mdn.mozilla.net/media/examples/flower.mp4"
          type="video/mp4"
        ></source>
        <p>
          Your browser doesn't support HTML5 video. Here is a
          <a href="https://interactive-examples.mdn.mozilla.net/media/examples/flower.mp4">
            link to the video
          </a>
          instead.
        </p>
      </video>
    </CenterBox>
    <p>
      Using multiple sources as fallbacks for a video tag,
      {/* 'Elephants Dream' by Orange Open Movie Project Studio, licensed under CC-3.0, hosted by archive.org,  */}
      {/* Poster hosted by Wikimedia  */}
    </p>
    <CenterBox>
      <video
        width="620"
        controls
        poster="https://upload.wikimedia.org/wikipedia/commons/e/e8/Elephants_Dream_s5_both.jpg"
      >
        <source
          src="https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4"
          type="video/mp4"
        ></source>
        <source
          src="https://archive.org/download/ElephantsDream/ed_hd.ogv"
          type="video/ogg"
        ></source>
        <source
          src="https://archive.org/download/ElephantsDream/ed_hd.avi"
          type="video/avi"
        ></source>
        Your browser doesn't support HTML5 video tag.
      </video>
    </CenterBox>
  </Fragment>
);
