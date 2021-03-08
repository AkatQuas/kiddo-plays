import { useCallback, useState } from 'react';

const Counter = ({ initialValue = 2 }) => {
  const [count, setCount] = useState(initialValue);
  const increment = useCallback(() => {
    setCount((x) => x + 1);
  }, []);
  return (
    <div>
      <p>current value: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
};

export default Counter;
