import { FormatFileSizePipe } from './format-file-size.pipe';

describe('FormatFileSizePipe', () => {
  it('create an instance', () => {
    const pipe = new FormatFileSizePipe();
    expect(pipe).toBeTruthy();
  });
  it('transform 16 to be 16 B', () => {
    const pipe = new FormatFileSizePipe();
    expect(pipe.transform(16, false)).toBe('16 B');
  });
  it('transform 66 to be 0.06 KB', () => {
    const pipe = new FormatFileSizePipe();
    expect(pipe.transform(66, false)).toBe('0.06 KB');
  });
});
