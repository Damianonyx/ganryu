"""Turnaround check of the thorn antagonist blockout against the concept sheet."""

import math

from characters import build_thorn_antagonist
from lib import camera, ground, light, principled, world

SAMPLES = 64


def build():
    world((0.55, 0.55, 0.56), 0.8)
    ground(40, principled("Floor", (0.5, 0.5, 0.52), rough=0.8), res=4)
    for i, rz in enumerate((0, math.pi / 2, math.pi * 0.25)):
        build_thorn_antagonist((-2.3 + i * 2.3, 0, 0), rot_z=rz, seed=7)
    light("AREA", (2, -6, 6), 1500, (1, 0.97, 0.94), size=5, target=(0, 0, 1.6))
    light("AREA", (-4, 3, 4), 600, (0.85, 0.9, 1.0), size=4, target=(0, 0, 1.6))
    camera((0, -10.5, 1.7), (0, 0, 1.6), lens=40)
