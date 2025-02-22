const path = require('path');
const fs = require('fs');

console.log('Hello from sub.js');
function sayHello(more = []) {
  console.log(['Hello', 'Byte Code', ...more].join(', '));
}

class myClass {
  constructor(v = 0) {
    this.value = v;
  }
  inc() {
    this.value += 1;
  }
  getValue() {
    return this.value;
  }
}

module.exports.sayHello = sayHello;

module.exports.stringExport = 'foobar';

module.exports.asyncArrowException = async () => {
  undefined();
};

module.exports.asyncArrowExceptionWithNull = async () => {
  const e = null;
  return e.Status;
};
module.exports.arrowFunction = (a) => a + 1;

module.exports.myClass = myClass;

module.exports.readTextFile = function () {
  return fs.readFileSync(path.join(__dirname, 'textfile.txt'), 'utf-8');
};

module.exports.stackTrace = function () {
  return new Error().stack;
};

module.exports.getModuleInfo = function () {
  return {
    module,
    __dirname,
    __filename,
  };
};
