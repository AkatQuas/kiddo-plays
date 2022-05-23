const KEY_PREFIX = 'my-app-';

const set = (key: string, value: string) => {
  localStorage.setItem(KEY_PREFIX + key, value);
};

const get = (key: string): string | null => {
  return localStorage.getItem(KEY_PREFIX + key);
};

export const storage = {
  get,
  set,
};
