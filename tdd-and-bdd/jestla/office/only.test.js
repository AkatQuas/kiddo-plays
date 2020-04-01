
test.only('this will be the only test that runs', () => {
  expect(true).toBe(false);
});

test('this test will not run', () => {
  expect('A').toBe('A');
});

test('this test will not run', () => {
  // test not run
  expect('A').toBe('B');
});