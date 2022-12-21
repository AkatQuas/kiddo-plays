export const store = {
  count: 1,
};

export const getCount = () => store.count;

export const increment = (value = 1) => {
  store.count += value;
};
