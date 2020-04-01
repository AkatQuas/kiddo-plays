import SoundPlayerConsumer from './sound-player-consumer';

describe('Test sound-player-consumer', () => {
  let player;

  beforeEach(() => {
    player = new SoundPlayerConsumer('qq');
  });


  it('should have name "bangbang" when new without parameters', () => {
    const player = new SoundPlayerConsumer();
    expect(player.name).toBe('bangbang');
  });

  it('should be playing when called "playSomethingCool"', () => {
    expect(player.playing).toBe(false);
    player.playSomethingCool();
    expect(player.playing).toBe(true);
  });

  it('property "soundPlayer" should call function "playSoundFile" successfully', () => {
    const spy = jest.spyOn(player.soundPlayer, 'playSoundFile');
    player.playSomethingCool();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('song.mp3');
  });

  it('property "soundPlayer" should call function "playSoundFile" successfully', () => {
    const spy = jest.spyOn(player.soundPlayer, 'playSoundFile');
    player.playSomethingCool('sprite.mp3');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('sprite.mp3');
  });

  it('cannot stop before playing', () => {
    expect(player.stop).toThrow('Not playing, can not stop');
  });

  it('can stop successfully when playing', () => {
    player.playSomethingCool();
    player.stop();
    expect(player.playing).toBe(false);
  });

  it('cannot resume when the song is playing', () => {
    player.playSomethingCool();
    expect(player.resume).toThrow('already playing');
  })
})