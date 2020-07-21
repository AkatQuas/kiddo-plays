import React, { Fragment, useEffect } from 'react';
import { timerWithNS } from '../utils/logger';
const logPrefix = () => timerWithNS('bilibili-flv');

export const BFlv = () => {
  useEffect(() => {
    window.alert('TODO complete bilibili');
    // const videoElement = document.querySelector('#bflv');

    // const player = flvjs.createPlayer({
    //   type: 'mp4',
    //   url:
    //     'https://upos-sz-mirrorkodo.bilivideo.com/upgcxcode/22/80/758022/758022-1-16.mp4?e=ig8euxZM2rNcNbhBhwdVtWhBhwdVNEVEuCIv29hEn0lqXg8Y2ENvNCImNEVEUJ1miI7MT96fqj3E9r1qNCNEtodEuxTEtodE9EKE9IMvXBvE2ENvNCImNEVEK9GVqJIwqa80WXIekXRE9IMvXBvEuENvNCImNEVEua6m2jIxux0CkF6s2JZv5x0DQJZY2F8SkXKE9IB5QK==&uipk=5&nbs=1&deadline=1595328999&gen=playurl&os=kodobv&oi=1031976538&trid=37f4b06655ba4156ba81bdaca6b84ea9u&platform=pc&upsig=f61c64525500873f5eb7bb56d68481bb&uparams=e,uipk,nbs,deadline,gen,os,oi,trid,platform&mid=773325&orderid=0,3&logo=80000000',
    // });

    // player.attachMediaElement(videoElement);
    // player.load();
    // player.play();
    console.log(logPrefix(), 'ready');
  }, []);
  return (
    <Fragment>
      <div className="mx-auto py-2">
        <div id="bflv"></div>
      </div>
      <div className="mx-auto py-2 flex justify-around"></div>
    </Fragment>
  );
};
