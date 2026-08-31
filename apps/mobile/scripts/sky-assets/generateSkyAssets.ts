import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildConstellationData,
  buildStarData,
  type ConstellationFeatureCollection,
} from './skyAssetImporter.ts';
import {
  createRegisteredSkyAssetsModule,
  dsoImageRequests,
  milkyWayAtlasRequest,
} from './skyImageRequests.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(scriptDirectory, 'source');
const generatedDirectory = path.resolve(
  scriptDirectory,
  '../../src/sky/generated',
);
const runtimeSkyDirectory = path.dirname(generatedDirectory);
const imageryDirectory = path.resolve(scriptDirectory, '../../assets/sky');

const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

const serialize = (value: unknown) => `${JSON.stringify(value)}\n`;

const run = async () => {
  const hygCompressed = await readFile(
    path.join(sourceDirectory, 'hyg_v44.csv.gz'),
  );
  const lineBytes = await readFile(
    path.join(sourceDirectory, 'constellations.lines.json'),
  );
  const labelBytes = await readFile(
    path.join(sourceDirectory, 'constellations.json'),
  );
  const starResult = buildStarData(
    gunzipSync(hygCompressed).toString('utf8'),
    7,
  );
  const constellations = buildConstellationData(
    JSON.parse(lineBytes.toString('utf8')) as ConstellationFeatureCollection,
    JSON.parse(labelBytes.toString('utf8')) as ConstellationFeatureCollection,
  );
  const starsJson = serialize(
    starResult.stars.map((star) => [
      star.id,
      star.rightAscensionJ2000Hours,
      star.declinationJ2000Degrees,
      star.magnitude,
      star.colorIndexBv ?? null,
      star.properName ?? null,
    ]),
  );
  const constellationsJson = serialize(constellations);
  const dsoImagesJson = serialize(dsoImageRequests);
  const registeredSkyAssetsModule =
    createRegisteredSkyAssetsModule(dsoImageRequests);
  const dsoImageSurveyCounts = dsoImageRequests.reduce<Record<string, number>>(
    (counts, { surveyId }) => ({
      ...counts,
      [surveyId]: (counts[surveyId] ?? 0) + 1,
    }),
    {},
  );
  const downloadManifest = JSON.parse(
    await readFile(
      path.join(imageryDirectory, 'download-manifest.json'),
      'utf8',
    ),
  ) as unknown;
  const manifest = {
    generatedFromPinnedInputsOn: '2026-08-31',
    limitingMagnitude: 7,
    sources: [
      {
        bytes: hygCompressed.byteLength,
        commit: '53e3df311869e813ace5f1ad2ec4ce909f13256c',
        license: 'CC BY-SA 4.0',
        name: 'HYG Database v4.4',
        sha256: sha256(hygCompressed),
        url: 'https://codeberg.org/astronexus/hyg',
      },
      {
        commit: '7e720a3de062059d4c5400a379146a601d9010e0',
        license: 'BSD-3-Clause',
        name: 'd3-celestial Western constellation lines',
        sha256: sha256(lineBytes),
        url: 'https://github.com/ofrohn/d3-celestial',
      },
      {
        commit: 'e6d38fe5e71e2c591c975fb068f2daf0b89d59b0',
        license: 'Modification and redistribution permitted with attribution',
        name: 'Stellarium full-sky Milky Way panorama by Axel Mellinger',
        url: 'https://github.com/Stellarium/stellarium/blob/e6d38fe5e71e2c591c975fb068f2daf0b89d59b0/CREDITS.md',
      },
      {
        dataset: 'CDS/P/DSS2/color',
        license: 'ODbL-1.0',
        name: 'CDS Digitized Sky Survey 2 colour imagery',
        url: 'https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FDSS2%2Fcolor&fmt=html&get=record',
      },
    ],
    generated: {
      constellationCount: constellations.length,
      constellationsSha256: sha256(constellationsJson),
      dsoImageCount: dsoImageRequests.length,
      dsoImageSurveyCounts,
      milkyWayAtlas: {
        heightPixels: milkyWayAtlasRequest.heightPixels,
        widthPixels: milkyWayAtlasRequest.widthPixels,
      },
      starCount: starResult.stars.length,
      starsSha256: sha256(starsJson),
    },
    imagery: downloadManifest,
  };
  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(generatedDirectory, 'stars.json'), starsJson),
    writeFile(
      path.join(generatedDirectory, 'constellations.json'),
      constellationsJson,
    ),
    writeFile(path.join(generatedDirectory, 'dso-images.json'), dsoImagesJson),
    writeFile(
      path.join(generatedDirectory, 'sky-asset-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeFile(
      path.join(runtimeSkyDirectory, 'registeredSkyAssets.ts'),
      registeredSkyAssetsModule,
    ),
  ]);
};

await run();
