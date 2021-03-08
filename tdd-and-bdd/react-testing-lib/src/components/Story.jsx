import axios from 'axios';
import React, { useCallback, useState } from 'react';

const URL = 'http://hn.algolia.com/api/v1/search';

const Story = () => {
  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);

  const handleFetch = useCallback(async (e) => {
    let result;
    try {
      result = await axios.get(`${URL}?query=React`);
      setStories(result.data.hits);
    } catch (e) {
      setError(e);
    }
  }, []);
  return (
    <div>
      <button type="button" onClick={handleFetch}>
        Fetch Stories
      </button>
      {error ? <span>Something went wrong ...</span> : null}
      <ul>
        {stories.map((item) => (
          <li key={item.objectID}>
            <a href={item.URL}>{item.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Story;
