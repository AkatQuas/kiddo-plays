import { objectToSearchString } from 'utils/object-to-search-string';

describe('objectToSearchString', () => {
  it('convert object to search string', () => {
    expect(
      objectToSearchString({
        a: '1',
        b: '2',
      })
    ).toEqual('a=1&b=2');
  });
});
