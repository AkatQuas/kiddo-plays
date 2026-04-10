import { useState } from 'react';
import './App.css';
import logo from './assets/images/logo-universal.png';
import { Dog } from './dog';
import { generate } from './greet';

function App() {
  const [resultText, setResultText] = useState(
    'Please enter your name below 👇'
  );
  const [name, setName] = useState('Jack');
  const updateName = (e: any) => setName(e.target.value);
  const updateResultText = (result: string) => setResultText(result);

  function greet() {
    generate(name).then(updateResultText);
  }

  return (
    <div id="App">
      <img src={logo} id="logo" alt="logo" />
      <div id="result" className="result">
        {resultText}
      </div>
      <div id="input" className="input-box">
        <input
          id="name"
          className="input"
          onChange={updateName}
          autoComplete="off"
          name="input"
          type="text"
        />
        <button className="btn" onClick={greet}>
          Greet
        </button>
      </div>
      <Dog />
    </div>
  );
}

export default App;
