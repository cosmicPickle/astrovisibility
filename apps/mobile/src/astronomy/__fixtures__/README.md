# Horizontal-coordinate fixture provenance

These values independently validate the Astrovisibility Astronomy Engine
adapter. They were generated on 2026-08-19 with:

- Astropy 8.0.1;
- ERFA 2.0.1.5;
- `astropy-iers-data` 0.2026.8.18.14.22.31 with network downloads disabled;
- ICRS/J2000 catalogue coordinates transformed to `AltAz`;
- UTC instants, WGS84 geodetic positions, and elevation above mean sea level;
- pressure 1013.25 hPa, temperature 10 C, relative humidity 0.5, and wavelength
  550 nm for standard optical refraction.

The reproducible, manually invoked generator is
`apps/mobile/scripts/generate-astronomy-reference-fixtures.py`. Astropy is not a
runtime or build dependency.

The 0.25-degree tolerance covers the differing standard-atmosphere and
precession/nutation models used by Astropy and Astronomy Engine while remaining
well below the Stage 0 interaction/mask-resolution risk scale. The near-horizon
case is deliberately included because refraction-model differences are largest
there. Azimuth comparisons use circular angular distance so north wrap does not
create a false 360-degree error.
