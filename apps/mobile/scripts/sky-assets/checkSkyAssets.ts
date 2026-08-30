import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assetFileNameForTargetId,
  createRegisteredSkyAssetsModule,
  dsoImageRequests,
} from './skyImageRequests.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(scriptDirectory, 'source');
const generatedDirectory = path.resolve(
  scriptDirectory,
  '../../src/sky/generated',
);
const imageryDirectory = path.resolve(scriptDirectory, '../../assets/sky');
const runtimeSkyDirectory = path.dirname(generatedDirectory);

const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

const fail = (message: string): never => {
  throw new Error(`Registered sky asset check failed: ${message}`);
};

const run = async () => {
  const manifest = JSON.parse(
    await readFile(
      path.join(generatedDirectory, 'sky-asset-manifest.json'),
      'utf8',
    ),
  ) as {
    generated: {
      constellationCount: number;
      constellationsSha256: string;
      dsoImageCount: number;
      starCount: number;
      starsSha256: string;
    };
    imagery: {
      dso: Record<string, { bytes: number; sha256: string; surveyId: string }>;
      milkyWay: { bytes: number; sha256: string };
    };
    sources: { name: string; sha256?: string }[];
  };
  const starsBytes = await readFile(
    path.join(generatedDirectory, 'stars.json'),
  );
  const constellationBytes = await readFile(
    path.join(generatedDirectory, 'constellations.json'),
  );
  const dsoMetadata = JSON.parse(
    await readFile(path.join(generatedDirectory, 'dso-images.json'), 'utf8'),
  ) as { targetId: string }[];
  if (sha256(starsBytes) !== manifest.generated.starsSha256)
    fail('star checksum');
  if (sha256(constellationBytes) !== manifest.generated.constellationsSha256) {
    fail('constellation checksum');
  }
  if (
    (JSON.parse(starsBytes.toString('utf8')) as unknown[]).length !==
    manifest.generated.starCount
  ) {
    fail('star count');
  }
  if (
    (JSON.parse(constellationBytes.toString('utf8')) as unknown[]).length !==
    manifest.generated.constellationCount
  ) {
    fail('constellation count');
  }
  const hygBytes = await readFile(path.join(sourceDirectory, 'hyg_v44.csv.gz'));
  const lineBytes = await readFile(
    path.join(sourceDirectory, 'constellations.lines.json'),
  );
  if (sha256(hygBytes) !== manifest.sources[0]?.sha256)
    fail('HYG source checksum');
  if (sha256(lineBytes) !== manifest.sources[1]?.sha256) {
    fail('constellation source checksum');
  }
  const milkyWayBytes = await readFile(
    path.join(imageryDirectory, 'stellarium-milkyway.png'),
  );
  if (
    milkyWayBytes.byteLength !== manifest.imagery.milkyWay.bytes ||
    sha256(milkyWayBytes) !== manifest.imagery.milkyWay.sha256
  ) {
    fail('Milky Way image');
  }
  const expectedDsoIds = Object.keys(manifest.imagery.dso).sort();
  if (
    expectedDsoIds.length !== manifest.generated.dsoImageCount ||
    JSON.stringify(expectedDsoIds) !==
      JSON.stringify(dsoMetadata.map(({ targetId }) => targetId).sort())
  ) {
    fail('DSO image membership');
  }
  const registeredSkyAssetsSource = await readFile(
    path.join(runtimeSkyDirectory, 'registeredSkyAssets.ts'),
    'utf8',
  );
  if (
    registeredSkyAssetsSource !==
    createRegisteredSkyAssetsModule(dsoImageRequests)
  ) {
    fail('runtime DSO asset module');
  }
  for (const targetId of expectedDsoIds) {
    const expected = manifest.imagery.dso[targetId]!;
    const metadata = dsoImageRequests.find(
      (request) => request.targetId === targetId,
    );
    if (!metadata || metadata.surveyId !== expected.surveyId) {
      fail(`DSO image survey ${targetId}`);
    }
    const filePath = path.join(
      imageryDirectory,
      'dso',
      `${assetFileNameForTargetId(targetId)}.jpg`,
    );
    const fileStat = await stat(filePath);
    const bytes = await readFile(filePath);
    if (fileStat.size !== expected.bytes || sha256(bytes) !== expected.sha256) {
      fail(`DSO image ${targetId}`);
    }
  }
  console.log(
    `Registered sky assets verified: ${manifest.generated.starCount} stars, ${manifest.generated.constellationCount} constellations, ${expectedDsoIds.length} DSO images.`,
  );
};

await run();
