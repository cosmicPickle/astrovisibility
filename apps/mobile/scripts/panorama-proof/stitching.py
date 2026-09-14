"""OpenCV library orchestration. Created 2026-09-14 10:20 +03:00.

No custom feature detector, matcher, camera solver, seam finder, or blender.
The prototype intentionally rejects inputs OpenCV would silently leave out.
"""

from dataclasses import dataclass
from time import perf_counter

import cv2
import numpy as np

from directional_atlas import camera_basis, project_tile


@dataclass
class Camera:
    intrinsics: np.ndarray
    world_from_camera: np.ndarray


def estimate_cameras(images, anchor_degrees, single_tile_fov_degrees):
    if not 1 <= len(images) <= 12:
        raise ValueError('The prototype accepts 1 to 12 images.')
    anchor_basis = camera_basis(*anchor_degrees)
    if len(images) == 1:
        if (single_tile_fov_degrees is None or not np.isfinite(single_tile_fov_degrees)
                or not 1 <= single_tile_fov_degrees <= 150):
            raise ValueError('Single-tile horizontal field of view is required within 1..150 degrees.')
        height, width = images[0].shape[:2]
        focal = width / (2 * np.tan(np.radians(single_tile_fov_degrees) / 2))
        intrinsics = np.array([[focal, 0, width / 2], [0, focal, height / 2],
                               [0, 0, 1.]])
        return [Camera(intrinsics, anchor_basis)]

    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    stitcher.setWaveCorrection(False)
    stitcher.setRegistrationResol(0.6)
    status = stitcher.estimateTransform(images)
    if status != cv2.Stitcher_OK:
        raise ValueError(f'OpenCV could not align the captures (status {status}).')
    if list(stitcher.component()) != list(range(len(images))):
        raise ValueError('OpenCV could not align every capture; no partial result accepted.')
    recovered = stitcher.cameras()
    work_scale = stitcher.workScale()
    world_from_estimate = anchor_basis @ recovered[0].R.T
    cameras = []
    for camera in recovered:
        intrinsics = camera.K().copy()
        intrinsics[:2] /= work_scale
        world_from_camera = world_from_estimate @ camera.R
        if (not np.isfinite(intrinsics).all() or intrinsics[0, 0] <= 0
                or not np.isfinite(world_from_camera).all()):
            raise ValueError('OpenCV returned invalid camera parameters.')
        cameras.append(Camera(intrinsics, world_from_camera))
    return cameras


def compose_atlas(images, cameras, size=2048, seam_method='graphcut'):
    if not images or len(images) != len(cameras) or len(images) > 12:
        raise ValueError('Image and camera counts must agree within the prototype limit.')
    if seam_method not in ('graphcut', 'dp'):
        raise ValueError('Unknown library seam method.')
    started = perf_counter()
    warped, masks = [], []
    for image, camera in zip(images, cameras):
        color, mask = project_tile(image, camera.intrinsics, camera.world_from_camera, size)
        if not np.any(mask):
            raise ValueError('A capture has no upper-hemisphere coverage.')
        warped.append(color)
        masks.append(mask)
    coverage = np.bitwise_or.reduce(masks)
    result = warped[0]
    recovered_pixels = 0
    if len(images) > 1:
        result, recovered_pixels = blend_atlas_tiles(warped, masks, coverage, size, seam_method)
    result[coverage == 0] = 0
    rgba = np.dstack((result, coverage))
    return rgba, {'composition_seconds': round(perf_counter() - started, 3),
                  'seam_method': seam_method,
                  'seam_coverage_recovery_pixels': recovered_pixels,
                  'covered_pixels': int(np.count_nonzero(coverage)),
                  'coverage_fraction': round(np.count_nonzero(coverage) / size ** 2, 6)}


def prepare_blend_masks(masks, seams, size):
    blend_masks = []
    for mask, seam in zip(masks, seams):
        expanded = cv2.dilate(seam.get(), np.ones((3, 3), np.uint8))
        seam_mask = cv2.resize(expanded, (size, size), interpolation=cv2.INTER_NEAREST)
        blend_masks.append(cv2.bitwise_and(seam_mask, mask))
    coverage = np.bitwise_or.reduce(masks)
    missing = coverage & ~np.bitwise_or.reduce(blend_masks)
    recovered_pixels = int(np.count_nonzero(missing))
    # A thin region can disappear at the seam-finding resolution. Restore it
    # from the first actual covering photograph, never from extrapolated color.
    for mask, blend_mask in zip(masks, blend_masks):
        restored = missing & mask
        blend_mask |= restored
        missing &= ~restored
    return blend_masks, recovered_pixels


def blend_atlas_tiles(warped, masks, coverage, size, seam_method):
    seam_size = min(512, size)
    small_colors = [cv2.resize(image, (seam_size, seam_size), interpolation=cv2.INTER_AREA)
                    for image in warped]
    small_masks = [cv2.resize(mask, (seam_size, seam_size), interpolation=cv2.INTER_NEAREST)
                   for mask in masks]
    corners = [(0, 0)] * len(warped)
    compensator = cv2.detail.ExposureCompensator_createDefault(cv2.detail.ExposureCompensator_GAIN)
    compensator.feed(corners, small_colors, small_masks)
    for index, (image, mask) in enumerate(zip(small_colors, small_masks)):
        compensator.apply(index, (0, 0), image, mask)
    finder = (cv2.detail_GraphCutSeamFinder('COST_COLOR_GRAD')
              if seam_method == 'graphcut' else cv2.detail_DpSeamFinder('COLOR_GRAD'))
    seams = finder.find(
        [image.astype(np.float32) for image in small_colors], corners,
        [cv2.UMat(mask) for mask in small_masks])
    blend_masks, recovered_pixels = prepare_blend_masks(masks, seams, size)
    blender = cv2.detail_MultiBandBlender()
    blender.setNumBands(6)
    blender.prepare((0, 0, size, size))
    for index, (image, mask, seam_mask) in enumerate(zip(warped, masks, blend_masks)):
        compensator.apply(index, (0, 0), image, mask)
        blender.feed(image.astype(np.int16), seam_mask, (0, 0))
    blended, blend_mask = blender.blend(None, None)
    if np.any((coverage != 0) & (blend_mask == 0)):
        raise ValueError('Blending lost captured coverage; result rejected.')
    return np.clip(blended, 0, 255).astype(np.uint8), recovered_pixels
