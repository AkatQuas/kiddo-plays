export const getSearchObject = (): Record<string, string> => {
  const url = new URL(window.location.href);

  const object = {} as Record<string, string>;
  url.searchParams.forEach((value, key) => {
    object[key] = value;
  });
  return object;
};
