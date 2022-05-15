const assert = require('assert');
const addon = require('../build/Release/hello.node');

assert.strictEqual(addon.hello(), '42', 'Wrong addon');
console.log('The hello addon works well');
