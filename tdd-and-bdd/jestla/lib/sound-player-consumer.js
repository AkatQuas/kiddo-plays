import SoundPlayer from './sound-player';

export default class SoundPlayerConsumer {
  constructor(name) {
    this.name = name !== undefined ? name : 'bangbang';
    this.soundPlayer = new SoundPlayer();
    this.playing = false;
  }

  playSomethingCool = (filename) => {
    const coolSoundFileName = filename !== undefined ? filename : 'song.mp3';
    this.soundPlayer.playSoundFile(coolSoundFileName);
    this.playing = true;
  }

  stop = () => {
    if (!this.playing) {
      throw Error('Not playing, can not stop');
    }
    this.playing = false;
  }

  resume = () => {
    if (this.playing) {
      throw Error('already playing');
    }
    this.playing = true;
  }
}
