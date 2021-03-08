import React from 'react';
import './App.css';
import Link from './Link';
import useCounter from './useCounter';

function App() {
  const { count, increment } = useCounter();
  return (
    <div className="App">
      <header className="App-header">
        <Link>test {count}</Link>
        <button onClick={increment}>Increment</button>
      </header>
    </div>
  );
}

export default App;
