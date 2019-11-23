export default class SoundPlayer {
  constructor(name) {
    this.name = name !== undefined ? name : 'bar';
  }
  playSoundFile(name) {
    console.log('Playing sound %s', name);
  }
}
