# Mocha js

> Mocha is a test runner. It supports many assertion libraries.

Mocha is a feature-rich JavaScript test framework running on Node.js and in the browser, making asynchronous testing simple and fun. Mocha tests run serially, allowing for flexible and accurate reporting, while mapping uncaught exceptions to the correct test cases. Hosted on [GitHub](https://github.com/mochajs/mocha).

## Run

```bash
npm install

npm run test
```

## Notes

### Run Cycle

Mocha run specs in the order they are defined (i.e. found in the file).

```
run 'mocha spec.js'
|
spawn child process
|
|--------------> inside child process
  process and apply options
  |
  run spec file/s
  |
  |--------------> per spec file
    suite callbacks (e.g., 'describe')
    |
    'before' root-level pre-hook
    |
    'before' pre-hook
    |
    |--------------> per test
      'beforeEach' root-level pre-hook
      |
      'beforeEach' pre-hook
      |
      test callbacks (e.g., 'it')
      |
      'afterEach' post-hook
      |
      'afterEach' root-level post-hook
    |<-------------- per test end
    |
    'after' post-hook
    |
    'after' root-level post-hooks
  |<-------------- per spec file end
|<-------------- inside child process end
```

### Assertions

Mocha allows you to use any assertion library you wish. In the above example, we're using Node.js' built-in [assert](https://nodejs.org/api/assert.html) module — but generally, if it throws an Error, it will work! This means you can use libraries such as:

- [should.js](https://github.com/shouldjs/should.js) - BDD style shown throughout these docs

- [expect.js](https://github.com/Automattic/expect.js) - expect() style assertions

- [chai](https://www.chaijs.com/) - expect(), assert() and should-style assertions

### Skip Test

Skip, also known as **Pending**.

```js

// pending one suite
describe('Array', function() {
  describe.skip('#indexOf()', function() {
    // ...
  });
});


// pending one specific test-case
describe('Array', function() {
  describe('#indexOf()', function() {
    it.skip('should return -1 unless present', function() {
      // this test will not be run
    });

    it('should return the index when present', function() {
      // this test will be run
    });
  });
});

// pending in hooks
describe('outer', function() {
  before(function() {
    this.skip();
  });

  after(function() {
    // will be executed
  });

  describe('inner', function() {
    before(function() {
      // will be skipped
    });

    after(function() {
      // will be skipped
    });
  });
});
```

### Dynamically generate tests

```js
var assert = require('chai').assert;

describe('Dynamic tests', () => {
  const addNumArray = (args) => args.reduce((p, c) => +p + c, 0);
  const tests = [
    { args: [1, 2], expected: 3 },
    { args: [5, 2], expected: 7 },
    { args: [5, 2, 3], expected: 10 },
  ];
  tests.forEach(test => {
    it('correctly adds ' + test.args.length + ' arguments', () => {
      assert2.equal(addNumArray(test.args), test.expected);
    });
  })
})
```

### Realword examples

[websocket.io](https://github.com/LearnBoost/websocket.io/tree/master/test)

[express](https://github.com/expressjs/express/tree/master/test)

