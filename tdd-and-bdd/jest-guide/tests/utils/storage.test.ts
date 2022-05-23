import { storage } from 'utils/storage';

describe('storage', () => {
  it('save key-value', () => {
    storage.set('newKey', '42');
    expect(storage.get('newKey')).toEqual('42');
  });
});
