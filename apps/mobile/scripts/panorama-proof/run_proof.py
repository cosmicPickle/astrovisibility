"""Offline panorama proof CLI. Created 2026-09-14 10:20 +03:00."""

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
from time import perf_counter

import cv2
import numpy as np
from PIL import Image

from stitching import compose_atlas, estimate_cameras


def load_images(paths):
    if not 1 <= len(paths) <= 12:
        raise ValueError('The prototype accepts 1 to 12 images.')
    images, fingerprints = [], []
    for index, path in enumerate(paths):
        if path.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            raise ValueError(f'Input {index + 1} must be JPEG or PNG.')
        if path.stat().st_size > 25_000_000:
            raise ValueError(f'Input {index + 1} exceeds the compressed-file limit.')
        with Image.open(path) as header:
            width, height = header.size
            if max(width, height) > 12_000 or width * height > 40_000_000:
                raise ValueError(f'Input {index + 1} exceeds capture dimensions.')
        with path.open('rb') as source:
            encoded = source.read(25_000_001)
        if len(encoded) > 25_000_000:
            raise ValueError(f'Input {index + 1} exceeds the compressed-file limit.')
        image = cv2.imdecode(np.frombuffer(encoded, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(f'Input {index + 1} could not be decoded.')
        scale = min(1, 1024 / max(image.shape[:2]))
        if scale < 1:
            image = cv2.resize(image, None, fx=scale, fy=scale,
                               interpolation=cv2.INTER_AREA)
        images.append(image)
        fingerprints.append(hashlib.sha256(encoded).hexdigest())
    return images, fingerprints


def peak_working_set_mb():
    if os.name != 'nt':
        return None

    class ProcessMemoryCounters(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in (
                'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage',
                'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage',
                'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage')]

    counters = ProcessMemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi = ctypes.WinDLL('psapi', use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD]
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(),
                                    ctypes.byref(counters), counters.cb):
        return None
    return round(counters.PeakWorkingSetSize / 1024 ** 2, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('images', type=Path, nargs='+')
    parser.add_argument('--output', type=Path, required=True,
                        help='A new local directory; existing directories are rejected.')
    parser.add_argument('--anchor', type=float, nargs=3, required=True,
                        metavar=('AZIMUTH', 'ALTITUDE', 'ROLL'),
                        help='First photo sensor direction in degrees. Not inferred from image matching.')
    parser.add_argument('--horizontal-fov', type=float,
                        help='Required for a single photo; multi-photo intrinsics come from OpenCV.')
    parser.add_argument('--size', type=int, default=2048)
    parser.add_argument('--seam', choices=('graphcut', 'dp'), default='graphcut',
                        help='Compare two built-in OpenCV seam finders.')
    args = parser.parse_args()
    cv2.setNumThreads(2)
    cv2.setRNGSeed(42)
    started = perf_counter()
    try:
        if args.output.exists():
            raise ValueError('Output directory already exists; choose a new one.')
        images, fingerprints = load_images(args.images)
        registration_started = perf_counter()
        cameras = estimate_cameras(images, args.anchor, args.horizontal_fov)
        registration_seconds = perf_counter() - registration_started
        result, metrics = compose_atlas(images, cameras, args.size, args.seam)
        metrics.update({
            'opencv_version': cv2.__version__, 'image_count': len(images),
            'registration_seconds': round(registration_seconds, 3),
            'processing_seconds_before_png_encoding': round(perf_counter() - started, 3),
            'peak_process_working_set_mb': peak_working_set_mb(),
            'projection': 'azimuthal-equidistant-upper-hemisphere',
            'width_pixels': args.size, 'height_pixels': args.size,
            'source_sha256': fingerprints,
            'measurement_scope': 'desktop process; not Android performance',
            'absolute_alignment': 'supplied first-camera anchor; not independently verified',
        })
        success, encoded = cv2.imencode('.png', result)
        if not success:
            raise ValueError('PNG encoding failed.')
        args.output.mkdir(parents=True, exist_ok=False)
        (args.output / 'panorama.png').write_bytes(encoded.tobytes())
        (args.output / 'metrics.json').write_text(json.dumps(metrics, indent=2) + '\n')
        # The console contains only aggregate diagnostics, never source paths or poses.
        print(json.dumps({key: value for key, value in metrics.items()
                          if key != 'source_sha256'}, indent=2))
    except (ValueError, OSError, cv2.error, Image.DecompressionBombError) as error:
        if isinstance(error, ValueError):
            parser.exit(1, str(error) + '\n')
        parser.exit(1, 'The local panorama proof failed; source images were not changed.\n')


if __name__ == '__main__':
    main()
