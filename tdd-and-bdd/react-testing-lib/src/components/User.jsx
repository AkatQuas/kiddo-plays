import { useEffect, useState } from 'react';
const getUser = () => {
  return Promise.resolve({
    id: '1',
    name: 'Robinhood',
  });
};

const User = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    getUser().then((u) => {
      setUser(u);
    });
  }, []);
  return user ? <p>Signed in as {user.name}</p> : null;
};

export default User;
