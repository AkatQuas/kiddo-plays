import { useEffect, useState } from 'react';

export default function Custom404() {
  const [tick, setTick] = useState(3);
  useEffect(() => {
    if (tick <= 0) {
      window.location.assign('/');
    }
  }, [tick]);
  useEffect(() => {
    const t = setTimeout(() => {
      setTick(tick - 1);
    }, 1000);
    return () => {
      clearTimeout(t);
    };
  }, [tick]);
  return (
    <>
      <h1>404 - Blog Got Lost!!</h1>
      <h3>{tick} second to homepage!</h3>
    </>
  );
}
