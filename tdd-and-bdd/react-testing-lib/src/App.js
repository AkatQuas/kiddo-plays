import { useCallback, useState } from 'react';
import './App.css';
import Search from './components/Search';
import Title from './components/Title';
import User from './components/User';

function App() {
  const [search, setSearch] = useState('');
  const handleChange = useCallback((event) => {
    setSearch(event.target.value);
  }, []);
  return (
    <div className="App">
      <header className="App-header">
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <Title title="42" />
        <Search value={search} onChange={handleChange}>
          Search:
        </Search>
        <User />
      </header>
    </div>
  );
}

export default App;
