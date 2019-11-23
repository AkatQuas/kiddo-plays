const sum = require('./sum');

describe('Test on sum.js', () => {

  test('adds 1+2 to equal 3', () => {
    expect(sum(1, 2)).toBe(3);
  });

  test.todo('I want to test 2+2');

});