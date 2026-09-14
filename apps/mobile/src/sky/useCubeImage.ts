import { useEffect, useState } from 'react';
import type { SkImage } from '@shopify/react-native-skia';
import { prepareCubeImage } from './cubeImagePreparation';

/** Keeps the exact source shader available while baking, and on allocation
 * failure. Never transfers ownership of the caller's decoded source image. */
export function useCubeImage(
  source: SkImage | null,
  celestial: boolean,
  facePixels: number,
) {
  const [ready, setReady] = useState<{
    source: SkImage;
    image: SkImage;
    facePixels: number;
  } | null>(null);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let ownedImage: SkImage | null = null;
    void prepareCubeImage(source, celestial, facePixels, () => cancelled)
      .then((image) => {
        if (cancelled) {
          image?.dispose();
          return;
        }
        if (image) {
          ownedImage = image;
          setReady({ source, image, facePixels });
        }
      })
      .catch(() => {
        // The source projection remains fully functional; no data is modified.
      });
    return () => {
      cancelled = true;
      ownedImage?.dispose();
    };
  }, [source, celestial, facePixels]);
  if (ready?.source === source && ready.facePixels === facePixels)
    return { image: ready.image, facePixels };
  return { image: source, facePixels: 0 };
}
