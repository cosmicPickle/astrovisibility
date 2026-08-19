import { mkdir, writeFile } from 'node:fs/promises';
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

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, 'catalogue.json'),
    artifacts.serialized.catalogue,
    'utf8',
  ),
  writeFile(
    path.join(outputDirectory, 'validation-report.json'),
    artifacts.serialized.report,
    'utf8',
  ),
  writeFile(
    path.join(outputDirectory, 'licence-manifest.json'),
    artifacts.serialized.manifest,
    'utf8',
  ),
]);

process.stdout.write(
  `Generated ${artifacts.report.runtimeTargets} catalogue targets (${artifacts.manifest.outputSha256}).\n`,
);
