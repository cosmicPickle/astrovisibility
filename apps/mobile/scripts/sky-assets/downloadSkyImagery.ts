import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createDsoImageUrl,
  createHips2FitsUrl,
  dsoImageRequests,
  gaiaAtlasRequest,
  SKY_IMAGE_SERVICE_ORIGIN,
} from './skyImageRequests.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '../../assets/sky');
const maximumResponseBytes = 8 * 1024 * 1024;

const readJpegDimensions = (bytes: Uint8Array) => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new TypeError('Downloaded image is not a JPEG');
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    const segmentLength = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (segmentLength < 2) throw new TypeError('Invalid JPEG segment');
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        heightPixels: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
        widthPixels: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
      };
    }
    offset += segmentLength + 2;
  }
  throw new TypeError('JPEG dimensions were not found');
};

const downloadImage = async (input: {
  filePath: string;
  heightPixels: number;
  url: URL;
  widthPixels: number;
}) => {
  if (input.url.origin !== SKY_IMAGE_SERVICE_ORIGIN) {
    throw new TypeError(`Unexpected image service origin: ${input.url.origin}`);
  }
  const response = await fetch(input.url, { redirect: 'error' });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  if (!response.headers.get('content-type')?.startsWith('image/jpeg')) {
    throw new TypeError('Image service returned an unexpected content type');
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maximumResponseBytes) {
    throw new RangeError('Image response exceeds the byte limit');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumResponseBytes) {
    throw new RangeError('Image response exceeds the byte limit');
  }
  const dimensions = readJpegDimensions(bytes);
  if (
    dimensions.widthPixels !== input.widthPixels ||
    dimensions.heightPixels !== input.heightPixels
  ) {
    throw new TypeError(
      `Unexpected JPEG dimensions: ${dimensions.widthPixels}x${dimensions.heightPixels}`,
    );
  }
  await writeFile(input.filePath, bytes);
  return {
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

const run = async () => {
  const dsoDirectory = path.join(outputDirectory, 'dso');
  await mkdir(dsoDirectory, { recursive: true });
  const gaiaUrl = createHips2FitsUrl({ ...gaiaAtlasRequest.query });
  const gaia = await downloadImage({
    filePath: path.join(outputDirectory, gaiaAtlasRequest.fileName),
    heightPixels: gaiaAtlasRequest.heightPixels,
    url: gaiaUrl,
    widthPixels: gaiaAtlasRequest.widthPixels,
  });
  const dso: Record<string, { bytes: number; sha256: string }> = {};
  for (const request of dsoImageRequests) {
    dso[request.targetId] = await downloadImage({
      filePath: path.join(dsoDirectory, `${request.targetId}.jpg`),
      heightPixels: request.heightPixels,
      url: createDsoImageUrl(request),
      widthPixels: request.widthPixels,
    });
  }
  await writeFile(
    path.join(outputDirectory, 'download-manifest.json'),
    `${JSON.stringify({ dso, gaia }, null, 2)}\n`,
  );
};

await run();
