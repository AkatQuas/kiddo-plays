const mockFetch = data => (cb) => {
  setTimeout(() => {
    cb(data)
  }, 200);
};

const mockPromise = data => Promise.resolve(data);
const mockReject = data => Promise.reject(data);

test('the data is peanut butter', done => {
  const cb = (data) => {
    expect(data).toBe('peanut butter');
    done();
  };
  mockFetch('peanut butter')(cb);
});

test('the data is purple grape', () => {
  return mockPromise('purple grape').then(data => {
    expect(data).toBe('purple grape');
  });
});

// prefered
test('the data is purple grape', (done) => {
  mockPromise('purple grape').then(data => {
    expect(data).toBe('purple grape');
    done();
  });
});

test('the data is rejected', () => {
  expect(mockReject('peanut')).rejects.toBe('peanut')
});

test('resolves data', () => {
  expect(mockPromise('peanut')).resolves.toBe('peanut')
});

test('the data is awaited ', async () => {
  const data = await mockPromise('peanutpea');
  expect(data).toBe('peanutpea');
});

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

