import { useEffect, useState } from 'react';
import {
  GetBreedList,
  GetImageUrlsByBreed,
  GetRandomImageUrl
} from '../wailsjs/go/main/App.js';

export const Dog = () => {
  // React state replaces Svelte "let" variables
  const [randomImageUrl, setRandomImageUrl] = useState('');
  const [breeds, setBreeds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedBreed, setSelectedBreed] = useState('');
  const [showRandomPhoto, setShowRandomPhoto] = useState(false);
  const [showBreedPhotos, setShowBreedPhotos] = useState(false);

  // Init on mount (replaces Svelte init() call)
  useEffect(() => {
    getBreedList();
  }, []);

  // Get random dog image
  function getRandomImageUrl() {
    setShowRandomPhoto(false);
    setShowBreedPhotos(false);
    GetRandomImageUrl().then((result) => {
      setRandomImageUrl(result);
      setShowRandomPhoto(true);
    });
  }

  // Get breed list from backend
  function getBreedList() {
    GetBreedList().then((result) => setBreeds(result));
  }

  // Get images by selected breed
  function getImageUrlsByBreed() {
    if (!selectedBreed) return; // prevent empty selection

    setShowRandomPhoto(false);
    setShowBreedPhotos(false);
    GetImageUrlsByBreed(selectedBreed).then((result) => {
      setPhotos(result);
      setShowBreedPhotos(true);
    });
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Dogs API</h3>
      <div>
        <button className="btn" onClick={getRandomImageUrl}>
          Fetch a dog randomly
        </button>

        <span style={{ margin: '0 8px' }}>
          Click on down arrow to select a breed
        </span>

        <select
          value={selectedBreed}
          onChange={(e) => setSelectedBreed(e.target.value)}
        >
          {breeds.map((breed) => (
            <option key={breed} value={breed}>
              {breed}
            </option>
          ))}
        </select>

        <button
          className="btn"
          onClick={getImageUrlsByBreed}
          style={{ marginLeft: '8px' }}
        >
          Fetch by this breed
        </button>
      </div>

      <br />

      {/* Show random photo */}
      {showRandomPhoto && (
        <img
          id="random-photo"
          src={randomImageUrl}
          alt="No dog found"
          style={{ width: '600px', height: 'auto' }}
        />
      )}

      {/* Show breed photos */}
      {showBreedPhotos && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '10px'
          }}
        >
          {photos.map((photo, index) => (
            <img
              key={index}
              id="breed-photos"
              src={photo}
              alt="No dog found"
              style={{ width: '300px', height: 'auto' }}
            />
          ))}
        </div>
      )}

      {/* Component styles */}
      <style>
        {`
          .btn:focus {
            border-width: 3px;
          }
        `}
      </style>
    </div>
  );
};
