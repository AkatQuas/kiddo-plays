import { useEffect, useState } from 'react';

export default (value, delay = 1000) => {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setState(value);
      setLoading(false);
    }, delay);
    return () => window.clearTimeout(t);
  }, []);
  return {
    state,
    setState,
    loading,
  };
};
