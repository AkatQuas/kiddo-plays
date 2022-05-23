import { after1000ms } from 'utils/after-1000-ms';

describe('after 1000 ms', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  it('works well', () => {
    jest.spyOn(global, 'setTimeout');
    const callback = jest.fn();
    expect(callback).not.toHaveBeenCalled();

    after1000ms(callback);

    jest.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000);
  });
});
