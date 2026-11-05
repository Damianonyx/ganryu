"""
Shot 1a/1b — "Evening settles over the village. Lanterns glow outside wooden homes."

The warm before-the-fire establishing shot: a lane of houses at dusk, a
father and child (placeholder silhouettes) practising in front of their home.
"""

import math
import random

from mathutils import Vector

from characters import protagonist_silhouette
from lib import MeshBuilder, box, camera, ellipsoid, emission, ground, house, light, pine, principled, tube, volume_box, world
from shot_fortress import _rock

SAMPLES = 96
STILL_FRAME = 1


def build():
    rnd = random.Random(21)
    world((1.0, 0.5, 0.28), 0.9, top=(0.05, 0.05, 0.14))
    light("SUN", (0, 0, 10), 1.2, (1.0, 0.55, 0.35), size=math.radians(4), name="Sun").rotation_euler = (math.radians(82), 0, math.radians(200))

    ground(220, principled("Earth", (0.09, 0.07, 0.055), rough=0.9), noise=0.06, res=100)
    far = principled("Mountain", (0.08, 0.07, 0.1), rough=0.95)
    _rock("RidgeA", (-120, 260, -10), (140, 60, 70), far, 1, detail=4, strength=0.25)
    _rock("RidgeB", (150, 300, -10), (160, 70, 90), far, 2, detail=4, strength=0.25)
    _rock("RidgeC", (0, 380, -20), (220, 80, 120), far, 3, detail=4, strength=0.22)

    wall = principled("Plaster", (0.42, 0.34, 0.26), rough=0.9)
    roof = principled("Thatch", (0.06, 0.045, 0.035), rough=0.85)
    wood = principled("Timber", (0.07, 0.04, 0.025), rough=0.7)
    walls, roofs, posts = MeshBuilder(), MeshBuilder(), MeshBuilder()
    lanterns = MeshBuilder()
    lantern_pts = []
    placed = []
    for side in (-1, 1):
        for i in range(5):
            x = side * (7.5 + rnd.uniform(-0.6, 0.6))
            y = 4 + i * 9 + rnd.uniform(-1, 1)
            house(walls, roofs, posts, (x, y, 0), 6.0, 5.0, 2.8, rot_z=math.pi / 2)
            placed.append((side, x, y))
            lp = Vector((x - side * 3.3, y - 2.0, 2.3))
            lantern_pts.append(lp)
            posts.add(*tube(lp + Vector((0, 0, 0.3)), lp + Vector((0, 0, 0.6)), 0.01, 0.01, 4))
            lanterns.add(*ellipsoid(lp, (0.17, 0.17, 0.24), seg=10, rings=6))
    # lit shoji doorways facing the lane, with timber lattice
    shoji = MeshBuilder()
    for side, x, y0 in placed:
        if True:
            fx = x - side * 2.5
            for dy in (-1.3, 1.3):
                shoji.add(*box((fx - side * 0.03, y0 + dy, 1.05), (0.02, 1.9, 1.9)))
                for k in range(5):
                    posts.add(*box((fx - side * 0.06, y0 + dy - 0.95 + k * 0.475, 1.05), (0.04, 0.05, 1.95)))
                for k in range(4):
                    posts.add(*box((fx - side * 0.06, y0 + dy, 0.1 + k * 0.63), (0.04, 1.95, 0.05)))
    shoji.build("Shoji", emission("ShojiGlow", (1.0, 0.62, 0.32), 2.2))
    walls.build("Walls", wall)
    roofs.build("Roofs", roof)
    posts.build("Posts", wood)
    lanterns.build("Lanterns", emission("LanternPaper", (1.0, 0.45, 0.16), 7))
    for i, lp in enumerate(lantern_pts):
        light("POINT", lp, 45, (1.0, 0.55, 0.22), size=0.25, name=f"Lantern{i}")
    # warm light spilling from doorways
    for side in (-1, 1):
        for i in range(5):
            light("AREA", (side * 4.2, 4 + i * 9, 1.2), 60, (1.0, 0.6, 0.3), size=1.5, target=(0, 4 + i * 9, 0), name="Door")

    trees = MeshBuilder()
    for _ in range(60):
        x = rnd.choice((-1, 1)) * rnd.uniform(13, 45)
        pine(trees, (x, rnd.uniform(-5, 90), 0), rnd.uniform(8, 15), rnd)
    trees.build("Pines", principled("PineDark", (0.02, 0.025, 0.02), rough=0.9))

    # father and child practising in the lane
    figs = MeshBuilder()
    protagonist_silhouette(figs, (0.6, 9.0, 0), height=1.75, facing=math.radians(-110), draw=0.15)
    hand, tip = protagonist_silhouette(figs, (-0.4, 8.6, 0), height=1.05, facing=math.radians(70), draw=0.9)
    figs.build("Family", principled("Cloth", (0.03, 0.025, 0.025), rough=0.8))
    stick = MeshBuilder()
    stick.add(*tube(hand, tip, 0.02, 0.016, 5))
    stick.build("WoodenSword", principled("Wood", (0.25, 0.15, 0.08), rough=0.6))

    # fireflies / dust motes and evening haze
    motes = MeshBuilder()
    for _ in range(35):
        p = Vector((rnd.uniform(-6, 6), rnd.uniform(0, 30), rnd.uniform(0.5, 4)))
        motes.add(*ellipsoid(p, (0.012, 0.012, 0.012), seg=4, rings=3))
    motes.build("Motes", emission("Mote", (1.0, 0.7, 0.3), 10))
    volume_box("EveningHaze", (0, 60, 10), (160, 150, 22), density=0.006, color=(1.0, 0.8, 0.7), anisotropy=0.5)

    camera((1.8, -7.5, 3.2), (-0.2, 14, 1.6), lens=32, dof_dist=17.0, fstop=4)
