import React, { useCallback, useState } from 'react';
import './App.css';

const Text = (props) => {
  return <p className={props.className}>{props.content}</p>;
};

export function App() {
  const [show, setShow] = useState(false);
  const [text, setText] = useState(Date.now());
  const updateText = useCallback(() => {
    const d = Date.now();
    console.log(`updateText called ->`, d);
    setText(d);
    setShow((o) => !o);
  }, []);
  return (
    <>
      {show ? <button>Show hello</button> : null}
      <div className="App">
        <header className="App-header">
          {show ? (
            <p>
              Edit <code>src/App.js</code> and save to reload.
            </p>
          ) : null}

          <p style="color: orange">Misunderstanding!</p>
          <input autoFocus />
          <Text className="hello-class" content={'Hello 42: ' + text} />
          <button onClick={updateText}>Get current Time</button>
        </header>
      </div>
    </>
  );
}
