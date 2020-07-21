import React from 'react';
import { BrowserRouter as Router, Link } from 'react-router-dom';
import './App.css';
import { Routes, routes } from './router';

function App() {
  return (
    <Router>
      <header>
        <nav>
          <ul className="flex p-2 bg-gray-100">
            {routes.map((item) => (
              <li key={item.link} className="mx-2 border rounded px-2">
                <Link to={item.link}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <section className="p-4">
        <Routes />
      </section>
    </Router>
  );
}

export default App;
