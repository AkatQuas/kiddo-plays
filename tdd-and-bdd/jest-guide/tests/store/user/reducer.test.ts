import { reducer, updateUserName } from 'store/user/reducer';

describe('user reducer', () => {
  describe('updateUserName', () => {
    it('works fine', () => {
      const currentState = reducer(
        {
          id: '',
          name: '',
          age: 0,
          role: 'admin',
          status: 'complete',
        },
        updateUserName({ name: '42' })
      );

      expect(currentState.name).toEqual('42');
    });
  });
});
