import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyAndroidBuildFix } from './androidBuildFix.ts';

const scriptPath = fileURLToPath(import.meta.url);
const buildGradlePath = path.resolve(
  path.dirname(scriptPath),
  '../android/build.gradle',
);
writeFileSync(
  buildGradlePath,
  applyAndroidBuildFix(readFileSync(buildGradlePath, 'utf8')),
);
