import * as functions from './function';

describe('depend on functions', () => {
  test('How old', () => {
    const spy = jest.spyOn(functions, 'howOld');
    expect(spy).toHaveBeenCalledTimes(0);
    functions.report();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Bob', 12);
  });
  test('How old', () => {
    const spy = jest.fn().mockReturnValue('default');
    expect(spy).toHaveBeenCalledTimes(0);
    expect(functions.report2(spy)).toBe('default');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Alice', 12);
  });
});
