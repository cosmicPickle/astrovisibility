"""Synthetic camera fixtures, not real-world quality evidence.

Created 2026-09-14 10:20 +03:00. All texture is generated locally from a fixed
seed. Camera rotations use Rodrigues matrices independently of the adapter.
"""

import cv2
import numpy as np


def synthetic_upward_captures():
    random = np.random.default_rng(20260914)
    texture = np.full((1024, 2048, 3), 210, np.uint8)
    for _ in range(6000):
        center = tuple(int(value) for value in random.integers([0, 0], [2048, 1024]))
        color = tuple(int(value) for value in random.integers(10, 230, 3))
        cv2.circle(texture, center, int(random.integers(2, 10)), color, -1)
    captures, rotations = [], []
    width, height = 640, 480
    focal = width / (2 * np.tan(np.radians(75) / 2))
    rows, columns = np.mgrid[:height, :width]
    camera_rays = np.stack(((columns - width / 2) / focal,
                           (rows - height / 2) / focal,
                           np.ones_like(rows)), axis=-1)
    # All three views overlap around zenith, with distinct pitch/yaw/roll.
    poses = [(0, 65, 0), (40, 80, 8), (85, 65, -6)]
    for index, (azimuth, altitude, roll) in enumerate(poses):
        yaw = cv2.Rodrigues(np.array([0., np.radians(azimuth), 0.]))[0]
        pitch = cv2.Rodrigues(np.array([-np.radians(altitude), 0., 0.]))[0]
        twist = cv2.Rodrigues(np.array([0., 0., -np.radians(roll)]))[0]
        rotation = yaw @ pitch @ np.diag([1, -1, 1]) @ twist
        world_rays = camera_rays @ rotation.T
        world_rays /= np.linalg.norm(world_rays, axis=2, keepdims=True)
        longitude = np.arctan2(world_rays[:, :, 0], world_rays[:, :, 2])
        latitude = np.arcsin(world_rays[:, :, 1])
        source_x = ((longitude / (2 * np.pi) + 0.5) * 2048).astype(np.float32)
        source_y = ((0.5 - latitude / np.pi) * 1024).astype(np.float32)
        image = cv2.remap(texture, source_x, source_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_WRAP)
        # Different exposure creates a genuine blend/compensation workload.
        captures.append(np.clip(image.astype(np.float32) * (1 - index * 0.12),
                                0, 255).astype(np.uint8))
        rotations.append(rotation)
    return captures, rotations, poses[0]
