import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(scriptDirectory, 'source');
const generatedDirectory = path.resolve(
  scriptDirectory,
  '../../src/sky/generated',
);
const imageryDirectory = path.resolve(scriptDirectory, '../../assets/sky');

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
      dso: Record<string, { bytes: number; sha256: string }>;
      gaia: { bytes: number; sha256: string };
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
  const gaiaBytes = await readFile(
    path.join(imageryDirectory, 'gaia-dr3-flux-color-car.jpg'),
  );
  if (
    gaiaBytes.byteLength !== manifest.imagery.gaia.bytes ||
    sha256(gaiaBytes) !== manifest.imagery.gaia.sha256
  ) {
    fail('Gaia image');
  }
  const expectedDsoIds = Object.keys(manifest.imagery.dso).sort();
  if (
    expectedDsoIds.length !== manifest.generated.dsoImageCount ||
    JSON.stringify(expectedDsoIds) !==
      JSON.stringify(dsoMetadata.map(({ targetId }) => targetId).sort())
  ) {
    fail('DSO image membership');
  }
  for (const targetId of expectedDsoIds) {
    const expected = manifest.imagery.dso[targetId]!;
    const filePath = path.join(imageryDirectory, 'dso', `${targetId}.jpg`);
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
