console.log('Hello from sub.js');

module.exports.Sub = class Sub {
  time() {
    return Date.now();
  }
};

module.exports.asyncArrow = async () => {
  console.log('Hello from sub#async_arrow');
};

module.exports.arrow = () => {
  console.log('Hello from sub#arrow');
};
