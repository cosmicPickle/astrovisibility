import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCatalogueArtifacts } from './catalogueImporter.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(
  scriptDirectory,
  '../../src/catalogue/generated',
);
const artifacts = await buildCatalogueArtifacts(
  path.join(scriptDirectory, 'source'),
);
const expectedFiles = [
  ['catalogue.json', artifacts.serialized.catalogue],
  ['validation-report.json', artifacts.serialized.report],
  ['licence-manifest.json', artifacts.serialized.manifest],
] as const;

for (const [fileName, expected] of expectedFiles) {
  const actual = await readFile(path.join(outputDirectory, fileName), 'utf8');
  if (actual !== expected) {
    throw new Error(
      `${fileName} is stale. Run "pnpm --filter @astrovisibility/mobile catalogue:generate".`,
    );
  }
}

process.stdout.write(
  `Catalogue artefacts are current (${artifacts.manifest.outputSha256}).\n`,
);
