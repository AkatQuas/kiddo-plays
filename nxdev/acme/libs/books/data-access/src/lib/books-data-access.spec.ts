import { getBooks } from './books-data-access';

describe('booksDataAccess', () => {
  it('should work', async () => {
    expect((await getBooks()).length).toBeGreaterThan(1);
  });
});
