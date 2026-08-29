export const SKY_IMAGE_SERVICE_ORIGIN =
  'https://alasky.cds.unistra.fr' as const;

export interface DsoImageRequest {
  declinationJ2000Degrees: number;
  fieldOfViewDegrees: number;
  heightPixels: 256;
  rightAscensionJ2000Hours: number;
  targetId: string;
  widthPixels: 256;
}

export const gaiaAtlasRequest = {
  fileName: 'gaia-dr3-flux-color-car.jpg',
  heightPixels: 1024,
  query: {
    coordsys: 'icrs',
    dec: '0',
    format: 'jpg',
    fov: '360',
    height: '1024',
    hips: 'CDS/P/DM/flux-color-Rp-G-Bp/I/355/gaiadr3',
    inverse_longitude: 'true',
    projection: 'CAR',
    ra: '180',
    width: '2048',
  },
  widthPixels: 2048,
} as const;

export const dsoImageRequests: readonly DsoImageRequest[] = [
  {
    targetId: 'Mel022',
    rightAscensionJ2000Hours: 3.7912777777777777,
    declinationJ2000Degrees: 24.10527777777778,
    fieldOfViewDegrees: 6,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC0224',
    rightAscensionJ2000Hours: 0.7123194444444444,
    declinationJ2000Degrees: 41.26905555555555,
    fieldOfViewDegrees: 6,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC0598',
    rightAscensionJ2000Hours: 1.5641361111111112,
    declinationJ2000Degrees: 30.66022222222222,
    fieldOfViewDegrees: 2.587,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC1952',
    rightAscensionJ2000Hours: 5.575547222222222,
    declinationJ2000Degrees: 22.01447222222222,
    fieldOfViewDegrees: 0.333,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC1976',
    rightAscensionJ2000Hours: 5.587911111111111,
    declinationJ2000Degrees: -5.389666666666667,
    fieldOfViewDegrees: 3.75,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC3031',
    rightAscensionJ2000Hours: 9.925880555555555,
    declinationJ2000Degrees: 69.06530555555555,
    fieldOfViewDegrees: 0.901,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC3034',
    rightAscensionJ2000Hours: 9.931313888888889,
    declinationJ2000Degrees: 69.6793888888889,
    fieldOfViewDegrees: 0.458,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC4594',
    rightAscensionJ2000Hours: 12.666508333333333,
    declinationJ2000Degrees: -11.623055555555556,
    fieldOfViewDegrees: 0.352,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC5055',
    rightAscensionJ2000Hours: 13.263702777777779,
    declinationJ2000Degrees: 42.02927777777778,
    fieldOfViewDegrees: 0.493,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC5194',
    rightAscensionJ2000Hours: 13.497974999999999,
    declinationJ2000Degrees: 47.195166666666665,
    fieldOfViewDegrees: 0.571,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC5457',
    rightAscensionJ2000Hours: 14.053483333333334,
    declinationJ2000Degrees: 54.34894444444445,
    fieldOfViewDegrees: 1,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC6205',
    rightAscensionJ2000Hours: 16.694897222222224,
    declinationJ2000Degrees: 36.46130555555556,
    fieldOfViewDegrees: 0.688,
    widthPixels: 256,
    heightPixels: 256,
  },
  {
    targetId: 'NGC6720',
    rightAscensionJ2000Hours: 18.893058333333332,
    declinationJ2000Degrees: 33.02858333333333,
    fieldOfViewDegrees: 0.25,
    widthPixels: 256,
    heightPixels: 256,
  },
] as const;

export const createHips2FitsUrl = (query: Record<string, string>): URL => {
  const url = new URL(
    '/hips-image-services/hips2fits',
    SKY_IMAGE_SERVICE_ORIGIN,
  );
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
};

export const createDsoImageUrl = (request: DsoImageRequest): URL =>
  createHips2FitsUrl({
    coordsys: 'icrs',
    dec: String(request.declinationJ2000Degrees),
    format: 'jpg',
    fov: String(request.fieldOfViewDegrees),
    height: String(request.heightPixels),
    hips: 'CDS/P/PanSTARRS/DR1/color-i-r-g',
    inverse_longitude: 'false',
    projection: 'TAN',
    ra: String(request.rightAscensionJ2000Hours * 15),
    width: String(request.widthPixels),
  });
