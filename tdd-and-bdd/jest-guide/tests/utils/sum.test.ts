import { sum } from 'utils/sum';

describe('sum', () => {
  it('sum properly', () => {
    expect(sum(4, 2)).toEqual(6);
  });
});
