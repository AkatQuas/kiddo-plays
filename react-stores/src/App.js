import React, { Fragment } from 'react';
import logo from './assets/logo.svg';
import './App.css';
import Router, {routes} from './routes';
import { Link } from 'react-router-dom';

export default _ => {
   

    return (
        <Fragment>
            <div className="App">
                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo" />
                    <h1 className="App-title">Welcome to React Stores Play Ground</h1>
                </header>
            </div>
            <div className="links">
                {
                    routes.map(o => (
                        <Link
                            {...o}
                            key={o.to}
                        >{o.label}</Link>
                    ))

                }
            </div>
            <div className="container">
                <Router />
            </div>
        </Fragment>
    );
}