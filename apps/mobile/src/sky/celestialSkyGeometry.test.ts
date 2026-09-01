import {
  createRegisteredCelestialDsoImages,
  registeredCelestialSky,
} from './celestialSkyGeometry';

describe('fixed J2000 celestial geometry', () => {
  it('prepares every registered sky layer once in J2000', () => {
    expect(registeredCelestialSky.stars).toHaveLength(15_598);
    expect(registeredCelestialSky.constellations).toHaveLength(88);
    expect(registeredCelestialSky.atlasMeshes).toHaveLength(72);
    expect(
      registeredCelestialSky.atlasMeshes.reduce(
        (total, mesh) => total + mesh.directionVectors.length,
        0,
      ),
    ).toBe(3_528);
    expect(
      registeredCelestialSky.stars.every(
        ({ j2000UnitVector }) =>
          Math.abs(
            Math.hypot(
              j2000UnitVector.x,
              j2000UnitVector.y,
              j2000UnitVector.z,
            ) - 1,
          ) < 1e-12,
      ),
    ).toBe(true);
  });

  it('caches complete DSO mesh topology as fixed J2000 vectors', () => {
    const [image] = createRegisteredCelestialDsoImages([
      {
        declinationJ2000Degrees: 41.269,
        fieldOfViewDegrees: 3.2,
        rightAscensionJ2000Hours: 0.712,
        source: 1,
        targetId: 'M31',
      },
    ]);

    expect(image?.targetId).toBe('M31');
    expect(image?.mesh.directionVectors).toHaveLength(25);
    expect(image?.mesh.indices).toHaveLength(96);
    expect(image?.mesh.texturePointsPixels).toHaveLength(25);
    expect(image?.mesh.angularRadiusDegrees).toBeGreaterThan(2);
    expect(image?.mesh.angularRadiusDegrees).toBeLessThan(3);
  });
});
