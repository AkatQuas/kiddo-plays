import { sleep } from 'utils/sleep';

describe('sleep', () => {
  it('sleep 1000ms', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    const act = async (callback: () => void) => {
      await sleep(1000);
      callback();
    };
    const mockCallback = jest.fn();
    const promise = act(mockCallback);

    expect(mockCallback).not.toHaveBeenCalled();

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

    // fast forward until all timers have been executed
    jest.runAllTimers();

    expect(mockCallback).not.toHaveBeenCalled();

    // await promise callback
    await promise;

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});
