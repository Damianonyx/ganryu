"""
Shot 2b — "Armored samurai emerge beyond the village gate; monster silhouettes behind."

Hero test: the thorn antagonist stands framed by the village gate, backlit by
the burning village, followers and monsters in the smoke behind him.
Animated: slow push-in, flame flicker, swaying chains (frames 1–72).
"""

import math
import random

from mathutils import Vector

from characters import build_thorn_antagonist, monster_silhouette, samurai_silhouette
from lib import (
    MeshBuilder,
    box,
    camera,
    embers,
    emission,
    flame_sheet,
    ground,
    house,
    light,
    pine,
    principled,
    tube,
    volume_box,
    world,
)

SAMPLES = 96
STILL_FRAME = 48


def build():
    rnd = random.Random(11)
    world((0.004, 0.005, 0.01), 1.0)

    ground(160, principled("Mud", (0.03, 0.025, 0.024), rough=0.62, spec=0.4), noise=0.04, res=120)

    # --- the gate (foreground frame)
    wood = principled("GateWood", (0.05, 0.03, 0.022), rough=0.7)
    gate = MeshBuilder()
    for sx in (-1, 1):
        gate.add(*box((sx * 2.7, -1.0, 2.7), (0.42, 0.42, 5.4)))
    gate.add(*box((0, -1.0, 5.55), (7.6, 0.5, 0.32)))
    gate.add(*box((0, -1.0, 4.55), (6.4, 0.3, 0.26)))
    for sx in (-1, 1):
        gate.add(*box((sx * 3.85, -1.0, 5.72), (0.7, 0.5, 0.2), rot=None))
    gate.build("Gate", wood)

    # --- the antagonist
    build_thorn_antagonist((0, 3.2, 0), rot_z=0.0, scale=1.0, seed=7)

    # --- followers behind him
    armour = principled("Armour", (0.02, 0.018, 0.02), rough=0.45, metal=0.5)
    foll = MeshBuilder()
    for i, (x, y) in enumerate(((-2.8, 7.5), (-1.6, 9.0), (1.7, 8.2), (2.9, 9.6), (-0.3, 11.5), (4.2, 11.0), (-4.0, 11.8))):
        samurai_silhouette(foll, (x, y, 0), height=1.8 * rnd.uniform(0.95, 1.05), facing=-math.pi / 2 + rnd.uniform(-0.2, 0.2), rnd=rnd)
    foll.build("Followers", armour)

    # --- burning village behind
    wall = principled("Wall", (0.09, 0.07, 0.06), rough=0.85)
    roof = principled("Roof", (0.03, 0.025, 0.025), rough=0.6)
    walls, roofs, posts = MeshBuilder(), MeshBuilder(), MeshBuilder()
    houses = [(-7, 15, 0.2), (6.5, 14, -0.3), (-2.5, 20, 0.05), (9, 22, 0.4), (-11, 23, -0.2)]
    for x, y, r in houses:
        house(walls, roofs, posts, (x, y, 0), 5.5, 4.2, 2.6, rot_z=r)
    walls.build("Walls", wall)
    roofs.build("Roofs", roof)
    posts.build("Posts", wood)
    for i, (x, y, r) in enumerate(houses):
        for k in range(5):
            flame_sheet(f"Flame{i}_{k}", (x + rnd.uniform(-2.2, 2.2), y - 1.2 + k * 0.5, 2.2 + rnd.uniform(0, 0.8)), 4.2, 4.5 + rnd.uniform(0, 2.0), rot_z=rnd.uniform(-0.4, 0.4), strength=10, seed=i * 3.1 + k)
        light("POINT", (x, y - 1.5, 3.6), 2200, (1.0, 0.4, 0.1), size=2.5, name=f"Fire{i}")
    # rim on the antagonist from the fires
    light("AREA", (2.5, 6.5, 3.2), 900, (1.0, 0.38, 0.1), size=2, target=(0, 3.2, 1.9), name="Rim")
    light("AREA", (-3.0, 7.0, 2.5), 500, (1.0, 0.3, 0.08), size=3, target=(0, 3.2, 1.6), name="Rim2")
    # cold moon fill from the camera side so the shards read
    light("AREA", (-5, -6, 6), 160, (0.55, 0.65, 1.0), size=6, target=(0, 3.2, 1.8), name="Fill")
    # under-glow from the talons
    light("POINT", (0, 3.0, 0.4), 60, (1.0, 0.25, 0.05), size=0.5, name="TalonGlow")

    # --- monsters in the smoke, eyes glowing
    flesh = principled("MonsterHide", (0.01, 0.008, 0.008), rough=0.8)
    eyes_m = emission("MonsterEyes", (1.0, 0.25, 0.05), 40)
    mons = MeshBuilder()
    eye_mb = MeshBuilder()
    for base, h, face in (((-6.5, 19, 0), 6.0, 0.35), ((7.5, 21, 0), 6.8, -0.4)):
        for e in monster_silhouette(mons, base, height=h, facing=face, rnd=rnd):
            eye_mb.add(*box(e, (0.18, 0.1, 0.09)))
    mons.build("Monsters", flesh, smooth=True)
    for x, y in ((-6.5, 23.5), (7.5, 25.5)):
        light("POINT", (x, y, 3.0), 2500, (1.0, 0.35, 0.08), size=3, name="MonsterBacklight")
    eye_mb.build("MonsterEyesMesh", eyes_m)

    # --- forest edge
    trees = MeshBuilder()
    for i in range(40):
        x = rnd.uniform(-35, 35)
        y = rnd.uniform(28, 55)
        pine(trees, (x, y, 0), rnd.uniform(9, 16), rnd)
    trees.build("Trees", principled("Pine", (0.008, 0.01, 0.01), rough=0.9))

    # --- atmosphere: smoke haze catches the firelight
    volume_box("Haze", (0, 14, 6), (70, 50, 14), density=0.014, color=(0.55, 0.5, 0.5), anisotropy=0.45, noise_scale=0.08, noise_amount=0.8)
    embers("Embers", (0, 8, 0.5), (12, 8, 7), 160, emission("Ember", (1.0, 0.4, 0.08), 12), size=0.014)

    # --- camera: low, slow push-in over 72 frames
    cam = camera((0.7, -9.0, 1.0), (0, 3.2, 2.05), lens=34, dof_dist=12.0, fstop=3.5)
    cam.keyframe_insert("location", frame=1)
    cam.location = (0.55, -7.4, 1.05)
    cam.keyframe_insert("location", frame=72)
