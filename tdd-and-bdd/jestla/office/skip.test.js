
test('this will be the only test that runs', () => {
  expect(true).toBe(true);
});

test('this test will not run', () => {
  expect('A').toBe('A');
});

test.skip('this test will not run', () => {
  // test not run
  expect('A').toBe('B');
});