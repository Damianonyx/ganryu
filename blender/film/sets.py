"""
Environments for the opening film: village, gate, house interior and cellar,
ruins, training field, and the fortress cliff. Everything is procedural.

Animation helpers here are deterministic (no particle simulation caches):
falling or rising fields loop with an F-curve cycle modifier, and flame
noise / light flicker are keyframed with noise modifiers. Any frame can be
rendered on its own.
"""

from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector

from lib import (
    MeshBuilder,
    box,
    ellipsoid,
    emission,
    flame_material,
    ground,
    house,
    light,
    pine,
    principled,
    spike,
    tube,
    volume_box,
    world,
)

FPS = 24


# ------------------------------------------------------------ animation


def linear_forever(ob, path, index, f0, v0, f1, v1):
    """Key two values and extend linearly in both directions."""
    seq = getattr(ob, path)
    seq[index] = v0
    ob.keyframe_insert(path, index=index, frame=f0)
    seq[index] = v1
    ob.keyframe_insert(path, index=index, frame=f1)
    fc = _fcurve(ob, path, index)
    if fc:
        fc.extrapolation = "LINEAR"
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


def cycle_forever(ob, path, index, f0, v0, f1, v1):
    """Linear ramp that repeats (sawtooth) — for looping drift fields."""
    linear_forever(ob, path, index, f0, v0, f1, v1)
    fc = _fcurve(ob, path, index)
    if fc:
        fc.extrapolation = "CONSTANT"
        fc.modifiers.new("CYCLES")


def add_noise(ob, path, index, strength, scale=6.0, phase=0.0):
    fc = _fcurve(ob, path, index)
    if fc is None:
        ob.keyframe_insert(path, index=index, frame=1)
        fc = _fcurve(ob, path, index)
    m = fc.modifiers.new("NOISE")
    m.strength = strength
    m.scale = scale
    m.phase = phase


def _fcurve(ob, path, index):
    ad = ob.animation_data
    if not ad or not ad.action:
        return None
    act = ad.action
    fcs = getattr(act, "fcurves", None)
    if fcs is not None:
        return fcs.find(path, index=index)
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                fc = bag.fcurves.find(path, index=index)
                if fc:
                    return fc
    return None


def flicker_light(ob, strength=0.35, scale=3.0, phase=0.0):
    e = ob.data.energy
    ob.data.keyframe_insert("energy", frame=1)
    fc = None
    ad = ob.data.animation_data
    if ad and ad.action:
        fcs = getattr(ad.action, "fcurves", None)
        if fcs is not None:
            fc = fcs.find("energy")
        else:
            for layer in ad.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        fc = fc or bag.fcurves.find("energy")
    if fc:
        m = fc.modifiers.new("NOISE")
        m.strength = e * strength
        m.scale = scale
        m.phase = phase


def nolight_shadow(ob):
    try:
        ob.data.use_shadow = False
    except AttributeError:
        pass
    return ob


def animated_flame(name, loc, width, height, rot_z=0.0, strength=10.0, seed=0.0, speed=1.0):
    """Flame sheet whose noise scrolls upward over time."""
    me = bpy.data.meshes.new(name)
    w = width / 2
    me.from_pydata([(-w, 0, 0), (w, 0, 0), (w, 0, height), (-w, 0, height)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (0, 0, rot_z)
    mat = flame_material(name + "Mat", strength, seed)
    me.materials.append(mat)
    mapping = next(n for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeMapping")
    sock = mapping.inputs["Location"]
    sock.default_value[2] = 0.0
    sock.keyframe_insert("default_value", index=2, frame=0)
    sock.default_value[2] = -2.2 * speed
    sock.keyframe_insert("default_value", index=2, frame=48)
    sock.default_value[0] = seed
    sock.keyframe_insert("default_value", index=0, frame=0)
    sock.default_value[0] = seed + 0.6 * speed
    sock.keyframe_insert("default_value", index=0, frame=48)
    act = mat.node_tree.animation_data.action
    fcs = getattr(act, "fcurves", None)
    curves = list(fcs) if fcs is not None else [fc for l in act.layers for s in l.strips for b in s.channelbags for fc in b.fcurves]
    for fc in curves:
        fc.extrapolation = "LINEAR"
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    try:
        ob.visible_shadow = False
    except AttributeError:
        pass
    return ob


def drift_field(name, kind, center, size, count, speed=1.0, seed=1, mat=None):
    """Looping field of rain, snow, ash, embers, petals, or leaves.

    Two stacked copies of a particle block move together with a cycle
    modifier, so coverage is seamless and every frame is deterministic.
    """
    rnd = random.Random(seed)
    cx, cy, cz = center
    sx, sy, sz = size
    mb = MeshBuilder()
    for _ in range(count):
        p = Vector((rnd.uniform(-sx / 2, sx / 2), rnd.uniform(-sy / 2, sy / 2), rnd.uniform(0, sz)))
        if kind == "rain":
            mb.add(*box(p, (0.004, 0.004, 0.35)))
        elif kind in ("snow", "ash"):
            r = rnd.uniform(0.008, 0.02) if kind == "snow" else rnd.uniform(0.005, 0.012)
            mb.add(*ellipsoid(p, (r, r, r), seg=4, rings=3))
        elif kind == "ember":
            r = rnd.uniform(0.006, 0.016)
            mb.add(*box(p, (r, r, r * 2.2), rot_z=rnd.uniform(0, 3)))
        else:  # petals / leaves
            r = rnd.uniform(0.02, 0.035)
            mb.add(*box(p, (r, r * 0.6, 0.003), rot_z=rnd.uniform(0, 3)))
    if mat is None:
        mat = {
            "rain": principled("RainMat", (0.7, 0.75, 0.85), rough=0.1),
            "snow": principled("SnowFlake", (0.95, 0.96, 1.0), rough=0.6),
            "ash": principled("AshFlake", (0.5, 0.48, 0.46), rough=0.9),
            "ember": emission("EmberMat", (1.0, 0.42, 0.08), 18),
            "petal": principled("PetalMat", (0.95, 0.72, 0.78), rough=0.6),
            "leaf": principled("LeafMat", (0.6, 0.22, 0.05), rough=0.7),
        }[kind]
    up = kind == "ember"
    period = {"rain": 0.4, "snow": 6.0, "ash": 9.0, "ember": 3.5, "petal": 7.0, "leaf": 5.0}[kind] / speed
    frames = max(2, int(period * FPS))
    obs = []
    for k in range(2):
        ob = mb.build(f"{name}{k}", mat)
        try:
            ob.visible_shadow = False
        except AttributeError:
            pass
        z0 = cz + (k * sz if not up else -k * sz)
        ob.location = (cx, cy, z0)
        drift = sz if up else -sz
        cycle_forever(ob, "location", 2, 0, z0, frames, z0 + drift)
        if kind in ("snow", "petal", "leaf", "ash"):
            cycle_forever(ob, "location", 0, 0, cx, frames, cx + sx * 0.08)
        obs.append(ob)
    return obs


# ---------------------------------------------------------------- sets


def mountains(far_mat=None):
    from shots_util import rock

    far_mat = far_mat or principled("MountainFar", (0.07, 0.065, 0.09), rough=0.95)
    rock("RidgeA", (-140, 300, -10), (160, 60, 80), far_mat, strength=0.25)
    rock("RidgeB", (160, 330, -10), (170, 70, 95), far_mat, strength=0.25)
    rock("RidgeC", (0, 430, -20), (260, 80, 130), far_mat, strength=0.22)


def village(state="evening", rnd=None, lane_len=46, gate=True):
    """The mountain village lane. state: 'evening' | 'night' | 'dawn'.

    Returns a dict of useful anchors: family house door, lantern positions, gate.
    """
    rnd = rnd or random.Random(21)
    info = {"lanterns": [], "houses": []}
    if state == "evening":
        world((1.0, 0.5, 0.28), 0.85, top=(0.05, 0.05, 0.14))
        sun = light("SUN", (0, 0, 10), 1.4, (1.0, 0.55, 0.35), size=math.radians(4), name="Sun")
        sun.rotation_euler = (math.radians(80), 0, math.radians(200))
        gmat = principled("Earth", (0.09, 0.07, 0.055), rough=0.9)
    elif state == "night":
        world((0.02, 0.015, 0.02), 1.0, top=(0.004, 0.005, 0.012))
        moon = light("SUN", (0, 0, 10), 0.25, (0.5, 0.6, 1.0), size=math.radians(2), name="Moon")
        moon.rotation_euler = (math.radians(60), 0, math.radians(150))
        gmat = principled("EarthNight", (0.045, 0.035, 0.03), rough=0.75)
    else:  # dawn
        world((0.62, 0.62, 0.64), 0.9, top=(0.28, 0.3, 0.34))
        sun = light("SUN", (0, 0, 10), 0.8, (0.85, 0.85, 0.9), size=math.radians(8), name="DawnSun")
        sun.rotation_euler = (math.radians(70), 0, math.radians(120))
        gmat = principled("Ash", (0.16, 0.155, 0.15), rough=0.95)
    ground(260, gmat, noise=0.05, res=100)
    mountains()

    if state == "dawn":
        return info

    wall = principled("Plaster", (0.42, 0.34, 0.26), rough=0.9)
    roof = principled("Thatch", (0.06, 0.045, 0.035), rough=0.85)
    wood = principled("Timber", (0.07, 0.04, 0.025), rough=0.7)
    walls, roofs, posts, shoji = MeshBuilder(), MeshBuilder(), MeshBuilder(), MeshBuilder()
    lantern_mb = MeshBuilder()
    for side in (-1, 1):
        for i in range(5):
            x = side * (7.5 + rnd.uniform(-0.5, 0.5))
            y = 4 + i * 9 + rnd.uniform(-0.8, 0.8)
            house(walls, roofs, posts, (x, y, 0), 6.0, 5.0, 2.8, rot_z=math.pi / 2)
            info["houses"].append((side, x, y))
            fx = x - side * 2.5
            for dy in (-1.3, 1.3):
                shoji.add(*box((fx - side * 0.03, y + dy, 1.05), (0.02, 1.9, 1.9)))
                for k in range(5):
                    posts.add(*box((fx - side * 0.06, y + dy - 0.95 + k * 0.475, 1.05), (0.04, 0.05, 1.95)))
                for k in range(4):
                    posts.add(*box((fx - side * 0.06, y + dy, 0.1 + k * 0.63), (0.04, 1.95, 0.05)))
            lp = Vector((x - side * 3.2, y - 2.0, 2.3))
            info["lanterns"].append(lp)
            posts.add(*tube(lp + Vector((0, 0, 0.25)), lp + Vector((0, 0, 0.6)), 0.01, 0.01, 4))
            lantern_mb.add(*ellipsoid(lp, (0.17, 0.17, 0.24), seg=10, rings=6))
    walls.build("Walls", wall)
    roofs.build("Roofs", roof)
    shoji.build("Shoji", emission("ShojiGlow", (1.0, 0.62, 0.32), 2.0 if state == "evening" else 1.2))
    lantern_mat = emission("LanternPaper", (1.0, 0.45, 0.16), 7)
    info["lantern_obj"] = lantern_mb.build("Lanterns", lantern_mat)
    for i, lp in enumerate(info["lanterns"]):
        lt = nolight_shadow(light("POINT", lp, 40, (1.0, 0.55, 0.22), size=0.25, name=f"Lantern{i}"))
        flicker_light(lt, 0.15, 2.0, i)

    trees = MeshBuilder()
    for _ in range(70):
        x = rnd.choice((-1, 1)) * rnd.uniform(13, 50)
        pine(trees, (x, rnd.uniform(-5, 95), 0), rnd.uniform(8, 15), rnd)
    for _ in range(40):
        pine(trees, (rnd.uniform(-14, 14), rnd.uniform(60, 90), 0), rnd.uniform(9, 16), rnd)
    trees.build("Pines", principled("PineDark", (0.02, 0.025, 0.02), rough=0.9))

    if gate:
        gy = lane_len + 2
        gm = MeshBuilder()
        for sx in (-1, 1):
            gm.add(*box((sx * 3.2, gy, 2.7), (0.42, 0.42, 5.4)))
        gm.add(*box((0, gy, 5.55), (8.2, 0.5, 0.32)))
        gm.add(*box((0, gy, 4.55), (7.0, 0.3, 0.26)))
        info["gate_posts"] = gm.build("GatePosts", wood)
        doors = MeshBuilder()
        for sx in (-1, 1):
            for k in range(6):
                doors.add(*box((sx * (0.3 + k * 0.5), gy, 1.7), (0.42, 0.18, 3.4)))
        info["gate_doors"] = doors.build("GateDoors", principled("GateWood", (0.06, 0.035, 0.025), rough=0.75))
        info["gate_y"] = gy
        # bell tower beside the gate
        bt = MeshBuilder()
        bx, by = 6.0, gy - 3
        for sx in (-1, 1):
            bt.add(*box((bx + sx * 0.8, by, 2.6), (0.22, 0.22, 5.2)))
        bt.add(*box((bx, by, 5.3), (2.4, 1.0, 0.25)))
        bt.build("BellTower", wood)
        info["bell_pos"] = Vector((bx, by, 4.6))
    posts.build("Posts", wood)
    if state == "evening":
        volume_box("EveningHaze", (0, 60, 10), (160, 150, 22), density=0.005, color=(1.0, 0.8, 0.7), anisotropy=0.5)
    return info


def bell(loc, swing_frames=()):
    """Temple bell hanging at loc; swings on the given frames."""
    b = MeshBuilder()
    b.add(*tube((0, 0, -0.05), (0, 0, -0.85), 0.32, 0.42, 16))
    b.add(*ellipsoid((0, 0, -0.08), (0.32, 0.32, 0.18), seg=16, rings=6))
    ob = b.build("Bell", principled("Bronze", (0.32, 0.2, 0.1), rough=0.35, metal=1.0), smooth=True)
    ob.location = loc
    ob.rotation_mode = "XYZ"
    ob.rotation_euler = (0, 0, 0)
    ob.keyframe_insert("rotation_euler", index=0, frame=1)
    for f in swing_frames:
        for df, a in ((0, 0), (5, 18), (12, -14), (19, 9), (27, -4), (36, 0)):
            ob.rotation_euler.x = math.radians(a)
            ob.keyframe_insert("rotation_euler", index=0, frame=f + df)
    return ob


def interior(fire=0.0, door_open=False):
    """Family home interior: floor with a cellar hatch, shoji walls, door at -Y.

    Floor is at z=0; the cellar (stone) occupies z∈[-1.3, 0] under the hatch
    at (0, 0). Returns anchors including the hatch lid object.
    """
    info = {}
    world((0.01, 0.008, 0.007), 1.0)
    wood = principled("FloorWood", (0.09, 0.055, 0.035), rough=0.6)
    dark = principled("DarkWood", (0.05, 0.03, 0.02), rough=0.7)
    stone = principled("Stone", (0.08, 0.075, 0.07), rough=0.9)
    paper = principled("ShojiPaper", (0.55, 0.45, 0.32), rough=0.9, emit=(1.0, 0.6, 0.3), emit_strength=0.15)
    floor = MeshBuilder()
    W, D = 7.0, 6.0
    hole = (0.45, 0.45)  # half size of the hatch opening
    # planks along X, skipping the hatch opening
    y = -D / 2
    while y < D / 2:
        if abs(y + 0.12) < hole[1] + 0.12 and True:
            floor.add(*box(((-W / 2 - hole[0]) / 2, y + 0.12, -0.04), (W / 2 - hole[0], 0.23, 0.08)))
            floor.add(*box(((W / 2 + hole[0]) / 2, y + 0.12, -0.04), (W / 2 - hole[0], 0.23, 0.08)))
        else:
            floor.add(*box((0, y + 0.12, -0.04), (W, 0.23, 0.08)))
        y += 0.25
    floor.build("Floor", wood)
    # cellar
    cel = MeshBuilder()
    cel.add(*box((0, 0, -1.35), (1.4, 1.4, 0.1)))
    for sx in (-1, 1):
        cel.add(*box((sx * 0.7, 0, -0.68), (0.1, 1.4, 1.3)))
        cel.add(*box((0, sx * 0.7, -0.68), (1.4, 0.1, 1.3)))
    cel.build("Cellar", stone)
    # vent in the cellar wall (+X), with light and bars
    info["vent"] = Vector((0.66, 0.25, -0.35))
    # hatch lid hinged on its back (+Y) edge: rotating the pivot about +X
    # lifts the front edge, so a nearly closed lid leaves a slit facing the door
    lid_pivot = bpy.data.objects.new("HatchPivot", None)
    bpy.context.collection.objects.link(lid_pivot)
    lid_pivot.location = (0, hole[1], 0.0)
    lid = MeshBuilder()
    for k in range(4):
        lid.add(*box((0, -0.115 - k * 0.225, -0.04), (hole[0] * 2 - 0.02, 0.215, 0.07)))
    lid_ob = lid.build("HatchLid", dark)
    lid_ob.parent = lid_pivot
    lid_pivot.rotation_mode = "XYZ"
    info["hatch"] = lid_pivot
    # walls: back wall shoji (+Y), side walls, front wall with the door (-Y)
    walls = MeshBuilder()
    for sx in (-1, 1):
        walls.add(*box((sx * W / 2, 0, 1.4), (0.12, D, 2.8)))
    walls.add(*box((0, D / 2, 1.4), (W, 0.12, 2.8)))
    walls.add(*box((-2.3, -D / 2, 1.4), (2.4, 0.12, 2.8)))
    walls.add(*box((2.3, -D / 2, 1.4), (2.4, 0.12, 2.8)))
    walls.add(*box((0, -D / 2, 2.5), (2.2, 0.12, 0.6)))
    walls.build("Walls", dark)
    sh = MeshBuilder()
    for k in range(6):
        sh.add(*box((-2.6 + k * 1.05, D / 2 - 0.08, 1.2), (0.95, 0.02, 1.9)))
    sh.build("ShojiBack", paper)
    beams = MeshBuilder()
    for k in range(5):
        beams.add(*box((0, -D / 2 + 0.6 + k * 1.2, 2.85), (W, 0.2, 0.22)))
    info["beams"] = beams.build("Beams", dark)
    # the door (two panels) in the front wall opening at x∈[-1.1, 1.1]
    door = MeshBuilder()
    door.add(*box((0, 0, 1.1), (2.1, 0.08, 2.2)))
    info["door"] = door.build("Door", principled("DoorWood", (0.12, 0.07, 0.04), rough=0.7))
    info["door"].location = (0, -D / 2, 0)
    # warm oil lamp (the one shadow-casting light), soft room fill, and firelight
    lamp = light("POINT", (2.4, 1.8, 1.1), 140, (1.0, 0.6, 0.3), size=0.15, name="OilLamp")
    nolight_shadow(light("AREA", (0, 0, 2.6), 60, (1.0, 0.7, 0.45), size=4, target=(0, 0, 0), name="RoomFill"))
    if fire > 0:
        fg = nolight_shadow(light("AREA", (-2.8, -1.5, 1.6), 400 * fire, (1.0, 0.4, 0.12), size=2, target=(0, 0, 0.8), name="FireGlow"))
        flicker_light(fg, 0.3, 2.0)
    flicker_light(lamp, 0.12, 3.0)
    lp = MeshBuilder()
    lp.add(*ellipsoid((2.4, 1.8, 1.1), (0.08, 0.08, 0.12), seg=8, rings=5))
    lp.build("Lamp", emission("LampGlow", (1.0, 0.6, 0.3), 12))
    info["W"], info["D"] = W, D
    return info


def ruins(rnd=None):
    """Burnt village at dawn: charred posts, collapsed roofs, smoke wisps."""
    rnd = rnd or random.Random(9)
    info = village("dawn")
    char = principled("Char", (0.025, 0.022, 0.02), rough=0.85)
    mb = MeshBuilder()
    for side in (-1, 1):
        for i in range(5):
            x = side * 7.5
            y = 4 + i * 9
            for k in range(5):
                h = rnd.uniform(0.6, 2.6)
                p = Vector((x + rnd.uniform(-2.5, 2.5), y + rnd.uniform(-2.5, 2.5), 0))
                mb.add(*tube(p, p + Vector((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), h)), 0.09, 0.06, 6))
            for k in range(7):
                p = Vector((x + rnd.uniform(-3, 3), y + rnd.uniform(-3, 3), 0.08))
                mb.add(*box(p, (rnd.uniform(1.5, 3.2), 0.18, 0.16), rot_z=rnd.uniform(0, 3.1)))
    mb.build("Charred", char)
    trees = MeshBuilder()
    for _ in range(60):
        x = rnd.choice((-1, 1)) * rnd.uniform(13, 50)
        pine(trees, (x, rnd.uniform(-5, 95), 0), rnd.uniform(8, 15), rnd)
    trees.build("PinesDawn", principled("PineGray", (0.06, 0.065, 0.065), rough=0.9))
    volume_box("DawnMist", (0, 40, 4), (120, 120, 10), density=0.02, color=(0.85, 0.86, 0.9), anisotropy=0.2)
    return info


def training_field(season="gray"):
    """Open hillside with the dead tree he trains beside."""
    sky = {
        "gray": ((0.6, 0.6, 0.62), (0.3, 0.32, 0.36)),
        "rain": ((0.3, 0.33, 0.38), (0.12, 0.14, 0.17)),
        "autumn": ((0.95, 0.5, 0.22), (0.25, 0.15, 0.2)),
        "winter": ((0.82, 0.86, 0.92), (0.45, 0.52, 0.62)),
        "spring": ((0.95, 0.85, 0.82), (0.45, 0.6, 0.75)),
        "dusk": ((0.9, 0.38, 0.22), (0.05, 0.06, 0.14)),
    }[season]
    world(sky[0], 0.85, top=sky[1])
    sun = light("SUN", (0, 0, 10), {"rain": 0.3, "winter": 1.0, "dusk": 1.4}.get(season, 1.1), (1.0, 0.85, 0.7) if season != "winter" else (0.9, 0.95, 1.0), size=math.radians(5), name="FieldSun")
    sun.rotation_euler = (math.radians(65 if season != "dusk" else 82), 0, math.radians(210))
    gcol = {"gray": (0.12, 0.13, 0.1), "rain": (0.06, 0.08, 0.07), "autumn": (0.2, 0.11, 0.05), "winter": (0.8, 0.82, 0.86), "spring": (0.12, 0.2, 0.08), "dusk": (0.05, 0.04, 0.04)}[season]
    ground(200, principled(f"Field{season}", gcol, rough=0.9 if season != "rain" else 0.35), noise=0.08, res=80)
    mountains(principled(f"Mtn{season}", tuple(c * 0.5 for c in sky[0]), rough=0.95))
    tree = MeshBuilder()
    tree.add(*tube((3.5, 4, 0), (3.3, 4.2, 3.2), 0.28, 0.16, 8))
    tree.add(*tube((3.3, 4.2, 2.4), (4.6, 4.4, 4.0), 0.12, 0.04, 6))
    tree.add(*tube((3.3, 4.2, 2.8), (2.2, 4.0, 4.3), 0.1, 0.03, 6))
    tree.add(*tube((3.3, 4.2, 3.2), (3.6, 4.6, 4.8), 0.08, 0.02, 6))
    tree.build("DeadTree", principled("DeadWood", (0.05, 0.04, 0.035), rough=0.9))
    post = MeshBuilder()
    post.add(*tube((1.2, 0.6, 0), (1.2, 0.6, 1.5), 0.11, 0.1, 8))
    post.build("TrainingPost", principled("PostWood", (0.18, 0.11, 0.06), rough=0.8))
    if season == "rain":
        drift_field("Rain", "rain", (0, 0, 0), (14, 14, 8), 2500, speed=1.0)
    elif season == "winter":
        drift_field("Snow", "snow", (0, 0, 0), (12, 12, 6), 1800)
    elif season == "spring":
        drift_field("Petals", "petal", (0, 0, 0), (12, 12, 5), 400)
    elif season == "autumn":
        drift_field("Leaves", "leaf", (0, 0, 0), (12, 12, 5), 300)
    return {"post": Vector((1.2, 0.6, 0)), "tree": Vector((3.5, 4, 0))}
