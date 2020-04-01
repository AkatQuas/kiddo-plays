import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import ReduxPage from './views/redux';
import MobxPage from './views/mobx';
import FluxPage from './views/flux';
import NotFound from './views/not-found';

const _routes = [
    {
        to: '/redux',
        path: '/redux',
        label: 'Redux',
        component: ReduxPage,
    },
    {
        to: '/mobx',
        path: '/mobx',
        label: 'Mobx',
        component: MobxPage,
    },
    {
        to: '/flux',
        path: '/flux',
        label: 'Flux',
        component: FluxPage
    }
];

export default _ => (
    <Switch>
        <Redirect from="/" exact to="/redux" />
        {
            _routes.map(o => (
                <Route {...o} key={o.path} />
            ))
        }
        <Route path="**" component={NotFound} />
    </Switch>
)

export const routes = _routes.map(({to, label}) => ({to, label}))