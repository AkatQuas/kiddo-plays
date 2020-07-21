import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { About } from './views/About';
import { BFlv } from './views/BFlv';
import { DataChannel } from './views/DataChannel';
import { LocalMedia } from './views/LocalMedia';
import { LocalPeerConnection } from './views/LocalPeerConnection';
import { NativeVideo } from './views/NativeVideo';
import { XGPlayer } from './views/Xgplayer';

export const routes = [
  {
    link: '/',
    exact: true,
    label: '关于',
    component: About,
  },
  {
    link: '/local-media',
    label: 'local media',
    component: LocalMedia,
  },
  {
    link: '/local-peer-connection',
    label: 'local peer connection',
    component: LocalPeerConnection,
  },
  {
    link: '/data-channel',
    label: 'data channel',
    component: DataChannel,
  },
  {
    link: '/xgplayer',
    component: XGPlayer,
    label: 'XGPlayer',
  },
  {
    link: '/bilibili',
    component: BFlv,
    label: 'Bilibili',
  },
  {
    link: '/native-video',
    component: NativeVideo,
    label: 'Native Video Element',
  },
];

export const Routes = () => (
  <Switch>
    {routes.map((item) => (
      <Route
        path={item.link}
        key={item.link}
        exact={item.exact}
        component={item.component}
      ></Route>
    ))}
  </Switch>
);
