import { getSearchObject } from 'utils/get-search-object';

describe('getSearchObject', () => {
  it('get searchObject for current website', () => {
    window.location.assign('https://cn.bing.com?a=1&b=2');
    expect(getSearchObject()).toEqual({
      a: '1',
      b: '2',
    });
  });

  it('get empty object when no search', () => {
    window.location.assign('https://cn.bing.com?');
    expect(getSearchObject()).toEqual({});
  });
});
