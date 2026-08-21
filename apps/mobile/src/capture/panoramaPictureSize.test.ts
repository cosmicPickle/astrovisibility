import { selectPanoramaPictureSize } from './panoramaPictureSize';

describe('panorama picture-size selection', () => {
  it('prefers the largest supported 4:3 size at or below 1600 by 1200', () => {
    expect(
      selectPanoramaPictureSize([
        '4000x3000',
        '1920x1080',
        '1280x960',
        '1600x1200',
        '2048x1536',
      ]),
    ).toBe('1600x1200');
  });

  it('stays below the target when the exact size is unavailable', () => {
    expect(
      selectPanoramaPictureSize(['4000x3000', '2048x1536', '1280x960']),
    ).toBe('1280x960');
  });

  it('uses the largest smaller 4:3 size and ignores malformed or wide sizes', () => {
    expect(
      selectPanoramaPictureSize([
        'not-a-size',
        '1920x1080',
        '640x480',
        '1280x960',
      ]),
    ).toBe('1280x960');
  });

  it('accepts rotated 4:3 dimensions and returns null without a usable size', () => {
    expect(selectPanoramaPictureSize(['1200x1600', '900x1200'])).toBe(
      '1200x1600',
    );
    expect(selectPanoramaPictureSize(['broken', '1920x1080'])).toBeNull();
  });
});
