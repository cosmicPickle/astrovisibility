import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { CUBE_PADDING_PIXELS } from './backgroundCube';
import { cubeBakeShader } from './backgroundCubeShaders';

let bakeEffect: SkRuntimeEffect | null = null;
let preparationQueue = Promise.resolve();

/** Serialized to bound transient GPU memory and leave a frame between faces. */
export function prepareCubeImage(
  source: SkImage,
  celestial: boolean,
  facePixels: number,
  cancelled: () => boolean,
): Promise<SkImage | null> {
  const task = preparationQueue.then(async () => {
    if (cancelled()) return null;
    bakeEffect ??= Skia.RuntimeEffect.Make(cubeBakeShader);
    if (!bakeEffect)
      throw new Error('Cube image shader could not be compiled.');
    const stride = facePixels + 2 * CUBE_PADDING_PIXELS;
    const surface = Skia.Surface.MakeOffscreen(stride * 3, stride * 2);
    if (!surface) throw new Error('Cube image surface could not be allocated.');
    const child = source.makeShaderOptions(
      celestial ? TileMode.Repeat : TileMode.Decal,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    const shader = bakeEffect.makeShaderWithChildren(
      [source.width(), source.height(), facePixels, celestial ? 1 : 0],
      [child],
    );
    const paint = Skia.Paint();
    paint.setShader(shader);
    try {
      const canvas = surface.getCanvas();
      canvas.clear(Skia.Color('transparent'));
      for (let face = 0; face < 6; face++) {
        if (cancelled()) return null;
        canvas.drawRect(
          Skia.XYWHRect(
            (face % 3) * stride,
            Math.floor(face / 3) * stride,
            stride,
            stride,
          ),
          paint,
        );
        surface.flush();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (cancelled()) return null;
      const snapshot = surface.makeImageSnapshot();
      try {
        // Preparation and the native Canvas use different graphics contexts.
        // A raster copy is uploaded once by the Canvas, never during panning.
        const transferable = snapshot.makeNonTextureImage();
        if (!transferable)
          throw new Error('Cube image could not be transferred.');
        return transferable;
      } finally {
        snapshot.dispose();
      }
    } finally {
      paint.dispose();
      shader.dispose();
      child.dispose();
      surface.dispose();
    }
  });
  preparationQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
