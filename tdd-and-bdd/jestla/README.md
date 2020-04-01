# Jest

> Jest is a very powerful test framework!

Jest is a delightful JavaScript Testing Framework with a focus on simplicity.

## Example

I have write a full example.

- [sound-player.js](lib/sound-player.js), [sound-player-consumer.js](lib/sound-player-consumer.js).

- [sound-player.test.js](lib/sound-player.test.js), [sound-player-consumer.test.js](lib/sound-player-consumer.test.js).

```bash
npm run test:lib
```

## Caution

Errors may occurr when runing `npm run test`. It's normal because that test case is used for testing `only`, `skip` modifier by `Jest`.

## Notes

### expect API referentce

[This document](https://jestjs.io/docs/en/expect) list all the matchers you may use in the test cases.

Jest `expect` assertion is kind of extened [jasmine's expect](https://jasmine.github.io/api/3.4/matchers.html).

### Asynchronously test

```js
const mockPromise = data => Promise.resolve(data);
const mockReject = data => Promise.reject(data);

test('the data is purple grape', () => {
  // you have to return the promise so that
  // jest know it's an async test
  return mockPromise('purple grape').then(data => {
    expect(data).not.toBe('purple grape');
  });
});

// prefered
test('the data is purple grape', (done) => {
  mockPromise('purple grape').then(data => {
    expect(data).not.toBe('purple grape');
    done();
  });
});

// using `resolves` and `rejects`
test('the data is rejected', () => {
expect(mockReject('peanut')).rejects.toBe('peanut')
});

test('resolves data', () => {
  expect(mockPromise('peanut')).resolves.toBe('peanut')
});

// using `async/await`
test('the data is awaited ', async () => {
  const data = await mockPromise(10);
  expect(data).toBeGreaterThan(9);
  expect(data).toBeLessThan(11);
});

test('the data is peanut butter', async () => {
  await expect(mockPromise('peanut butter')).resolves.toBe('peanut butter');
});

test('the fetch fails with an error', async () => {
  await expect(mockReject('error')).rejects.toBe('error');
});
```

### Test.todo

Use `test.todo` when you are planning on writing tests. These tests will be highlighted in the summary output at the end so you know how many tests you still need todo.

Note: If you supply a test callback function then the `test.todo` will throw an error. If you have already implemented the test and it is broken and you do not want it to run, then use `test.skip` instead.
