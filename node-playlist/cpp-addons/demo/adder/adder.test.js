const assert = require('assert');
const addon = require('../build/Release/adder.node');

assert.throws(() => addon.add(), {
  name: /^TypeError$/,
  message: /only 2 arguments/
});
assert.throws(() => addon.add(1), {
  name: /^TypeError$/,
  message: /only 2 arguments/
});
assert.throws(() => addon.add(1,2,3), {
  name: /^TypeError$/,
  message: /only 2 arguments/
});
assert.throws(() => addon.add('',2), {
  name: /^TypeError$/,
  message: /arguments should be number/
});
assert.throws(() => addon.add({},2), {
  name: /^TypeError$/,
  message: /arguments should be number/
});
assert.throws(() => addon.add({},'2'), {
  name: /^TypeError$/,
  message: /arguments should be number/
});
assert.strictEqual(addon.add(3, 5), 8, 'Wrong addon');
console.log('The adder addon works well');
