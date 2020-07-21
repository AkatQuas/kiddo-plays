import React, { Fragment, useEffect, useRef } from 'react';
import Player from 'xgplayer';
import { timerWithNS } from '../utils/logger';
const logPrefix = timerWithNS('xgplayer');

export const XGPlayer = () => {
  const playerRef = useRef(null);
  useEffect(() => {
    const player = new Player({
      id: 'xgvs',
      width: 600,
      height: 337.5,
      autoplay: false,
      url: '//h5player.bytedance.com/video/mp4/xgplayer-demo-360p.mp4',
      poster:
        '//s2.pstatp.com/cdn/expire-1-M/byted-player-videos/1.0.0/poster.jpg',
      volume: 0.2,
    });
    player.on('play', () => {
      console.log(logPrefix(), 'play');
    });
    player.on('playing', () => {
      console.log(logPrefix(), 'playing');
    });
    player.on('pause', () => {
      console.log(logPrefix(), 'pause');
    });
    player.on('end', () => {
      console.log(logPrefix(), 'end');
    });
    player.once('ready', () => {
      console.log(logPrefix(), 'ready');
    });

    player.once('complete', () => {
      console.log(logPrefix(), 'complete');
    });

    player.once('destroy', () => {
      console.log(logPrefix(), 'destroy');
    });

    player.emit('resourceReady', [
      {
        name: '超清',
        url: '//h5player.bytedance.com/video/mp4/xgplayer-demo-720p.mp4',
      },
      {
        name: '高清',
        url: '//h5player.bytedance.com/video/mp4/xgplayer-demo-480p.mp4',
      },
      {
        name: '标清',
        url: '//h5player.bytedance.com/video/mp4/xgplayer-demo-360p.mp4',
      },
    ]);

    playerRef.current = player;
    return () => {
      playerRef.current.destroy(true);
      playerRef.current = null;
    };
  }, []);

  console.log(logPrefix(), ' rendering');

  return (
    <Fragment>
      <div className="mx-auto py-2">
        <div id="xgvs"></div>
      </div>

      <div className="mx-auto py-2 flex justify-around">
        <a
          className="text-blue-500"
          href="http://h5player.bytedance.com/en/api/"
          target="_blank"
          rel="noopener noreferrer"
        >
          API documentation
        </a>
        <a
          className="text-blue-500"
          href="http://h5player.bytedance.com/en/api/#event"
          target="_blank"
          rel="noopener noreferrer"
        >
          Event Types List
        </a>
        <a
          className="text-blue-500"
          href="http://h5player.bytedance.com/en/config/#danmu"
          target="_blank"
          rel="noopener noreferrer"
        >
          Danmu Usage
        </a>

        <a
          className="text-blue-500"
          href="http://h5player.bytedance.com/en/config/#video-click-configure"
          target="_blank"
          rel="noopener noreferrer"
        >
          Video Element Click or Touch event
        </a>

        <a
          className="text-blue-500"
          href="http://h5player.bytedance.com/en/config/#video-click-configure"
          target="_blank"
          rel="noopener noreferrer"
        >
          Wechat Browser configuration
        </a>
      </div>
    </Fragment>
  );
};
