/** @jest-environment node */

import {
  assetFileNameForTargetId,
  createRegisteredSkyAssetsModule,
  createDsoImageUrl,
  dsoImageRequests,
} from './skyImageRequests.ts';
import catalogueJson from '../../src/catalogue/generated/catalogue.json';

const catalogue = catalogueJson as {
  targets: Array<{
    id: string;
    memberships: { caldwell?: number; messier: number[] };
  }>;
};

describe('registered DSO image requests', () => {
  it('covers every Messier designation and every Caldwell target exactly once', () => {
    const requestsByTargetId = new Map(
      dsoImageRequests.map((request) => [request.targetId, request]),
    );
    const messierTargets = catalogue.targets.filter(
      ({ memberships }) => memberships.messier.length > 0,
    );
    const messierDesignations = new Set(
      messierTargets.flatMap(({ memberships }) => memberships.messier),
    );
    const caldwellTargets = catalogue.targets.filter(
      ({ memberships }) => memberships.caldwell !== undefined,
    );

    expect(messierTargets).toHaveLength(109);
    expect(messierDesignations.size).toBe(110);
    expect(caldwellTargets).toHaveLength(109);
    for (const target of [...messierTargets, ...caldwellTargets]) {
      expect(requestsByTargetId.has(target.id)).toBe(true);
    }
    expect(requestsByTargetId.size).toBe(dsoImageRequests.length);
  });

  it('adds the deterministic notable named DSO set and chooses an all-sky southern fallback', () => {
    expect(dsoImageRequests).toHaveLength(289);
    expect(dsoImageRequests.map(({ targetId }) => targetId)).toEqual(
      dsoImageRequests.map(({ targetId }) => targetId).toSorted(),
    );
    for (const targetId of [
      'B033',
      'ESO056-115',
      'NGC3372',
      'NGC6888',
      'NGC7000',
      'NGC7293',
    ]) {
      expect(
        dsoImageRequests.some((request) => request.targetId === targetId),
      ).toBe(true);
    }

    const m31 = dsoImageRequests.find(({ targetId }) => targetId === 'NGC0224');
    const m7 = dsoImageRequests.find(({ targetId }) => targetId === 'NGC6475');
    expect(m31?.surveyId).toBe('CDS/P/PanSTARRS/DR1/color-i-r-g');
    expect(m7?.surveyId).toBe('CDS/P/allWISE/color');
    expect(createDsoImageUrl(m7!).searchParams.get('hips')).toBe(
      'CDS/P/allWISE/color',
    );
  });

  it('bundles a registered North America Nebula cutout', () => {
    const request = dsoImageRequests.find(
      ({ targetId }) => targetId === 'NGC7000',
    );

    expect(request).toEqual({
      targetId: 'NGC7000',
      rightAscensionJ2000Hours: 20.988094444444446,
      declinationJ2000Degrees: 44.528777777777776,
      fieldOfViewDegrees: 2.5,
      widthPixels: 256,
      heightPixels: 256,
      surveyId: 'CDS/P/PanSTARRS/DR1/color-i-r-g',
    });
    expect(
      Number(createDsoImageUrl(request!).searchParams.get('ra')),
    ).toBeCloseTo(314.8214166666667, 12);
  });

  it('generates safe, static React Native asset imports for every request', () => {
    expect(assetFileNameForTargetId('IC2431 NED02')).toBe('IC2431-NED02');
    const moduleSource = createRegisteredSkyAssetsModule([
      {
        targetId: 'IC2431 NED02',
        rightAscensionJ2000Hours: 10,
        declinationJ2000Degrees: 14,
        fieldOfViewDegrees: 0.5,
        widthPixels: 256,
        heightPixels: 256,
        surveyId: 'CDS/P/PanSTARRS/DR1/color-i-r-g',
      },
    ]);

    expect(moduleSource).toContain(
      "import dsoImage000 from '../../assets/sky/dso/IC2431-NED02.jpg';",
    );
    expect(moduleSource).toContain("'IC2431 NED02': dsoImage000");
  });
});
