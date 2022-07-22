export const debounce = function(func, delay) {
  let timer = 0;
  const debounced = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => func(), delay);
  };
  return debounced;
};
//# sourceMappingURL=Debouncer.js.map
