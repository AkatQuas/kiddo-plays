import React, { Component, Fragment } from 'react';
import AppContainer from './app.container';

export default class MobxPage extends Component {

    render () {
        return (
            <Fragment>
                <p>Flux Page</p>
                <AppContainer />
            </Fragment>
        )
    }
}
