"""Prototype acceptance tests. Created 2026-09-14 10:20 +03:00."""

import unittest
from unittest.mock import patch
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image

from directional_atlas import atlas_directions, camera_basis, project_tile
from stitching import estimate_cameras, compose_atlas, prepare_blend_masks
from synthetic_capture import synthetic_upward_captures
from run_proof import load_images


class DirectionalGeometryTests(unittest.TestCase):
    def test_atlas_has_expected_cardinals_zenith_and_outside(self):
        rays, inside = atlas_directions(200)
        np.testing.assert_allclose(rays[100, 100], [0, 1, 0], atol=1e-6)
        np.testing.assert_allclose(rays[0, 100], [0, 0, 1], atol=1e-6)
        np.testing.assert_allclose(rays[100, 0], [-1, 0, 0], atol=1e-6)
        self.assertFalse(inside[0, 0])

    def test_camera_basis_agrees_with_image_down_and_app_roll(self):
        np.testing.assert_allclose(camera_basis(0, 0, 0),
                                   np.diag([1, -1, 1]), atol=1e-6)
        # At north with positive 90-degree roll, image-right points up.
        np.testing.assert_allclose(camera_basis(0, 0, 90)[:, 0],
                                   [0, 1, 0], atol=1e-6)
        np.testing.assert_allclose(camera_basis(360, 90, 0)[:, 2],
                                   [0, 1, 0], atol=1e-6)

    def test_partial_zenith_tile_preserves_coverage_and_black_pixels(self):
        source = np.zeros((101, 101, 3), np.uint8)
        intrinsics = np.array([[100, 0, 50], [0, 100, 50], [0, 0, 1.]])
        color, mask = project_tile(source, intrinsics, camera_basis(0, 90, 0), 200)
        self.assertEqual(mask[100, 100], 255)
        self.assertEqual(mask[0, 100], 0)
        self.assertEqual(mask[0, 0], 0)
        self.assertEqual(int(color.sum()), 0)

    def test_north_wraparound_has_identical_projection(self):
        source = np.full((101, 101, 3), 128, np.uint8)
        intrinsics = np.array([[100, 0, 50], [0, 100, 50], [0, 0, 1.]])
        for left, right in zip(
            project_tile(source, intrinsics, camera_basis(-1, 45, 0), 200),
            project_tile(source, intrinsics, camera_basis(359, 45, 0), 200),
        ):
            np.testing.assert_array_equal(left, right)

    def test_rejects_invalid_atlas_and_camera_values(self):
        for size in (0, 4096, 201, float('nan')):
            with self.assertRaises(ValueError):
                atlas_directions(size)
        with self.assertRaises(ValueError):
            camera_basis(0, 91, 0)
        with self.assertRaises(ValueError):
            camera_basis(float('nan'), 0, 0)

    def test_oversized_projection_is_rejected_before_allocating_output(self):
        source = np.zeros((20, 20, 3), np.uint8)
        with patch('directional_atlas.np.zeros') as allocate:
            with self.assertRaises(ValueError):
                project_tile(source, np.eye(3), np.eye(3), 1_000_000)
            allocate.assert_not_called()


class LibraryFailureTests(unittest.TestCase):
    def test_seam_downsampling_cannot_erase_a_thin_captured_region(self):
        first = np.zeros((256, 256), np.uint8)
        second = first.copy()
        first[80:160, 80:160] = 255
        second[20, 20:23] = 255
        seams = [cv2.UMat(cv2.resize(first, (64, 64))),
                 cv2.UMat(np.zeros((64, 64), np.uint8))]
        blend_masks, recovered = prepare_blend_masks([first, second], seams, 256)
        np.testing.assert_array_equal(np.bitwise_or.reduce(blend_masks), first | second)
        self.assertEqual(recovered, 3)
        self.assertEqual(blend_masks[0][20, 20], 0)
        self.assertEqual(blend_masks[1][20, 20], 255)

    def test_featureless_pair_is_explicit_failure(self):
        blank = np.full((240, 320, 3), 128, np.uint8)
        with self.assertRaisesRegex(ValueError, 'align'):
            estimate_cameras([blank, blank], (0, 45, 0), 60)

    def test_empty_and_too_many_inputs_are_rejected(self):
        for images in ([], [np.zeros((20, 20, 3), np.uint8)] * 13):
            with self.assertRaises(ValueError):
                estimate_cameras(images, (0, 45, 0), 60)

    def test_single_tile_is_valid_without_matching(self):
        source = np.zeros((160, 240, 3), np.uint8)
        cameras = estimate_cameras([source], (0, 90, 0), 60)
        output, metrics = compose_atlas([source], cameras, 256)
        self.assertEqual(output.shape, (256, 256, 4))
        self.assertEqual(output[128, 128, 3], 255)
        self.assertEqual(output[0, 0, 3], 0)
        self.assertEqual(set(np.unique(output[:, :, 3])), {0, 255})
        self.assertGreater(metrics['covered_pixels'], 0)

    def test_single_tile_requires_an_explicit_field_of_view(self):
        with self.assertRaisesRegex(ValueError, 'field of view'):
            estimate_cameras([np.zeros((160, 240, 3), np.uint8)], (0, 90, 0), None)


class InputBoundaryTests(unittest.TestCase):
    def test_downsamples_large_valid_inputs_without_changing_sources(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'capture.png'
            Image.new('RGB', (1600, 1200), (20, 30, 40)).save(path)
            original = path.read_bytes()
            images, hashes = load_images([path])
            self.assertEqual(images[0].shape, (768, 1024, 3))
            self.assertEqual(len(hashes[0]), 64)
            self.assertEqual(path.read_bytes(), original)

    def test_dimension_limit_is_checked_before_opencv_decodes(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / 'oversized.png'
            Image.new('RGB', (12001, 1)).save(path)
            with patch('run_proof.cv2.imdecode') as decode:
                with self.assertRaisesRegex(ValueError, 'dimensions'):
                    load_images([path])
                decode.assert_not_called()


class UpwardStitchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cv2.setRNGSeed(42)
        cls.images, cls.expected_rotations, anchor = synthetic_upward_captures()
        cls.cameras = estimate_cameras(cls.images, anchor, 75)

    def test_recovers_known_relative_rotations_through_zenith(self):
        for camera, expected in zip(self.cameras, self.expected_rotations):
            cosine = (np.trace(expected.T @ camera.world_from_camera) - 1) / 2
            error_degrees = np.degrees(np.arccos(np.clip(cosine, -1, 1)))
            self.assertLess(error_degrees, 1.0)

    def test_blending_preserves_exact_coverage_union_and_transparent_outside(self):
        expected_coverage = np.bitwise_or.reduce([
            project_tile(image, camera.intrinsics, camera.world_from_camera, 512)[1]
            for image, camera in zip(self.images, self.cameras)])
        for seam_method in ('graphcut', 'dp'):
            with self.subTest(seam_method=seam_method):
                result, _ = compose_atlas(self.images, self.cameras, 512, seam_method)
                np.testing.assert_array_equal(result[:, :, 3], expected_coverage)
                self.assertEqual(result[256, 256, 3], 255)
                self.assertEqual(result[0, 0, 3], 0)
                self.assertTrue(np.all(result[expected_coverage == 0] == 0))

    def test_disconnected_extra_photo_is_not_silently_discarded(self):
        blank = np.full_like(self.images[0], 128)
        with self.assertRaisesRegex(ValueError, 'align'):
            estimate_cameras(self.images + [blank], (0, 65, 0), 75)


if __name__ == '__main__':
    cv2.setNumThreads(1)
    cv2.setRNGSeed(42)
    unittest.main()
