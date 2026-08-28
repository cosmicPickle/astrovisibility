/** @jest-environment node */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const resourcePath = (...parts: string[]) =>
  path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', ...parts);

describe('Android launcher icon resources', () => {
  it('provides a padded transparent foreground and separate background layer', () => {
    const foregroundImagePath = resourcePath(
      'drawable-nodpi',
      'astrovisibility_launcher_foreground.png',
    );
    const foregroundDrawable = readFileSync(
      resourcePath('drawable', 'ic_launcher_foreground.xml'),
      'utf8',
    );
    const adaptiveIcon = readFileSync(
      resourcePath('mipmap-anydpi-v26', 'ic_launcher.xml'),
      'utf8',
    );

    expect(existsSync(foregroundImagePath)).toBe(true);
    expect(foregroundDrawable).toContain('android:inset="12dp"');
    expect(adaptiveIcon).toContain(
      '<background android:drawable="@color/ic_launcher_background"',
    );
    expect(adaptiveIcon).toContain(
      '<foreground android:drawable="@drawable/ic_launcher_foreground"',
    );
  });

  it('provides a themed monochrome layer on Android 13 and later', () => {
    const themedIcon = readFileSync(
      resourcePath('mipmap-anydpi-v33', 'ic_launcher.xml'),
      'utf8',
    );
    const monochromeDrawable = readFileSync(
      resourcePath('drawable', 'ic_launcher_monochrome.xml'),
      'utf8',
    );

    expect(themedIcon).toContain(
      '<monochrome android:drawable="@drawable/ic_launcher_monochrome"',
    );
    expect(monochromeDrawable).toContain('android:fillColor="#FFFFFFFF"');
  });

  it('keeps a branded fallback for Android 7 launchers', () => {
    const legacyIcon = readFileSync(
      resourcePath('mipmap-anydpi', 'ic_launcher.xml'),
      'utf8',
    );
    const legacyRoundIcon = readFileSync(
      resourcePath('mipmap-anydpi', 'ic_launcher_round.xml'),
      'utf8',
    );

    expect(legacyIcon).toContain('@drawable/ic_launcher_legacy_background');
    expect(legacyRoundIcon).toContain(
      '@drawable/ic_launcher_legacy_round_background',
    );
    expect(legacyIcon).toContain('@drawable/ic_launcher_legacy_foreground');
    expect(existsSync(resourcePath('mipmap-mdpi', 'ic_launcher.webp'))).toBe(
      false,
    );
  });
});
