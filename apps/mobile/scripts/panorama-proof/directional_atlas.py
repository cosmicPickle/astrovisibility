"""App projection adapter for OpenCV. Created 2026-09-14 10:20 +03:00.

Mirrors src/panorama/directionalAtlas.ts and tileGeometry.ts. This module only
converts coordinate frames and builds sampling maps; OpenCV does image warping.
World axes are east/up/north; camera axes are image-right/image-down/forward.
"""

import cv2
import numpy as np


def camera_basis(azimuth_degrees, altitude_degrees, roll_degrees):
    if (not np.isfinite([azimuth_degrees, altitude_degrees, roll_degrees]).all()
            or not 0 <= altitude_degrees <= 90):
        raise ValueError('Invalid camera direction.')
    azimuth, altitude, roll = np.radians(
        [azimuth_degrees, altitude_degrees, roll_degrees])
    forward = np.array([np.cos(altitude) * np.sin(azimuth), np.sin(altitude),
                        np.cos(altitude) * np.cos(azimuth)])
    right = np.array([np.cos(azimuth), 0, -np.sin(azimuth)])
    up = np.array([-np.sin(altitude) * np.sin(azimuth), np.cos(altitude),
                   -np.sin(altitude) * np.cos(azimuth)])
    rolled_right = right * np.cos(roll) + up * np.sin(roll)
    rolled_up = -right * np.sin(roll) + up * np.cos(roll)
    return np.column_stack((rolled_right, -rolled_up, forward))


def validate_atlas_size(size):
    if not isinstance(size, int) or not 64 <= size <= 2048 or size % 2:
        raise ValueError('Atlas size must be an even integer from 64 to 2048.')


def atlas_directions(size, start_row=0, row_count=None):
    validate_atlas_size(size)
    row_count = size if row_count is None else row_count
    rows, columns = np.mgrid[start_row:start_row + row_count, :size]
    east = (columns.astype(np.float32) - size / 2) / (size / 2)
    north = (size / 2 - rows.astype(np.float32)) / (size / 2)
    radius = np.hypot(east, north)
    # sin(pi*r/2)/r has the finite limit pi/2 at zenith.
    scale = np.empty_like(radius)
    np.divide(np.sin(radius * np.pi / 2), radius, out=scale, where=radius > 0)
    scale[radius == 0] = np.pi / 2
    directions = np.stack((east * scale, np.cos(radius * np.pi / 2),
                           north * scale), axis=-1)
    return directions, radius <= 1


def project_tile(image, intrinsics, world_from_camera, size):
    validate_atlas_size(size)
    height, width = image.shape[:2]
    color = np.zeros((size, size, 3), np.uint8)
    coverage = np.zeros((size, size), np.uint8)
    # Bound transient ray/map memory independently of the number of photos.
    for start_row in range(0, size, 64):
        row_count = min(64, size - start_row)
        world_rays, inside = atlas_directions(size, start_row, row_count)
        camera_rays = world_rays @ world_from_camera
        projected = camera_rays @ intrinsics.T
        depth = projected[:, :, 2]
        safe_depth = np.where(depth > 1e-6, depth, 1)
        source_x = (projected[:, :, 0] / safe_depth).astype(np.float32)
        source_y = (projected[:, :, 1] / safe_depth).astype(np.float32)
        valid = (inside & (depth > 1e-6) & (source_x >= 0)
                 & (source_x <= width - 1) & (source_y >= 0)
                 & (source_y <= height - 1))
        warped = cv2.remap(image, source_x, source_y, cv2.INTER_LINEAR,
                           borderMode=cv2.BORDER_CONSTANT)
        warped[~valid] = 0
        color[start_row:start_row + row_count] = warped
        coverage[start_row:start_row + row_count] = valid.astype(np.uint8) * 255
    return color, coverage
