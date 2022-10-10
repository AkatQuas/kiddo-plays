console.log('Hello from demo!', Date.now());

const { Sub, arrow, asyncArrow } = require('./sub/index');

const mArrow = () => {
  console.log('Hello from main#arrow');
};

const mAsyncArrow = () => {
  console.log('Hello from main#asyncArrow');
};

console.log('Invoke time in Sub', new Sub().time());

mArrow();
mAsyncArrow();

arrow();
asyncArrow();
