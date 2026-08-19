"""Print independent horizontal-coordinate fixtures for manual review.

This is not part of the application build. It documents the exact Astropy
reference calculation used to produce the checked-in Stage 0 fixtures.
"""

import json
from astropy import units
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time
from astropy.utils import iers


iers.conf.auto_download = False

CASES = [
    {
        "id": "m31-sofia-winter-evening",
        "rightAscensionJ2000Hours": 0.7123056,
        "declinationJ2000Degrees": 41.26875,
        "timestampUtc": "2026-01-15T20:00:00.000Z",
        "latitudeDegreesNorth": 42.6977,
        "longitudeDegreesEast": 23.3219,
        "elevationMetersAboveMeanSeaLevel": 550,
    },
    {
        "id": "m42-sydney-summer-evening",
        "rightAscensionJ2000Hours": 5.588139,
        "declinationJ2000Degrees": -5.39111,
        "timestampUtc": "2026-01-15T11:00:00.000Z",
        "latitudeDegreesNorth": -33.8688,
        "longitudeDegreesEast": 151.2093,
        "elevationMetersAboveMeanSeaLevel": 58,
    },
    {
        "id": "omega-centauri-santiago-autumn",
        "rightAscensionJ2000Hours": 13.446667,
        "declinationJ2000Degrees": -47.47972,
        "timestampUtc": "2026-04-15T04:30:00.000Z",
        "latitudeDegreesNorth": -33.4489,
        "longitudeDegreesEast": -70.6693,
        "elevationMetersAboveMeanSeaLevel": 570,
    },
    {
        "id": "polaris-reykjavik-summer",
        "rightAscensionJ2000Hours": 2.530301,
        "declinationJ2000Degrees": 89.264109,
        "timestampUtc": "2026-06-21T00:00:00.000Z",
        "latitudeDegreesNorth": 64.1466,
        "longitudeDegreesEast": -21.9426,
        "elevationMetersAboveMeanSeaLevel": 35,
    },
    {
        "id": "m104-quito-horizon-nearby",
        "rightAscensionJ2000Hours": 12.6665,
        "declinationJ2000Degrees": -11.6231,
        "timestampUtc": "2026-05-10T08:40:00.000Z",
        "latitudeDegreesNorth": -0.1807,
        "longitudeDegreesEast": -78.4678,
        "elevationMetersAboveMeanSeaLevel": 2850,
    },
]


def transform(case):
    location = EarthLocation.from_geodetic(
        lon=case["longitudeDegreesEast"] * units.deg,
        lat=case["latitudeDegreesNorth"] * units.deg,
        height=case["elevationMetersAboveMeanSeaLevel"] * units.m,
    )
    target = SkyCoord(
        ra=case["rightAscensionJ2000Hours"] * units.hourangle,
        dec=case["declinationJ2000Degrees"] * units.deg,
        frame="icrs",
    )
    frame = AltAz(
        obstime=Time(case["timestampUtc"]),
        location=location,
        pressure=1013.25 * units.hPa,
        temperature=10 * units.deg_C,
        relative_humidity=0.5,
        obswl=550 * units.nm,
    )
    horizontal = target.transform_to(frame)
    return {
        **case,
        "expectedAzimuthDegreesClockwiseFromNorth": round(
            horizontal.az.degree, 8
        ),
        "expectedRefractedAltitudeDegrees": round(horizontal.alt.degree, 8),
        "toleranceDegrees": 0.25,
    }


print(json.dumps([transform(case) for case in CASES], indent=2))
