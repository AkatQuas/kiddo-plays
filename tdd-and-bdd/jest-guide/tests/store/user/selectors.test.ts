import { selectUser, selectUserStatus } from 'store/user/selectors';

describe('user selectors', () => {
  it('selectUser', () => {
    const r = selectUser({
      user: {
        id: '1',
        name: 'Sun',
        age: 18,
        role: 'user',
        status: 'complete',
      },
    });
    expect(r).toEqual({
      id: '1',
      name: 'Sun',
      age: 18,
      role: 'user',
    });
  });
  it('selectUserStatus', () => {
    const r = selectUserStatus({
      user: {
        id: '1',
        name: 'Sun',
        age: 18,
        role: 'user',
        status: 'loading',
      },
    });
    expect(r).toEqual('loading');
  });
});
