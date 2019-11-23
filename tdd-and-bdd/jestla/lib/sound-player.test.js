import SoundPlayer from './sound-player';
describe('Test sound player class', () => {
  let sp;
  beforeEach(() => {
    sp = new SoundPlayer('bill');
  });
  test('should have name with bill', () => {
    expect(sp.name).toBe('bill');
  });
  it('using it and new sp with no paramters', () => {
    const sp = new SoundPlayer();
    expect(sp.name).toBe('bar');
  });
});

it('using outside it and new sp with no paramters', () => {
  const sp = new SoundPlayer();
  expect(sp.name).toBe('bar');
});