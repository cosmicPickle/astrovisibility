import { useMemo } from 'react';
import {
  AlphaType,
  ColorType,
  Fill,
  Group,
  ImageShader,
  Shader,
  Skia,
  useImage,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  createInverseRefractionTable,
  createSharedCelestialCubeOrientation,
  CUBE_FACE_PIXELS,
  REFRACTION_TABLE_WIDTH,
} from './backgroundCube';
import type { CelestialTimeTransform } from '../astronomy/celestialTimeTransform';
import { cubeBackgroundShader } from './backgroundCubeShaders';
import {
  createPlanetariumProjectionContext,
  type PlanetariumCamera,
} from './planetariumProjection';
import type { CanvasSizePixels } from './projection';
import { useCubeImage } from './useCubeImage';

let runtimeEffect: SkRuntimeEffect | null = null;
let refractionImage: SkImage | null = null;
function getRuntimeEffect() {
  runtimeEffect ??= Skia.RuntimeEffect.Make(cubeBackgroundShader);
  if (!runtimeEffect)
    throw new Error('Background projection shader could not be compiled.');
  return runtimeEffect;
}
function getRefractionImage() {
  if (!refractionImage) {
    const data = Skia.Data.fromBytes(createInverseRefractionTable());
    try {
      refractionImage = Skia.Image.MakeImage(
        {
          alphaType: AlphaType.Opaque,
          colorType: ColorType.RGBA_8888,
          width: REFRACTION_TABLE_WIDTH,
          height: 2,
        },
        data,
        REFRACTION_TABLE_WIDTH * 4,
      );
    } finally {
      data.dispose();
    }
    if (!refractionImage)
      throw new Error('Background refraction table could not be created.');
  }
  return refractionImage;
}

/** Image backgrounds only: the existing scene owns layer order and modes. */
export function CubeBackgroundLayer({
  camera,
  canvas,
  source,
  opacity = 1,
  timeTransform,
  sceneTimeMilliseconds,
  maskUri,
  maskColor = '#000000',
}: {
  camera: SharedValue<PlanetariumCamera>;
  canvas: CanvasSizePixels;
  source?: Parameters<typeof useImage>[0];
  opacity?: number;
  timeTransform?: CelestialTimeTransform;
  sceneTimeMilliseconds?: SharedValue<number>;
  maskUri?: string;
  maskColor?: string;
}) {
  const original = useImage(source ?? null);
  const originalMask = useImage(maskUri ?? null);
  const celestial = Boolean(timeTransform && sceneTimeMilliseconds);
  const cube = useCubeImage(
    original,
    celestial,
    celestial ? 512 : CUBE_FACE_PIXELS,
  );
  const maskCube = useCubeImage(originalMask, false, CUBE_FACE_PIXELS);
  const color = useMemo(() => Array.from(Skia.Color(maskColor)), [maskColor]);
  const sourceSize = [original?.width() ?? 1, original?.height() ?? 1];
  const maskSourceSize = [
    originalMask?.width() ?? 1,
    originalMask?.height() ?? 1,
  ];
  const uniforms = useDerivedValue(() => {
    const view = camera.value;
    const orientation =
      timeTransform && sceneTimeMilliseconds
        ? createSharedCelestialCubeOrientation(
            timeTransform,
            sceneTimeMilliseconds.value,
          )
        : null;
    return {
      viewport: [canvas.widthPixels, canvas.heightPixels],
      inverseScale:
        1 /
        createPlanetariumProjectionContext(view, canvas).projectionScalePixels,
      cameraRight: [view.right.x, view.right.y, view.right.z],
      cameraUp: [view.up.x, view.up.y, view.up.z],
      cameraForward: [view.forward.x, view.forward.y, view.forward.z],
      eastJ2000: orientation?.eastJ2000 ?? [1, 0, 0],
      upJ2000: orientation?.upJ2000 ?? [0, 1, 0],
      northJ2000: orientation?.northJ2000 ?? [0, 0, 1],
      celestial: celestial ? 1 : 0,
      faceSize: cube.facePixels,
      sourceSize,
      maskFaceSize: maskCube.facePixels,
      maskSourceSize,
      maskMode: maskUri ? (source ? 2 : 1) : 0,
      maskColor: color,
    };
  });
  const layerOpacity = useDerivedValue(() =>
    celestial
      ? Math.max(
          0,
          Math.min(0.62, ((camera.value.fieldOfViewDegrees - 1) / 17) * 0.62),
        ) * opacity
      : opacity,
  );
  const image = cube.image ?? maskCube.image;
  if (!image || (maskUri && !maskCube.image) || (source && !cube.image))
    return null;
  return (
    <Group opacity={layerOpacity}>
      <Fill>
        <Shader source={getRuntimeEffect()} uniforms={uniforms}>
          <ImageShader
            image={image}
            tx={celestial && !cube.facePixels ? 'repeat' : 'clamp'}
            ty="clamp"
          />
          <ImageShader image={maskCube.image ?? image} tx="clamp" ty="clamp" />
          <ImageShader
            image={celestial ? getRefractionImage() : image}
            tx="clamp"
            ty="clamp"
          />
          <ImageShader image={originalMask ?? image} tx="clamp" ty="clamp" />
        </Shader>
      </Fill>
    </Group>
  );
}
