import { config } from 'utils/env';

describe('env.ts', () => {
  it('in Dev', () => {
    jest.spyOn(config, 'getEnv').mockImplementation(() => 'dev');

    expect(config.getEnv()).toEqual('dev');
  });

  it('in Prod', () => {
    jest.spyOn(config, 'getEnv').mockReturnValue('prod');

    expect(config.getEnv()).toEqual('prod');
  });

  it.skip('in Windows i32', () => {
    // Just don't know how to do without getter/setter.
    // Object.defineProperty works fine, though.
    jest.spyOn(config, 'platform', 'get').mockReturnValue('win_ia32');
    expect(config.platform).toEqual('win_ia32');
  });
});
