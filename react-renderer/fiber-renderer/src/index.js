import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';
import './index.css';
import { CustomRenderer } from './renderer';

const Renderer = !true ? ReactDOM : CustomRenderer;

Renderer.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root'),
  () => {
    console.group('afterRender');
    console.log('After render');
    console.groupEnd('afterRender');
  }
);
