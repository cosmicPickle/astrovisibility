import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assetFileNameForTargetId,
  createDsoImageUrl,
  dsoImageRequests,
  milkyWayAtlasRequest,
  SKY_IMAGE_SERVICE_ORIGIN,
} from './skyImageRequests.ts';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '../../assets/sky');
const maximumResponseBytes = 8 * 1024 * 1024;
const maximumConcurrentDownloads = 4;

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

const readPngDimensions = (bytes: Uint8Array) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new TypeError('Downloaded image is not a PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    heightPixels: view.getUint32(20),
    widthPixels: view.getUint32(16),
  };
};

const downloadImage = async (input: {
  contentType?: 'image/jpeg' | 'image/png';
  filePath: string;
  heightPixels: number;
  url: URL;
  widthPixels: number;
}) => {
  if (
    input.url.origin !== SKY_IMAGE_SERVICE_ORIGIN &&
    input.url.origin !== 'https://raw.githubusercontent.com'
  ) {
    throw new TypeError(`Unexpected image service origin: ${input.url.origin}`);
  }
  const response = await fetch(input.url, { redirect: 'error' });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const contentType = input.contentType ?? 'image/jpeg';
  if (!response.headers.get('content-type')?.startsWith(contentType)) {
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
  const dimensions =
    contentType === 'image/png'
      ? readPngDimensions(bytes)
      : readJpegDimensions(bytes);
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
  const milkyWay = await downloadImage({
    contentType: 'image/png',
    filePath: path.join(outputDirectory, milkyWayAtlasRequest.fileName),
    heightPixels: milkyWayAtlasRequest.heightPixels,
    url: new URL(milkyWayAtlasRequest.sourceUrl),
    widthPixels: milkyWayAtlasRequest.widthPixels,
  });
  const dso: Record<
    string,
    { bytes: number; sha256: string; surveyId: string }
  > = {};
  for (
    let offset = 0;
    offset < dsoImageRequests.length;
    offset += maximumConcurrentDownloads
  ) {
    const batch = dsoImageRequests.slice(
      offset,
      offset + maximumConcurrentDownloads,
    );
    const results = await Promise.all(
      batch.map(async (request) => ({
        request,
        image: await downloadImage({
          filePath: path.join(
            dsoDirectory,
            `${assetFileNameForTargetId(request.targetId)}.jpg`,
          ),
          heightPixels: request.heightPixels,
          url: createDsoImageUrl(request),
          widthPixels: request.widthPixels,
        }),
      })),
    );
    for (const { image, request } of results) {
      dso[request.targetId] = { ...image, surveyId: request.surveyId };
    }
    console.log(
      `Downloaded ${Math.min(offset + batch.length, dsoImageRequests.length)}/${dsoImageRequests.length} DSO images.`,
    );
  }
  await writeFile(
    path.join(outputDirectory, 'download-manifest.json'),
    `${JSON.stringify({ dso, milkyWay }, null, 2)}\n`,
  );
};

await run();
