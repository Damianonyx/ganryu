"""
Shot 8b — "Across the valley, an enemy fortress rises above the clouds. He draws his blade."

The adult protagonist (placeholder silhouette) stands on a cliff edge at dusk.
Animated over 48 frames: he draws the blade; clouds drift.
"""

import math
import random

import bpy
from mathutils import Vector

from characters import protagonist_silhouette
from lib import MeshBuilder, box, camera, emission, house, light, principled, tube, volume_box, world

SAMPLES = 96
STILL_FRAME = 40


def _rock(name, loc, size, mat, seed, detail=4, strength=0.2, scale=1.0):
    """Displaced ico-sphere. `strength` is in local (pre-scale) units."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail, radius=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    tex = bpy.data.textures.new(name + "Tex", "CLOUDS")
    tex.noise_scale = 0.6 * scale
    tex.noise_depth = 4
    mod = ob.modifiers.new("Displace", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.texture_coords = "GLOBAL" if False else "LOCAL"
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ob


def build():
    rnd = random.Random(5)
    world((0.9, 0.36, 0.2), 0.7, top=(0.02, 0.03, 0.08))
    light("SUN", (0, 0, 10), 2.2, (1.0, 0.55, 0.32), size=math.radians(3), name="Sun").rotation_euler = (math.radians(84), 0, math.radians(180 + 12))

    rock = principled("Rock", (0.05, 0.045, 0.05), rough=0.85)
    far_rock = principled("FarRock", (0.07, 0.05, 0.07), rough=0.9)

    # --- the fortress peak and neighbouring summits rising through the clouds
    _rock("Peak", (-55, 300, -30), (55, 55, 95), far_rock, 1, detail=5, strength=0.28, scale=0.5)
    _rock("PeakL", (-190, 380, -40), (80, 60, 70), far_rock, 2, detail=4, strength=0.3)
    _rock("PeakR", (140, 420, -40), (90, 70, 85), far_rock, 3, detail=4, strength=0.3)

    # castle on the summit: three tiers with flared roofs, lit windows, banners
    wall = principled("CastleWall", (0.06, 0.05, 0.06), rough=0.8)
    roof = principled("CastleRoof", (0.02, 0.02, 0.025), rough=0.5)
    wood = principled("CastleWood", (0.03, 0.02, 0.02), rough=0.7)
    walls, roofs, posts = MeshBuilder(), MeshBuilder(), MeshBuilder()
    base = Vector((-55, 300, 58))
    for i, (w, d, h) in enumerate(((34, 26, 9), (24, 18, 8), (15, 12, 7), (8, 7, 6))):
        z = base.z + sum((9, 8, 7, 6)[:i]) + i * 3.5
        house(walls, roofs, posts, (base.x, base.y, z), w, d, h)
    walls.build("CastleWalls", wall)
    roofs.build("CastleRoofs", roof)
    posts.build("CastlePosts", wood)
    win = MeshBuilder()
    for i in range(16):
        tier = i % 3
        z = base.z + 3 + tier * 12.5
        x = base.x + rnd.uniform(-12, 12) * (1 - tier * 0.3)
        win.add(*box((x, base.y - (13 - tier * 4) - 0.2, z), (1.2, 0.3, 1.6)))
    win.build("CastleWindows", emission("Window", (1.0, 0.25, 0.05), 25))
    banner = principled("Banner", (0.4, 0.02, 0.03), rough=0.7, emit=(0.6, 0.02, 0.02), emit_strength=0.3)
    bans = MeshBuilder()
    for sx in (-1, 1):
        p = Vector((base.x + sx * 19, base.y - 10, base.z + 2))
        bans.add(*tube(p, p + Vector((0, 0, 22)), 0.25, 0.2, 5))
        bans.add(*box(p + Vector((sx * 1.6, 0, 16)), (3.0, 0.2, 9.0)))
    bans.build("Banners", banner)
    light("POINT", (base.x, base.y - 20, base.z + 10), 9000, (1.0, 0.3, 0.08), size=8, name="CastleGlow")

    # low sun glowing through the haze behind the fortress
    sun = MeshBuilder()
    from lib import ellipsoid
    sun.add(*ellipsoid((40, 900, 2), (30, 30, 30), seg=24, rings=12))
    sun.build("SunDisc", emission("SunGlow", (1.0, 0.62, 0.35), 9))

    # --- sea of clouds
    volume_box("Clouds", (0, 280, -6), (900, 520, 26), density=0.5, color=(0.95, 0.72, 0.7), anisotropy=0.55, noise_scale=0.035, noise_amount=1.0)
    volume_box("AerialHaze", (0, 300, 50), (900, 480, 110), density=0.0004, color=(0.9, 0.6, 0.55), anisotropy=0.6)

    # --- foreground cliff and the protagonist
    _rock("Cliff", (4.5, 4.0, 3.0), (5.5, 7.0, 7.2), rock, 4, detail=5, strength=0.18, scale=1.5)
    top = Vector((3.4, 1.2, 10.05))
    hero = MeshBuilder()
    hand, tip = protagonist_silhouette(hero, top, height=1.8, facing=math.radians(12), draw=0.85)
    hero.build("Protagonist", principled("HeroCloth", (0.015, 0.014, 0.016), rough=0.7))
    steel = principled("Steel", (0.8, 0.8, 0.82), rough=0.12, metal=1.0)
    blade = MeshBuilder()
    blade.add(*tube(hand, tip, 0.018, 0.006, 6))
    blade.build("Katana", steel)
    light("POINT", tip.lerp(hand, 0.3) + Vector((0.2, -0.4, 0.2)), 8, (1.0, 0.8, 0.6), size=0.1, name="Glint")

    cam = camera((6.6, -6.2, 11.9), (-38, 300, 40), lens=30, dof_dist=7.4, fstop=8)
    cam.keyframe_insert("location", frame=1)
    cam.location = (6.4, -5.6, 11.95)
    cam.keyframe_insert("location", frame=48)
