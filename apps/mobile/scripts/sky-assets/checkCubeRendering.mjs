import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  cubeBakeShader,
  cubeBackgroundShader,
} from '../../src/sky/backgroundCubeShaders.ts';
import {
  createInverseRefractionTable,
  createCelestialCubeOrientation,
  screenDirection,
  observedToJ2000,
  sampleInverseRefraction,
} from '../../src/sky/backgroundCube.ts';
import {
  createPlanetariumCamera,
  createPlanetariumProjectionContext,
} from '../../src/sky/planetariumProjection.ts';
const require = createRequire(import.meta.url);
const init = require(
  require.resolve('canvaskit-wasm', {
    paths: [require.resolve('@shopify/react-native-skia/package.json')],
  }),
);
const ck = await init();
const bake = ck.RuntimeEffect.Make(cubeBakeShader, (error) => {
  throw new Error(error);
});
const draw = ck.RuntimeEffect.Make(cubeBackgroundShader, (error) => {
  throw new Error(error);
});
if (!bake || !draw) throw new Error('Shader compilation failed');
const info = (width, height) => ({
  width,
  height,
  colorType: ck.ColorType.RGBA_8888,
  alphaType: ck.AlphaType.Unpremul,
  colorSpace: ck.ColorSpace.SRGB,
});
const image = (bytes, width, height) =>
  ck.MakeImage(info(width, height), bytes, width * 4);
const child = (source, repeat = false) =>
  source.makeShaderOptions(
    repeat ? ck.TileMode.Repeat : ck.TileMode.Clamp,
    ck.TileMode.Clamp,
    ck.FilterMode.Linear,
    ck.MipmapMode.None,
  );
function bakeImage(source, celestial, faceSize) {
  const stride = faceSize + 4,
    surface = ck.MakeSurface(stride * 3, stride * 2),
    paint = new ck.Paint(),
    input = child(source, celestial);
  const shader = bake.makeShaderWithChildren(
    [source.width(), source.height(), faceSize, Number(celestial)],
    [input],
  );
  paint.setShader(shader);
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const result = surface.makeImageSnapshot();
  paint.delete();
  shader.delete();
  input.delete();
  surface.delete();
  return result;
}
const refraction = createInverseRefractionTable(),
  refractionImage = image(refraction, 4096, 2);
const size = 2048,
  source = new Uint8Array(size * size * 4),
  mask = new Uint8Array(source.length);
// Analytic image: contrasting beams and one/three-pixel mask features in both
// directions. Coordinates are synthetic; this script never reads user files.
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4,
      covered = Math.hypot(x - 1024, y - 1024) <= 1024;
    const line = x % 97 < 3 || y % 83 < 3;
    source.set(
      [line ? 0 : 180, line ? 0 : 140, line ? 0 : 90, covered ? 255 : 0],
      offset,
    );
    const blocked =
      covered && (x < 760 || y > 1300 || x % 101 < 1 || y % 89 < 3);
    mask.set([255, 255, 255, blocked ? 255 : 0], offset);
  }
const sourceImage = image(source, size, size),
  maskImage = image(mask, size, size);
const faceSize = 1024,
  cube = bakeImage(sourceImage, false, faceSize),
  maskCube = bakeImage(maskImage, false, faceSize);
function render(
  camera,
  main,
  maskTexture,
  face,
  maskFace,
  mode = 2,
  orientation,
) {
  const viewport = { widthPixels: 600, heightPixels: 900 };
  const basis = (v) => [v.x, v.y, v.z];
  const uniforms = [
    600,
    900,
    1 /
      createPlanetariumProjectionContext(camera, viewport)
        .projectionScalePixels,
    ...basis(camera.right),
    ...basis(camera.up),
    ...basis(camera.forward),
    ...(orientation?.eastJ2000 ?? [1, 0, 0]),
    ...(orientation?.upJ2000 ?? [0, 1, 0]),
    ...(orientation?.northJ2000 ?? [0, 0, 1]),
    Number(Boolean(orientation)),
    face,
    orientation ? 2048 : size,
    orientation ? 1024 : size,
    maskFace,
    size,
    size,
    mode,
    1,
    1,
    1,
    1,
  ];
  const inputs = [
    child(main, Boolean(orientation) && !face),
    child(maskTexture),
    child(refractionImage),
    child(maskImage),
  ];
  const shader = draw.makeShaderWithChildren(uniforms, inputs);
  const paint = new ck.Paint();
  paint.setShader(shader);
  const surface = ck.MakeSurface(600, 900);
  surface.getCanvas().clear(ck.TRANSPARENT);
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const pixels = surface.getCanvas().readPixels(0, 0, info(600, 900));
  const snapshot = surface.makeImageSnapshot();
  const png = snapshot.encodeToBytes();
  snapshot.delete();
  surface.delete();
  paint.delete();
  shader.delete();
  inputs.forEach((s) => s.delete());
  return { pixels, png };
}
const output = process.argv[2];
if (output) mkdirSync(output, { recursive: true });
let maximumAlphaError = 0,
  outsideTolerance = 0,
  checked = 0,
  thinFeaturePixels = 0;
const cases = [
  { alt: 35, az: 0, fov: 100 },
  { alt: 90, az: 45, fov: 100 },
  { alt: 45, az: 45, fov: 35 },
  { alt: 10, az: 359, fov: 235 },
];
for (const [index, test] of cases.entries()) {
  const camera = createPlanetariumCamera({
    centerAltitudeDegrees: test.alt,
    centerAzimuthDegrees: test.az,
    fieldOfViewDegrees: test.fov,
  });
  const result = render(camera, cube, maskCube, faceSize, faceSize, 1);
  const direct = render(camera, sourceImage, maskImage, 0, 0, 1);
  if (output) {
    writeFileSync(`${output}/mask-cube-${index}.png`, result.png);
    writeFileSync(`${output}/mask-direct-${index}.png`, direct.png);
    writeFileSync(
      `${output}/panorama-${index}.png`,
      render(camera, cube, maskCube, faceSize, faceSize).png,
    );
  }
  for (let y = 0; y < 900; y += 2)
    for (let x = 0; x < 600; x += 2) {
      const offset = (y * 600 + x) * 4,
        actual = result.pixels[offset + 3],
        expected = direct.pixels[offset + 3];
      maximumAlphaError = Math.max(
        maximumAlphaError,
        Math.abs(actual - expected),
      );
      const d = screenDirection(
        { xPixels: x + 0.5, yPixels: y + 0.5 },
        camera,
        { widthPixels: 600, heightPixels: 900 },
      );
      if (d.y < 0) {
        if (actual !== 0) outsideTolerance++;
        continue;
      }
      const r = Math.hypot(d.x, d.z),
        factor =
          r > 1e-9 ? ((Math.acos(Math.min(1, d.y)) / Math.PI) * 2) / r : 0;
      const sx = 1024 + d.x * factor * 1024,
        sy = 1024 - d.z * factor * 1024;
      let low = 255,
        high = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ix = Math.max(0, Math.min(2047, Math.floor(sx) + dx)),
            iy = Math.max(0, Math.min(2047, Math.floor(sy) + dy));
          const value = mask[(iy * size + ix) * 4 + 3];
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
      if (actual < low - 4 || actual > high + 4) outsideTolerance++;
      if (expected > 100 && expected < 255) thinFeaturePixels++;
      checked++;
    }
}
// Encode known J2000 directions as colors, independently of cube face layout.
const mw = new Uint8Array(2048 * 1024 * 4);
for (let y = 0; y < 1024; y++)
  for (let x = 0; x < 2048; x++) {
    const ra = (0.25 - (x + 0.5) / 2048) * 2 * Math.PI,
      dec = (0.5 - (y + 0.5) / 1024) * Math.PI;
    mw.set(
      [
        Math.round((Math.cos(dec) * Math.cos(ra) + 1) * 127.5),
        Math.round((Math.cos(dec) * Math.sin(ra) + 1) * 127.5),
        Math.round((Math.sin(dec) + 1) * 127.5),
        255,
      ],
      (y * 2048 + x) * 4,
    );
  }
const mwSource = image(mw, 2048, 1024),
  mwCube = bakeImage(mwSource, true, 512);
const orientation = createCelestialCubeOrientation({
  observer: {
    latitudeDegreesNorth: 42,
    longitudeDegreesEast: 23,
    elevationMetersAboveMeanSeaLevel: 100,
  },
  timestampUtc: '2026-09-14T18:00:00Z',
});
const camera = createPlanetariumCamera({
  centerAltitudeDegrees: 35,
  centerAzimuthDegrees: 359,
  fieldOfViewDegrees: 235,
});
const result = render(camera, mwCube, maskImage, 512, 0, 0, orientation);
let maximumCelestialChannelError = 0;
for (let y = 0; y < 900; y += 7)
  for (let x = 0; x < 600; x += 7) {
    const d = screenDirection({ xPixels: x + 0.5, yPixels: y + 0.5 }, camera, {
      widthPixels: 600,
      heightPixels: 900,
    });
    const eq = observedToJ2000(
      d,
      orientation,
      sampleInverseRefraction(refraction, d.y),
    );
    [eq.x, eq.y, eq.z].forEach((value, channel) => {
      maximumCelestialChannelError = Math.max(
        maximumCelestialChannelError,
        Math.abs(
          result.pixels[(y * 600 + x) * 4 + channel] - (value + 1) * 127.5,
        ),
      );
    });
  }
const report = {
  checked,
  maximumAlphaError,
  outsideOneTexelTolerance: outsideTolerance,
  thinFeaturePixels,
  maximumCelestialChannelError,
};
console.log(JSON.stringify(report, null, 2));
for (const resource of [
  sourceImage,
  maskImage,
  cube,
  maskCube,
  mwSource,
  mwCube,
  refractionImage,
  bake,
  draw,
])
  resource.delete();
if (
  maximumAlphaError > 2 ||
  outsideTolerance > 0 ||
  maximumCelestialChannelError > 3 ||
  thinFeaturePixels < 100
)
  process.exitCode = 1;
