"""
Shot builders for the opening film.

Each function builds one shot into a fresh scene and animates it in local
frames starting at 1. Timing, order, and fades live in film.py; the
dialogue/subtitle timing source of truth is src/cinematic/script.ts.
"""

from __future__ import annotations

import math
import random

import bpy
from mathutils import Vector

import cast
import sets
from lib import MeshBuilder, box, camera, ellipsoid, emission, light, principled, tube, volume_box, world
from sets import animated_flame, drift_field, flicker_light, nolight_shadow
from shots_util import cam_path, shake

V = Vector


def key_energy(ob, frame, value):
    ob.data.energy = value
    ob.data.keyframe_insert("energy", frame=frame)


def key_vis(ob, frame, visible):
    ob.hide_render = not visible
    ob.keyframe_insert("hide_render", frame=frame)


# ============================================================ 1. BEFORE

FAMILY_DOOR = V((-5.0, 4.4, 0))
PRACTICE = V((-1.6, 4.2, 0))


def s01_village_wide():
    sets.village("evening")
    ch = cast.child(loc=PRACTICE, yaw=90)
    fa = cast.father(loc=(0.3, 4.4, 0), yaw=-90)
    for f in range(1, 83, 24):
        ch.pose(f, shoulder_r=(150, 10), shoulder_l=(140, -10), elbow_r=20, elbow_l=20)
        ch.pose(f + 12, shoulder_r=(40, 10), shoulder_l=(35, -10), elbow_r=10, elbow_l=10, spine=12)
    fa.pose(1, shoulder_l=(10, 8), shoulder_r=(10, 8))
    drift_field("Motes", "ember", (0, 10, 0), (12, 20, 4), 40, speed=0.25, mat=emission("Mote", (1.0, 0.75, 0.35), 8))
    cam = camera((1.6, -16, 8.5), (-0.8, 8, 1.2), lens=30, dof_dist=19, fstop=5.6)
    cam_path(cam, [(1, (1.6, -16, 8.5), (-0.8, 8, 1.2), None), (82, (1.2, -9.0, 3.0), (-0.9, 6, 1.1), None)])
    return 82


def s02_practice():
    sets.village("evening")
    ch = cast.child(loc=PRACTICE, yaw=90)
    fa = cast.father(loc=(0.4, 4.4, 0), yaw=-90)
    # child: raise, swing, overbalance, caught, straighten, feet adjusted
    ch.pose(1, shoulder_r=(155, 10), shoulder_l=(145, -10), elbow_r=25, elbow_l=25, spine=-4)
    ch.pose(10, shoulder_r=(160, 10), shoulder_l=(150, -10), elbow_r=30, elbow_l=30, spine=-8)
    ch.pose(18, shoulder_r=(35, 10), shoulder_l=(30, -10), elbow_r=5, elbow_l=5, spine=22, thigh_r=(-20,), knee_r=-10)
    ch.pose(26, loc=tuple(PRACTICE + V((0.22, 0, 0))), spine=(38, 0, 8), thigh_r=(-5,), thigh_l=(42,), knee_l=-25, shoulder_r=(20, 25), shoulder_l=(40, -30))
    ch.pose(36, loc=tuple(PRACTICE + V((0.26, 0, 0))), spine=(14, 0, 0), thigh_l=(20,), knee_l=-10, shoulder_r=(70, 10), shoulder_l=(60, -10))
    ch.pose(50, loc=tuple(PRACTICE + V((0.2, 0, 0))), spine=(4, 0, 0), thigh_l=(0,), thigh_r=(0,), knee_l=0, shoulder_r=(110, 10), shoulder_l=(100, -10), elbow_r=20, elbow_l=20)
    ch.pose(70, thigh_l=(14, 14), thigh_r=(-10, 14), knee_l=-8, knee_r=-8, drop=0.03)
    ch.pose(82, thigh_l=(14, 15), thigh_r=(-10, 15), shoulder_r=(140, 10), shoulder_l=(130, -10))
    # father: watches, steps in, catches, kneels and sets the feet
    fa.pose(1, shoulder_l=(8, 8), shoulder_r=(8, 8), neck=(10, 0, 0))
    fa.walk(16, 30, (0.4, 4.4, 0), (-0.85, 4.4, 0), cycle=14, stride=26)
    fa.pose(26, shoulder_r=(75, 20), elbow_r=20, spine=12)
    fa.pose(34, shoulder_r=(70, 25), elbow_r=35, shoulder_l=(55, 10), elbow_l=30, spine=18)
    fa.pose(46, shoulder_r=(40, 15), elbow_r=20, spine=10)
    fa.pose(58, drop=0.55, thigh_l=(85,), knee_l=-95, thigh_r=(-5,), knee_r=-120, spine=30, shoulder_r=(60, 10), shoulder_l=(55, 10), elbow_r=20, elbow_l=20, neck=(25, 0, 0))
    fa.pose(70, shoulder_r=(70, 25), shoulder_l=(68, 20), elbow_r=10, elbow_l=10)
    fa.pose(82, shoulder_r=(60, 20), shoulder_l=(60, 15), neck=(5, 0, 0), spine=22)
    cam = camera((-0.4, -1.7, 1.15), (-0.75, 4.3, 0.75), lens=42, dof_dist=6.2, fstop=2.8)
    cam_path(cam, [(1, (-0.4, -1.7, 1.15), (-0.75, 4.3, 0.75), None), (82, (-0.55, -1.2, 1.0), (-0.8, 4.3, 0.7), None)])
    return 82


def s03_mother_calls():
    sets.village("evening")
    mo = cast.mother(loc=FAMILY_DOOR + V((0, 0.2, 0)), yaw=90)
    ch = cast.child(loc=PRACTICE + V((0.2, 0, 0)), yaw=-90)
    fa = cast.father(loc=(-0.85, 4.4, 0), yaw=-90)
    for i, f in enumerate(range(1, 54, 8)):
        mo.pose(f, shoulder_r=(150, 25), elbow_r=(40 if i % 2 else 10, 0, 0))
    ch.walk(6, 50, PRACTICE + V((0.2, 0, 0)), FAMILY_DOOR + V((1.0, 0.1, 0)), cycle=10, stride=34, run=True)
    fa.walk(16, 53, (-0.85, 4.4, 0), (-2.6, 4.6, 0), cycle=22)
    cam = camera((1.4, 0.6, 1.5), (-4.0, 4.8, 1.1), lens=36, dof_dist=6.5, fstop=3.5)
    cam_path(cam, [(1, (1.4, 0.6, 1.5), (-3.5, 4.8, 1.0), None), (53, (0.8, 1.0, 1.45), (-4.3, 4.7, 1.1), None)])
    return 53


# ============================================================ 2. THE ATTACK


def s04a_bell():
    info = sets.village("evening")
    bp = info["bell_pos"]
    sets.bell(bp, swing_frames=(2,))
    cam = camera(bp + V((-2.4, -3.6, -2.6)), bp + V((0, 0, -0.4)), lens=45, dof_dist=5, fstop=2.8)
    cam_path(cam, [(1, bp + V((-2.4, -3.6, -2.6)), bp + V((0, 0, -0.4)), None), (29, bp + V((-2.2, -3.3, -2.5)), bp + V((0, 0, -0.4)), None)])
    return 29


def s04b_father_turns():
    sets.village("evening")
    fa = cast.father(loc=(-2.6, 4.6, 0), yaw=-96)
    mo = cast.mother(loc=FAMILY_DOOR + V((0.3, 0.3, 0)), yaw=90)
    ch = cast.child(loc=FAMILY_DOOR + V((0.9, -0.2, 0)), yaw=60, sword=False)
    fa.pose(1, neck=(0, 0, 0), shoulder_l=(8, 8), shoulder_r=(8, 8))
    fa.pose(5, neck=(0, 0, -70))
    fa.pose(12, yaw=-170, neck=(-5, 0, -10), shoulder_l=(20, 15), shoulder_r=(20, 15), spine=(0, 0, 0))
    fa.pose(19, yaw=-180, neck=(-8, 0, 0))
    mo.pose(1, shoulder_r=(10, 5))
    mo.pose(12, yaw=150, shoulder_r=(60, 20), elbow_r=30)
    cam = camera((-2.1, 7.2, 1.62), (-2.6, 4.6, 1.55), lens=55, dof_dist=2.7, fstop=2.0)
    cam_path(cam, [(1, (-2.1, 7.2, 1.62), (-2.6, 4.6, 1.55), None), (19, (-2.15, 6.9, 1.62), (-2.6, 4.6, 1.58), None)])
    return 19


def _night_gate(open_doors=True):
    info = sets.village("night")
    gy = info["gate_y"]
    if open_doors:
        d = info["gate_doors"]
        d.location = (0, 0, 0)
        d.scale = (1.0, 1.0, 1.0)
        d.hide_render = True
    volume_box("NightHaze", (0, gy + 20, 5), (80, 60, 12), density=0.02, color=(0.6, 0.55, 0.6), anisotropy=0.35)
    return info, gy


def s05_gate_threat():
    info, gy = _night_gate()
    rnd = random.Random(5)
    torch_m = emission("Torch", (1.0, 0.45, 0.12), 25)
    tm = MeshBuilder()
    for i in range(6):
        x = -2.6 + i * 1.05 + rnd.uniform(-0.2, 0.2)
        y0 = gy + 22 + (i % 2) * 1.5
        f = cast.follower(f"Follower{i}", loc=(x, y0, 0), yaw=0, seed=i)
        f.walk(1, 72, (x, y0, 0), (x * 0.9, gy + 9 + (i % 2) * 1.2, 0), cycle=30, stride=20, arm=10)
        if i % 2 == 0:
            lt = nolight_shadow(light("POINT", (x + 0.3, y0, 2.0), 600, (1.0, 0.45, 0.12), size=0.2, name=f"TorchLight{i}"))
            lt.parent = f.j["wrist_l"]
            lt.location = (0, -0.1, 0.25)
            flicker_light(lt, 0.3, 2.0, i)
            tb = MeshBuilder()
            tb.add(*tube((0, 0, -0.1), (0, -0.05, 0.4), 0.02, 0.02, 5))
            tb.add(*ellipsoid((0, -0.05, 0.45), (0.06, 0.06, 0.12), seg=6, rings=4))
            to = tb.build(f"Torch{i}", torch_m)
            to.parent = f.j["wrist_l"]
            f.pose(1, shoulder_l=(40, 10), elbow_l=60)
    # monsters moving between the trees
    for k, (x0, x1, y) in enumerate(((-14, -7, gy + 38), (13, 8, gy + 44))):
        v = cast.vargash(f"Beast{k}", loc=(x0, y, 0), yaw=90 if x1 > x0 else -90, scale=1.5)
        v.walk(1, 72, (x0, y, 0), (x1, y, 0), cycle=40, stride=18, arm=12)
    glow = nolight_shadow(light("AREA", (0, gy + 55, 6), 30000, (1.0, 0.35, 0.1), size=30, target=(0, gy, 2), name="FarGlow"))
    cam = camera((0.8, gy - 7, 1.5), (0, gy + 14, 2.4), lens=32, dof_dist=20, fstop=4)
    cam_path(cam, [(1, (0.8, gy - 7, 1.5), (0, gy + 14, 2.4), None), (72, (0.6, gy - 4.5, 1.45), (0, gy + 14, 2.5), None)])
    return 72


def s06_arrow_fire():
    info = sets.village("night")
    side, hx, hy = info["houses"][-1]
    lp = V((hx - side * 3.2, hy - 2.0, 2.3))
    # a dedicated lantern that bursts when the arrow hits
    lant = MeshBuilder()
    lant.add(*ellipsoid(lp + V((0, 0, 0.0)), (0.2, 0.2, 0.28), seg=10, rings=6))
    lo = lant.build("HeroLantern", emission("HeroLanternMat", (1.0, 0.45, 0.16), 9))
    key_vis(lo, 1, True)
    key_vis(lo, 11, False)
    llt = nolight_shadow(light("POINT", lp, 60, (1.0, 0.5, 0.2), size=0.2, name="HeroLanternLight"))
    key_energy(llt, 10, 60)
    key_energy(llt, 12, 900)
    key_energy(llt, 20, 300)
    flicker_light(llt, 0.3, 2.0)
    arrow = MeshBuilder()
    arrow.add(*tube((0, 0, 0), (0, 0.7, 0), 0.008, 0.008, 4))
    arrow.add(*box((0, 0.72, 0), (0.03, 0.06, 0.03)))
    ao = arrow.build("Arrow", principled("ArrowWood", (0.4, 0.3, 0.2), rough=0.7))
    start = lp + V((side * 9, -14, 3))
    d = (lp - start).normalized()
    ao.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
    ao.location = start
    ao.keyframe_insert("location", frame=1)
    ao.location = lp - d * 0.7
    ao.keyframe_insert("location", frame=10)
    # flames climbing the eave and roof
    for k in range(6):
        fl = animated_flame(f"RoofFlame{k}", (hx - side * (3.1 - 0.25 * (k % 3)), hy - 2.5 + k * 1.0, 2.6 + 0.25 * (k % 3)), 1.8, 2.4, strength=11, seed=k * 1.7)
        fl.scale = (0.01, 0.01, 0.01)
        fl.keyframe_insert("scale", frame=10 + k * 4)
        fl.scale = (1, 1, 1)
        fl.keyframe_insert("scale", frame=22 + k * 4)
        fl.rotation_euler = (0, 0, math.radians(90))
    fire = nolight_shadow(light("POINT", (hx - side * 2.0, hy, 3.6), 10, (1.0, 0.4, 0.1), size=1.2, name="RoofFire"))
    key_energy(fire, 10, 10)
    key_energy(fire, 48, 2600)
    flicker_light(fire, 0.25, 2.5)
    drift_field("Embers", "ember", (hx - side * 1.5, hy, 2.0), (6, 6, 6), 160, speed=1.0)
    cam = camera(lp + V((-side * 4.2, -5.5, -1.2)), lp + V((side * 0.5, 0.6, 0.4)), lens=34, dof_dist=7, fstop=3.5)
    shake(cam, 11, 19, 0.5)
    return 48


def s07a_gate_breach():
    info, gy = _night_gate(open_doors=False)
    doors = info["gate_doors"]
    doors.rotation_mode = "XYZ"
    doors.keyframe_insert("location", frame=6)
    doors.keyframe_insert("rotation_euler", frame=6)
    doors.location = (0.6, -7, -1.5)
    doors.rotation_euler = (math.radians(-80), 0, math.radians(10))
    doors.keyframe_insert("location", frame=16)
    doors.keyframe_insert("rotation_euler", frame=16)
    v = cast.vargash("BeastBreach", loc=(0, gy + 4, 0), yaw=0, scale=1.5)
    v.pose(1, spine=30, shoulder_l=(120, 30), shoulder_r=(120, 30), thigh_l=(40,), knee_l=-50)
    v.pose(7, loc=(0, gy + 0.5, 0), spine=40, shoulder_l=(80, 40), shoulder_r=(80, 40))
    v.pose(14, loc=(0, gy - 4, 0), spine=10, shoulder_l=(40, 50), shoulder_r=(40, 50), thigh_l=(10,), knee_l=-20, neck=(-30, 0, 0))
    v.pose(29, loc=(0, gy - 5.5, 0), spine=-8, shoulder_l=(70, 70), shoulder_r=(70, 70), neck=(-35, 0, 0), head=(-20, 0, 0))
    for i in range(5):
        side = -1 if i % 2 else 1
        p0 = V((side * rnd_off(i), gy - 8 - i * 1.5, 0))
        vi = cast.villager(f"Villager{i}", loc=tuple(p0), seed=i)
        vi.walk(1 + i, 29, p0, p0 + V((side * 6, -6, 0)), cycle=10, stride=34, run=True)
    impact = nolight_shadow(light("POINT", (0, gy - 1, 2.5), 0, (1.0, 0.5, 0.2), size=1, name="Impact"))
    key_energy(impact, 6, 0)
    key_energy(impact, 7, 4000)
    key_energy(impact, 14, 400)
    cam = camera((1.2, gy - 16, 1.3), (0, gy, 2.6), lens=30, dof_dist=15, fstop=4)
    shake(cam, 7, 20, 1.4)
    return 29


def rnd_off(i):
    return 1.0 + (i * 0.7) % 2.2


def s07b_family_inside():
    info = sets.interior(fire=0.2)
    D = info["D"]
    door = info["door"]
    door.location = (-1.0, -D / 2 - 0.9, 0)
    door.rotation_euler = (0, 0, math.radians(-80))
    door.keyframe_insert("location", frame=1)
    door.keyframe_insert("rotation_euler", frame=1)
    door.keyframe_insert("location", frame=11)
    door.keyframe_insert("rotation_euler", frame=11)
    door.location = (0, -D / 2, 0)
    door.rotation_euler = (0, 0, 0)
    door.keyframe_insert("location", frame=17)
    door.keyframe_insert("rotation_euler", frame=17)
    glow = nolight_shadow(light("AREA", (0, -D / 2 - 1.5, 1.5), 700, (1.0, 0.45, 0.15), size=2, target=(0, 0, 1), name="FireOutside"))
    key_energy(glow, 13, 700)
    key_energy(glow, 18, 30)
    fa = cast.father(loc=(0.3, -D / 2 - 1.0, 0))
    mo = cast.mother(loc=(-0.4, -D / 2 - 1.5, 0))
    ch = cast.child(loc=(0.0, -D / 2 - 1.6, 0), sword=False)
    fa.walk(1, 12, (0.3, -D / 2 - 1.0, 0), (0.4, -1.4, 0), cycle=8, stride=36, run=True)
    mo.walk(1, 14, (-0.4, -D / 2 - 1.5, 0), (-0.6, -0.8, 0), cycle=8, stride=30, run=True)
    ch.walk(1, 14, (0.0, -D / 2 - 1.6, 0), (-0.1, -0.6, 0), cycle=7, stride=34, run=True)
    fa.pose(12, yaw=180, shoulder_r=(80, 10), elbow_r=20)
    fa.pose(18, shoulder_r=(40, 10))
    cam = camera((1.8, 1.8, 1.6), (0, -D / 2, 1.1), lens=30, dof_dist=4.5, fstop=3.5)
    shake(cam, 16, 19, 0.6)
    return 19


# ============================================================ 3. THE HIDING PLACE


def s08_hatch_open():
    info = sets.interior(fire=0.3)
    hp = info["hatch"]
    hp.rotation_euler = (0, 0, 0)
    hp.keyframe_insert("rotation_euler", frame=6)
    hp.rotation_euler = (math.radians(-105), 0, 0)
    hp.keyframe_insert("rotation_euler", frame=22)
    fa = cast.father(loc=(0.9, -0.7, 0), yaw=-60)
    fa.pose(1, drop=0.5, thigh_l=(80,), knee_l=-95, knee_r=-120, spine=30, shoulder_r=(60, 10), shoulder_l=(60, 10))
    fa.pose(14, shoulder_r=(110, 10), shoulder_l=(110, 10), elbow_r=10, elbow_l=10, spine=20)
    fa.pose(26, shoulder_r=(30, 10), shoulder_l=(30, 10), spine=10)
    mo = cast.mother(loc=(-0.85, -0.1, 0), yaw=90)
    ch = cast.child(loc=(-0.6, -0.75, 0), yaw=60, sword=False)
    mo.pose(1, spine=10, shoulder_r=(40, 10), shoulder_l=(40, 10))
    mo.pose(26, drop=0.45, spine=45, shoulder_r=(70, 5), shoulder_l=(70, 5), elbow_r=20, elbow_l=20)
    mo.pose(48, spine=60, shoulder_r=(45, 5), shoulder_l=(45, 5))
    mo.pose(72, spine=55)
    ch.pose(1, shoulder_r=(10,), shoulder_l=(10,))
    ch.pose(26, loc=(-0.25, -0.2, 0.15), shoulder_r=(160, 10), shoulder_l=(160, 10), yaw=90)
    ch.pose(48, loc=(0.0, 0.0, -0.8), thigh_l=(20,), knee_l=-30)
    ch.pose(72, loc=(0.0, 0.0, -1.3), thigh_l=(0,), knee_l=0, shoulder_r=(150, 10), shoulder_l=(150, 10))
    cam = camera((2.6, -2.6, 1.8), (0, 0, 0.3), lens=30, dof_dist=3.6, fstop=3.5)
    cam_path(cam, [(1, (2.6, -2.6, 1.8), (0, 0, 0.3), None), (72, (2.2, -2.2, 1.5), (0, 0, 0.0), None)])
    return 72


def _cellar_child(name="Child", pose_up=True):
    ch = cast.child(name, loc=(0.0, 0.05, -1.3), yaw=180 + 20, sword=False)
    return ch


def s09_grip_sleeve():
    info = sets.interior(fire=0.3)
    info["hatch"].rotation_euler = (math.radians(-105), 0, 0)
    top = nolight_shadow(light("AREA", (0, -0.1, 1.4), 450, (1.0, 0.65, 0.35), size=0.8, target=(0, 0, -1.2), name="HatchLight"))
    flicker_light(top, 0.15, 3.0)
    ch = cast.child("Child", loc=(0.05, 0.1, -1.3), yaw=0, sword=False)
    ch.pose(1, neck=(-25, 0, 0), head=(-15, 0, 0), shoulder_r=(160, 0), elbow_r=10, shoulder_l=(30, 5))
    ch.pose(30, shoulder_r=(168, -5), elbow_r=20, neck=(-30, 0, 0))
    ch.pose(62, shoulder_r=(165, -8), elbow_r=25, shoulder_l=(70, 10), elbow_l=40)
    # mother's sleeve and arm reaching down through the hatch
    mo = cast.mother("MotherReach", loc=(0.05, -0.55, -0.05), yaw=0)
    mo.pose(1, drop=0.6, spine=80, neck=(20, 0, 0), shoulder_r=(30, 0), elbow_r=10, shoulder_l=(30, 0))
    mo.pose(62, spine=82, shoulder_r=(25, 0), shoulder_l=(28, 0))
    cam = camera((0.35, -0.6, -0.85), (0.0, 0.1, -0.25), lens=35, dof_dist=0.8, fstop=2.0)
    cam_path(cam, [(1, (0.35, -0.6, -0.85), (0.0, 0.1, -0.25), None), (62, (0.3, -0.5, -0.8), (0.0, 0.1, -0.22), None)])
    return 62


def s10_charm_hand():
    world((0.01, 0.006, 0.004), 1.0)
    warm = light("AREA", (0.2, -0.3, 0.6), 18, (1.0, 0.65, 0.35), size=0.5, target=(0, 0, 0), name="Warm")
    flicker_light(warm, 0.12, 3.0)
    light("AREA", (-0.5, 0.4, 0.3), 3, (0.6, 0.6, 0.9), size=0.6, target=(0, 0, 0), name="Cool")
    bg = MeshBuilder()
    bg.add(*box((0, 0.6, -0.2), (3, 0.05, 2)))
    bg.build("Backdrop", principled("BackStone", (0.05, 0.04, 0.035), rough=0.9))
    kid = cast.Hand("ChildHand", (0, 0, 0), size=0.06, sleeve="indigo")
    kid.place(1, rot=(0, 0, 0))
    kid.curl(1, 0.05)
    kid.curl(30, 0.05)
    kid.curl(52, 0.85)
    kid.curl(72, 0.9)
    mom = cast.Hand("MotherHand", (0.02, 0.05, 0.25), size=0.085, sleeve="rose", flip=-1)
    mom.place(1, loc=(0.03, 0.15, 0.3), rot=(180, 0, 160))
    mom.curl(1, 0.6)
    mom.place(22, loc=(0.01, 0.06, 0.09), rot=(180, 0, 170))
    mom.curl(24, 0.1)
    mom.place(40, loc=(0.0, 0.05, 0.07))
    mom.curl(40, 0.2)
    mom.place(56, loc=(0.0, 0.04, 0.05))
    mom.curl(56, 0.75)
    mom.place(72, loc=(0.0, 0.035, 0.05))
    ch = MeshBuilder()
    cast.charm_object(ch, (0, 0, 0), r=0.024)
    co = ch.build("Charm", cast.mats()["charm"])
    co.rotation_euler = (math.radians(90), 0, 0)
    co.location = (0.02, 0.08, 0.2)
    co.keyframe_insert("location", frame=1)
    co.location = (0.0, 0.045, 0.02)
    co.keyframe_insert("location", frame=24)
    cord = MeshBuilder()
    cord.add(*tube((0, 0, 0.02), (0.0, 0.0, 0.07), 0.002, 0.002, 4))
    cdo = cord.build("CharmCord", cast.mats()["cord"])
    cdo.parent = co
    cam = camera((0.3, -0.42, 0.5), (0.0, 0.05, 0.04), lens=55, dof_dist=0.66, fstop=2.8)
    cam_path(cam, [(1, (0.3, -0.42, 0.5), (0.0, 0.05, 0.06), None), (72, (0.26, -0.36, 0.42), (0.0, 0.05, 0.03), None)])
    return 72


def s11_hatch_close():
    info = sets.interior(fire=0.4)
    hp = info["hatch"]
    hp.rotation_euler = (math.radians(-105), 0, 0)
    hp.keyframe_insert("rotation_euler", frame=1)
    hp.rotation_euler = (math.radians(-8), 0, 0)
    hp.keyframe_insert("rotation_euler", frame=16)
    fa = cast.father(loc=(0.6, -0.9, 0), yaw=0)
    mo = cast.mother(loc=(-0.6, -1.0, 0), yaw=0)
    fa.pose(1, yaw=160)
    fa.pose(24, yaw=0)
    mo.pose(1, yaw=200)
    mo.pose(28, yaw=10)
    cam = camera((0.0, 0.25, -1.05), (0.0, -0.6, 0.6), lens=24, dof_dist=1.4, fstop=4)
    return 34


def _slit_pov(fire=1.0, lid_deg=12.0):
    info = sets.interior(fire=fire)
    info["hatch"].rotation_euler = (math.radians(-lid_deg), 0, 0)
    cam = camera((0.0, -0.27, -0.04), (0.0, -3.0, 1.25), lens=28, dof_dist=2.2, fstop=5.6)
    return info, cam


def s12_door_breaks():
    info, cam = _slit_pov(fire=0.6)
    D = info["D"]
    door = info["door"]
    door.rotation_mode = "XYZ"
    door.keyframe_insert("location", frame=6)
    door.keyframe_insert("rotation_euler", frame=6)
    door.location = (0.3, -D / 2 + 1.9, 0.2)
    door.rotation_euler = (math.radians(-75), math.radians(10), math.radians(12))
    door.keyframe_insert("location", frame=13)
    door.keyframe_insert("rotation_euler", frame=13)
    fa = cast.father(loc=(-0.45, -1.45, 0), yaw=0)
    mo = cast.mother(loc=(0.55, -1.2, 0), yaw=0)
    fa.pose(1, shoulder_l=(10, 8), shoulder_r=(10, 8))
    fa.pose(10, spine=-8, shoulder_r=(30, 30))
    mo.pose(10, spine=-10, shoulder_r=(60, 10), elbow_r=50)
    out = nolight_shadow(light("AREA", (0, -D / 2 - 2.5, 1.6), 0, (1.0, 0.42, 0.12), size=3, target=(0, 0, 1), name="FireDoor"))
    key_energy(out, 6, 0)
    key_energy(out, 8, 2500)
    key_energy(out, 48, 1400)
    flicker_light(out, 0.25, 2.5)
    for i in range(3):
        f = cast.follower(f"DoorFollower{i}", loc=(-1.0 + i, -D / 2 - 1.8, 0), yaw=0, seed=i)
    for k in range(3):
        animated_flame(f"DoorFlame{k}", (-2 + k * 2, -D / 2 - 4, 0), 3, 3.4, strength=10, seed=k)
    shake(cam, 7, 18, 1.0)
    return 48


def s13_nethrak_enters():
    info, cam = _slit_pov(fire=1.0)
    D = info["D"]
    info["door"].hide_render = True
    out = nolight_shadow(light("AREA", (0, -D / 2 - 2.5, 1.6), 1500, (1.0, 0.42, 0.12), size=3, target=(0, 0, 1), name="FireDoor"))
    flicker_light(out, 0.25, 2.5)
    for k in range(3):
        animated_flame(f"DoorFlame{k}", (-2 + k * 2, -D / 2 - 4, 0), 3, 3.4, strength=10, seed=k)
    for i in (0, 2):
        cast.follower(f"DoorFollower{i}", loc=(-1.0 + i, -D / 2 - 1.4, 0), yaw=0, seed=i)
    n = cast.nethrak(loc=(0, -D / 2 - 1.6, 0), yaw=180)
    n.pose(1, shoulder_r=(10, 12), elbow_r=10)
    n.walk(1, 82, (0, -D / 2 - 1.6, 0), (0.1, -2.3, 0), cycle=44, stride=18, arm=6, bob=0.02, lean=0)
    n.pose(82, shoulder_r=(12, 12))
    fa = cast.father(loc=(-0.45, -1.45, 0), yaw=0)
    mo = cast.mother(loc=(0.55, -1.2, 0), yaw=0)
    fa.pose(1, spine=-6)
    fa.pose(60, spine=-10, shoulder_l=(40, 20), elbow_l=20)
    mo.pose(1, spine=-10, shoulder_r=(60, 10), elbow_r=50)
    mo.pose(70, spine=-14)
    cam.data.lens = 26
    cam.data.keyframe_insert("lens", frame=1)
    cam.data.lens = 30
    cam.data.keyframe_insert("lens", frame=82)
    return 82


def s14_face_and_blade():
    world((0.008, 0.005, 0.004), 1.0)
    n = cast.nethrak(loc=(0, 0, 0), yaw=0)
    n.pose(1, shoulder_r=(14, 14), elbow_r=10, neck=(8, 0, 0))
    n.pose(38, neck=(4, 0, 0))
    key = light("AREA", (0.9, -1.4, 0.4), 120, (1.0, 0.4, 0.12), size=1.2, target=(0, 0, 1.6), name="FireKey")
    flicker_light(key, 0.25, 2.0)
    nolight_shadow(light("AREA", (-1.2, 1.2, 2.6), 60, (1.0, 0.3, 0.1), size=2, target=(0, 0, 1.6), name="Rim"))
    drift_field("Embers", "ember", (0, -0.5, 0), (4, 3, 3), 80)
    cam = camera((1.0, -2.3, 0.7), (0.35, -0.1, 0.6), lens=40, dof_dist=2.4, fstop=2.8)
    cam_path(cam, [(1, (1.0, -2.3, 0.7), (0.35, -0.1, 0.55), None), (18, (0.6, -2.0, 1.3), (0.2, -0.1, 1.2), None), (38, (0.3, -1.75, 1.8), (0.0, -0.05, 1.85), None)])
    return 38


def s15_father_falls():
    info, cam = _slit_pov(fire=1.0)
    D = info["D"]
    info["door"].hide_render = True
    out = nolight_shadow(light("AREA", (0, -D / 2 - 2.5, 1.6), 1400, (1.0, 0.42, 0.12), size=3, target=(0, 0, 1), name="FireDoor"))
    flicker_light(out, 0.25, 2.5)
    n = cast.nethrak(loc=(0.15, -2.45, 0), yaw=180)
    fa = cast.father(loc=(-0.2, -1.55, 0), yaw=0)
    knife = MeshBuilder()
    knife.add(*tube((0, -0.02, -0.08), (0, -0.05, -0.4), 0.008, 0.002, 4))
    ko = knife.build("Knife", cast.mats()["steel"])
    ko.parent = fa.j["wrist_r"]
    fa.pose(1, shoulder_r=(60, 5), shoulder_l=(60, -5), elbow_r=30, elbow_l=30)
    fa.pose(10, shoulder_r=(160, 5), shoulder_l=(155, -5), elbow_r=15, elbow_l=15, spine=-6)
    n.pose(1, shoulder_r=(30, 25), elbow_r=20)
    n.pose(10, shoulder_r=(175, 30), elbow_r=40, spine=(-6, 0, -20))
    n.pose(16, shoulder_r=(-10, 20), elbow_r=0, spine=(14, 0, 25))
    n.pose(38, shoulder_r=(10, 18), spine=(6, 0, 10))
    fa.pose(16, spine=(-10, 0, 0))
    fa.pose(22, loc=(-0.25, -1.4, -0.3), spine=(-35, 10, 0), shoulder_r=(90, 30), shoulder_l=(60, -30))
    fa.pose(34, loc=(-0.35, -1.1, -1.6), spine=(-80, 15, 0))
    flash = nolight_shadow(light("POINT", (0, -1.9, 1.5), 0, (1.0, 0.95, 0.9), size=0.3, name="Flash"))
    key_energy(flash, 14, 0)
    key_energy(flash, 16, 1800)
    key_energy(flash, 21, 0)
    shake(cam, 16, 24, 0.8)
    return 38


def _child_face_dark():
    world((0.002, 0.002, 0.002), 1.0)
    ch = cast.child("ChildFace", loc=(0, 0, 0), yaw=0, sword=False)
    ch.pose(1, neck=(-6, 0, 0), head=(-4, 0, 0), shoulder_r=(75, 12), shoulder_l=(75, 12), elbow_r=125, elbow_l=125)
    band = light("AREA", (0, -0.6, 1.05), 9, (1.0, 0.55, 0.25), size=1.0, target=(0, 0, 1.0), name="Band")
    band.data.shape = "RECTANGLE"
    band.data.size = 1.2
    band.data.size_y = 0.06
    fill = nolight_shadow(light("AREA", (0.6, -0.8, 0.6), 1.2, (0.5, 0.55, 0.8), size=1.0, target=(0, 0, 0.9), name="ColdFill"))
    cam = camera((0.08, -1.0, 0.95), (0, 0, 0.88), lens=50, dof_dist=1.0, fstop=2.4)
    return ch, band, cam


def s16_child_reacts():
    ch, band, cam = _child_face_dark()
    flicker_light(band, 0.3, 2.0)
    key_energy(band, 4, 9)
    key_energy(band, 8, 1.5)
    key_energy(band, 14, 9)
    key_energy(band, 25, 9)
    key_energy(band, 27, 30)
    key_energy(band, 31, 6)
    ch.pose(10, neck=(-4, 0, 8), head=(-4, 0, 0))
    ch.pose(20, neck=(-6, 0, -6))
    ch.pose(38, neck=(-2, 0, 0), shoulder_r=(80, 12), shoulder_l=(80, 12))
    cam_path(cam, [(1, (0.08, -1.0, 0.95), (0, 0, 0.88), None), (38, (0.06, -0.85, 0.94), (0, 0, 0.9), None)])
    return 38


def s17_hand_falls():
    info, cam = _slit_pov(fire=1.0)
    D = info["D"]
    info["door"].hide_render = True
    out = nolight_shadow(light("AREA", (0, -D / 2 - 2.5, 1.6), 1300, (1.0, 0.42, 0.12), size=3, target=(0, 0, 1), name="FireDoor"))
    flicker_light(out, 0.25, 2.5)
    mo = cast.mother("MotherFallen", loc=(-0.15, -1.1, 0.0), yaw=90)
    mo.pose(1, loc=(-0.15, -1.0, 0.0), spine=(20, 0, 0))
    mo.pose(8, loc=(-0.2, -0.9, -0.9), spine=(80, 0, 10), shoulder_r=(120, 30), elbow_r=10)
    mo.pose(14, loc=(-0.2, -0.85, -1.38), spine=(88, 0, 10), shoulder_r=(150, 40), elbow_r=0)
    n = cast.nethrak(loc=(0.4, -2.3, 0), yaw=180)
    n.pose(1, shoulder_r=(10, 18))
    n.pose(18, yaw=180)
    n.pose(30, yaw=10)
    n.walk(30, 43, (0.4, -2.3, 0), (0.3, -3.6, 0), cycle=40, stride=16, arm=5, bob=0.02, lean=0)
    return 43


# ============================================================ 4. BURIED


def s18_ceiling_fire():
    info = sets.interior(fire=1.0)
    hp = info["hatch"]
    for f, a in ((1, 8), (20, 8), (26, 12), (32, 8), (44, 8), (50, 13), (56, 8), (72, 8)):
        hp.rotation_euler = (math.radians(-a), 0, 0)
        hp.keyframe_insert("rotation_euler", frame=f)
    for k in range(5):
        fl = animated_flame(f"BeamFlame{k}", (0, -2.4 + k * 1.2, 2.7), 6.5, 0.9 + 0.3 * (k % 2), strength=11, seed=k * 2.3)
        fl.rotation_euler = (math.radians(-90), 0, 0)  # lie flat under the ceiling, burning downward
        fl.scale = (0.05, 1, 1)
        fl.keyframe_insert("scale", frame=1 + k * 6)
        fl.scale = (1, 1, 1)
        fl.keyframe_insert("scale", frame=50 + k * 4)
    fire = nolight_shadow(light("AREA", (0, 0, 2.5), 300, (1.0, 0.4, 0.1), size=5, target=(0, 0, 0), name="CeilingFire"))
    key_energy(fire, 1, 300)
    key_energy(fire, 72, 1600)
    flicker_light(fire, 0.25, 2.0)
    drift_field("Smoke", "ash", (0, 0, 1.2), (6, 6, 2), 200, speed=0.5)
    hands = []
    for sx in (-1, 1):
        h = cast.Hand(f"PushHand{sx}", (sx * 0.18, -0.25, -0.09), size=0.055, sleeve="indigo")
        h.place(1, loc=(sx * 0.18, -0.25, -0.12), rot=(90, 0, 0))
        h.curl(1, 0.15)
        for f, z in ((20, -0.12), (26, -0.07), (32, -0.11), (44, -0.12), (50, -0.06), (56, -0.11)):
            h.place(f, loc=(sx * 0.18, -0.25, z))
        hands.append(h)
    cam = camera((0.0, -0.22, -0.32), (0.0, -1.3, 2.6), lens=24, dof_dist=0.6, fstop=4)
    return 72


def s19_beam_falls():
    info = sets.interior(fire=1.0)
    info["hatch"].rotation_euler = (math.radians(-8), 0, 0)
    fire = nolight_shadow(light("AREA", (0, 0, 2.5), 1600, (1.0, 0.4, 0.1), size=5, target=(0, 0, 0), name="CeilingFire"))
    flicker_light(fire, 0.25, 2.0)
    key_energy(fire, 12, 1600)
    key_energy(fire, 30, 0)
    beam = MeshBuilder()
    beam.add(*box((0, 0, 0), (4.5, 0.32, 0.3)))
    bo = beam.build("FallingBeam", principled("CharBeam", (0.02, 0.012, 0.01), rough=0.85, emit=(1.0, 0.22, 0.04), emit_strength=0.25))
    bo.rotation_euler = (0, math.radians(14), math.radians(6))
    bo.location = (0, -0.4, 2.8)
    bo.keyframe_insert("location", frame=1)
    bo.keyframe_insert("rotation_euler", frame=1)
    bo.location = (0, -0.42, 0.16)
    bo.rotation_euler = (0, 0, math.radians(3))
    bo.keyframe_insert("location", frame=10)
    bo.keyframe_insert("rotation_euler", frame=10)
    fl = animated_flame("BeamFire", (0, -0.42, 0.3), 4.2, 1.0, strength=10)
    fl.parent = bo
    fl.location = (0, 0, 0.12)
    drift_field("BurstEmbers", "ember", (0, -0.5, -0.2), (3, 2, 2.5), 160, speed=1.5)
    cam = camera((0.0, -0.22, -0.32), (0.0, -1.3, 2.6), lens=24, dof_dist=0.6, fstop=4)
    shake(cam, 10, 22, 1.6)
    return 34


def s20_cellar_dark():
    world((0.001, 0.001, 0.001), 1.0)
    stone = principled("CellarStone", (0.06, 0.05, 0.045), rough=0.95)
    c = MeshBuilder()
    c.add(*box((0, 0, -0.05), (1.6, 1.6, 0.1)))
    for sx in (-1, 1):
        c.add(*box((sx * 0.75, 0, 0.65), (0.1, 1.6, 1.4)))
        c.add(*box((0, sx * 0.75, 0.65), (1.6, 0.1, 1.4)))
    c.build("Cellar", stone)
    vent_c = V((0.69, 0.3, 1.05))
    vent = MeshBuilder()
    vent.add(*box(vent_c + V((0.03, 0, 0)), (0.02, 0.26, 0.12)))
    vo = vent.build("Vent", emission("VentGlow", (1.0, 0.4, 0.1), 6))
    vent_light = nolight_shadow(light("AREA", vent_c - V((0.1, 0, 0)), 14, (1.0, 0.42, 0.12), size=0.3, target=(0, 0.3, 0.3), name="VentLight"))
    flicker_light(vent_light, 0.3, 2.0)
    key_energy(vent_light, 1, 14)
    key_energy(vent_light, 110, 4)
    volume_box("VentSmoke", (0.45, 0.3, 1.05), (0.5, 0.5, 0.3), density=0.6, color=(0.5, 0.4, 0.35), anisotropy=0.4, noise_scale=6.0, noise_amount=0.8)
    ch = cast.child("Curled", loc=(-0.35, -0.2, 0.0), yaw=110, sword=False)
    ch.pose(1, drop=0.33, thigh_l=(110, 10), thigh_r=(110, -10), knee_l=-140, knee_r=-140, spine=35, neck=(25, 0, 0), shoulder_r=(70, 10), shoulder_l=(70, -10), elbow_r=70, elbow_l=70)
    ch.pose(60, spine=38, neck=(30, 0, 0))
    ch.pose(110, spine=36, neck=(28, 0, 0))
    charm = MeshBuilder()
    cast.charm_object(charm, (0, 0, 0), r=0.02)
    co = charm.build("CharmDark", cast.mats()["charm"])
    co.parent = ch.j["wrist_r"]
    co.location = (0, -0.03, -0.05)
    cam = camera((0.45, -0.55, 0.55), (-0.3, -0.1, 0.45), lens=32, dof_dist=0.9, fstop=2.8)
    cam_path(cam, [(1, (0.45, -0.55, 0.55), (-0.3, -0.1, 0.45), None), (110, (0.35, -0.45, 0.5), (-0.3, -0.12, 0.42), None)])
    return 110


# ============================================================ 5. THE SURVIVOR


def s21_dawn_emerge():
    sets.ruins()
    rub = MeshBuilder()
    rnd = random.Random(3)
    for k in range(14):
        rub.add(*box((rnd.uniform(-1.6, 1.6), rnd.uniform(-1.0, 1.0) + 5, 0.15 + rnd.uniform(0, 0.3)), (rnd.uniform(1.5, 2.8), 0.2, 0.18), rot_z=rnd.uniform(0, 3)))
    rub.build("Rubble", principled("Charred", (0.025, 0.022, 0.02), rough=0.85))
    ch = cast.child("Survivor", loc=(-0.5, 5.2, -0.9), yaw=200, sword=False)
    ch.pose(1, loc=(-0.5, 5.2, -0.9), spine=60, shoulder_r=(150, 10), shoulder_l=(140, -10), neck=(-30, 0, 0))
    ch.pose(28, loc=(-0.5, 5.0, -0.35), spine=55, shoulder_r=(110, 10), shoulder_l=(150, -10))
    ch.pose(48, loc=(-0.45, 4.8, 0.0), spine=45, thigh_l=(70,), knee_l=-90, shoulder_r=(60, 10), shoulder_l=(60, -10))
    ch.pose(72, loc=(-0.4, 4.6, 0.0), spine=12, thigh_l=(10,), knee_l=-10, neck=(-10, 0, 0), shoulder_r=(10, 6), shoulder_l=(10, 6))
    drift_field("Ash", "ash", (0, 5, 0), (10, 10, 5), 300, speed=0.5)
    cam = camera((1.8, 0.8, 1.0), (-0.5, 5.0, 0.4), lens=40, dof_dist=4.5, fstop=3.2)
    return 72


def s22_ruins_search():
    sets.ruins()
    ch = cast.child("Survivor", loc=(-0.5, 4.6, 0), yaw=180, sword=False)
    ch.walk(1, 60, (-0.5, 4.6, 0), (1.2, 14, 0), cycle=30, stride=22, arm=10, bob=0.02, lean=2)
    ch.pose(14, neck=(-15, 0, -30))
    ch.pose(26, neck=(-20, 0, 25))
    ch.pose(60, neck=(-10, 0, 0))
    ch.pose(72, neck=(-5, 0, -20))
    drift_field("Ash", "ash", (0, 10, 0), (16, 16, 6), 300, speed=0.5)
    cam = camera((-3.5, -4.5, 2.2), (0.5, 11, 0.8), lens=32, dof_dist=12, fstop=5)
    cam_path(cam, [(1, (-3.5, -4.5, 2.2), (0, 8, 0.8), None), (72, (-2.6, -2.0, 2.0), (1.0, 13, 0.8), None)])
    return 72


def s23_kneel():
    sets.ruins()
    step = MeshBuilder()
    step.add(*box((-6.2, 4.4, 0.1), (2.2, 3.6, 0.2)))
    step.build("Foundation", principled("FoundationStone", (0.12, 0.115, 0.11), rough=0.9))
    ch = cast.child("Survivor", loc=(-4.7, 4.5, 0), yaw=-90, sword=False)
    ch.pose(1, shoulder_r=(10, 6), shoulder_l=(10, 6))
    ch.pose(20, drop=0.2, thigh_l=(60,), knee_l=-80, spine=10)
    ch.pose(36, drop=0.38, thigh_l=(90,), thigh_r=(90,), knee_l=-150, knee_r=-150, spine=25, neck=(30, 0, 0), shoulder_r=(25, 5), elbow_r=40, shoulder_l=(15, 5))
    ch.pose(72, spine=30, neck=(35, 0, 0))
    charm = MeshBuilder()
    cast.charm_object(charm, (0, 0, 0), r=0.02)
    co = charm.build("CharmFist", cast.mats()["charm"])
    co.parent = ch.j["wrist_r"]
    co.location = (0, -0.01, -0.13)
    cord = MeshBuilder()
    cord.add(*tube((0, 0, 0.02), (0, 0, 0.09), 0.002, 0.002, 4))
    cord.build("CharmFistCord", cast.mats()["cord"]).parent = co
    drift_field("Ash", "ash", (-4.7, 4.5, 0), (6, 6, 4), 160, speed=0.4)
    cam = camera((-2.6, 2.3, 0.9), (-4.8, 4.5, 0.55), lens=45, dof_dist=3.1, fstop=2.8)
    cam_path(cam, [(1, (-2.6, 2.3, 0.9), (-4.8, 4.5, 0.6), None), (72, (-3.0, 2.8, 0.85), (-4.8, 4.5, 0.5), None)])
    return 72


# ============================================================ 6. THE YEARS BETWEEN


def _young(name, age):
    """age 0 = child, 1 = adult height teen; uses the child build scaled."""
    ch = cast.child(name, loc=(0, 0, 0), yaw=90)
    s = 1.0 + 0.55 * age
    ch.root.scale = (s, s, s)
    return ch


def _swing(pp, f, k, stance=True):
    pp.pose(
        f,
        shoulder_r=(lerp(160, 30, k), 10), shoulder_l=(lerp(150, 25, k), -10),
        elbow_r=lerp(30, 5, k), elbow_l=lerp(30, 5, k), spine=lerp(-6, 16, k),
        **({"thigh_l": (22, 10), "thigh_r": (-18, 10), "knee_l": -12, "knee_r": -6, "drop": 0.04} if stance else {}),
    )


def lerp(a, b, k):
    return a + (b - a) * k


def s24_first_stance():
    sets.training_field("gray")
    ch = _young("Young", 0.0)
    ch.root.location = (0, 0, 0)
    _swing(ch, 1, 0)
    _swing(ch, 10, 0)
    _swing(ch, 18, 1)
    ch.pose(28, loc=(0.25, 0, 0), spine=(32, 0, 10), thigh_l=(40, 10), knee_l=-30)
    ch.pose(40, loc=(0.2, 0, 0), spine=(4, 0, 0), thigh_l=(22, 10), knee_l=-12)
    _swing(ch, 50, 0)
    _swing(ch, 62, 1)
    _swing(ch, 72, 0.95)
    cam = camera((0.6, -4.2, 0.9), (0.2, 0.6, 0.7), lens=38, dof_dist=4.2, fstop=3.5)
    return 72


def s25a_rain():
    sets.training_field("rain")
    ch = _young("YoungRain", 0.25)
    for f, k in ((1, 0), (8, 1), (16, 0.2), (24, 1), (29, 0.9)):
        _swing(ch, f, k)
    cam = camera((0.9, -2.0, 1.25), (0.1, 0.2, 1.2), lens=50, dof_dist=2.2, fstop=2.4)
    return 29


def s25b_knocked():
    info = sets.training_field("autumn")
    ch = _young("YoungAutumn", 0.4)
    ch.root.location = (0.2, 0.6, 0)
    _swing(ch, 1, 0)
    _swing(ch, 8, 1)
    ch.pose(12, shoulder_r=(70, 30), shoulder_l=(50, -30), elbow_r=10, spine=-6)
    ch.pose(26, shoulder_r=(30, 25), shoulder_l=(30, -25), spine=-2)
    sw = MeshBuilder()
    sw.add(*tube((0, 0, -0.25), (0, 0, 0.55), 0.016, 0.014, 6))
    so = sw.build("FlyingSword", cast.mats()["wood"])
    so.rotation_mode = "XYZ"
    so.location = (0.9, 0.6, 1.1)
    so.keyframe_insert("location", frame=9)
    so.keyframe_insert("rotation_euler", frame=9)
    so.location = (1.8, 1.8, 2.3)
    so.rotation_euler = (math.radians(220), math.radians(40), 0)
    so.keyframe_insert("location", frame=18)
    so.keyframe_insert("rotation_euler", frame=18)
    so.location = (2.4, 2.6, 0.05)
    so.rotation_euler = (math.radians(450), math.radians(80), 0)
    so.keyframe_insert("location", frame=26)
    so.keyframe_insert("rotation_euler", frame=26)
    key_vis(so, 1, False)
    key_vis(so, 9, True)
    cam = camera((0.1, -3.6, 1.1), (1.0, 1.2, 1.1), lens=32, dof_dist=3.5, fstop=4)
    shake(cam, 9, 15, 0.5)
    return 26


def s25c_wrist():
    world((0.04, 0.045, 0.06), 1.0)
    light("AREA", (0.3, -0.4, 0.5), 16, (0.85, 0.9, 1.0), size=0.6, target=(0, 0, 0), name="Cold")
    h = cast.Hand("GripHand", (0, 0, 0), size=0.075, sleeve="charcoal")
    h.place(1, rot=(0, 90, 0))
    h.curl(1, 0.55)
    h.curl(26, 0.95)
    grip = MeshBuilder()
    grip.add(*tube((0.0, 0.05, -0.35), (0.0, 0.05, 0.35), 0.022, 0.022, 10))
    grip.build("Grip", cast.mats()["wood"])
    wrap = MeshBuilder()
    for k in range(6):
        wrap.add(*tube((0, -0.05 - k * 0.028, 0), (0, -0.07 - k * 0.028, 0), 0.034, 0.034, 10))
    wo = wrap.build("Bandage", cast.mats()["cream"])
    wo.parent = h.root
    tail = MeshBuilder()
    tail.add(*box((0, 0, -0.06), (0.03, 0.004, 0.12)))
    to = tail.build("BandageTail", cast.mats()["cream"])
    to.parent = h.root
    to.location = (0.03, -0.12, -0.02)
    to.keyframe_insert("location", frame=1)
    to.location = (0.03, -0.09, 0.03)
    to.keyframe_insert("location", frame=20)
    cam = camera((0.16, -0.28, 0.12), (0.0, -0.02, 0.0), lens=60, dof_dist=0.33, fstop=2.2)
    return 26


def s25d_snow_feet():
    sets.training_field("winter")
    ch = _young("YoungSnow", 0.6)
    ch.pose(1, thigh_l=(4, 4), thigh_r=(-4, 4), drop=0.0)
    ch.pose(10, thigh_l=(28, 12), knee_l=-25, drop=0.02)
    ch.pose(18, thigh_l=(22, 12), thigh_r=(-18, 12), knee_l=-12, knee_r=-6, drop=0.05)
    ch.pose(26, thigh_l=(22, 12), thigh_r=(-18, 12), knee_l=-12, knee_r=-6, drop=0.06)
    cam = camera((0.05, -1.4, 0.18), (0.0, 0.1, 0.12), lens=40, dof_dist=1.4, fstop=2.4)
    return 26


def s25e_fall():
    sets.training_field("winter")
    ch = _young("YoungFall", 0.7)
    _swing(ch, 1, 0.6)
    ch.pose(4, spine=(-15, 0, 0))
    ch.pose(12, loc=(-0.2, 0, -0.4), spine=(-50, 0, 10), thigh_l=(70,), thigh_r=(40,), shoulder_r=(120, 40), shoulder_l=(110, -40))
    ch.pose(18, loc=(-0.7, 0, -0.95), spine=(-85, 0, 10))
    ch.pose(22, loc=(-0.72, 0, -0.97))
    cam = camera((0.4, -3.0, 0.7), (-0.3, 0.3, 0.6), lens=35, dof_dist=3.0, fstop=3.5)
    shake(cam, 17, 22, 0.4)
    return 22


def s25f_attempt():
    sets.training_field("spring")
    ch = _young("YoungSpring", 0.85)
    for f, k in ((1, 0), (6, 0), (13, 1), (24, 1)):
        _swing(ch, f, k)
    cam = camera((0.7, -4.0, 1.2), (0.2, 0.6, 1.1), lens=38, dof_dist=4.0, fstop=3.5)
    return 24


def s26a_match_child():
    sets.training_field("gray")
    ch = _young("MatchChild", 0.0)
    _swing(ch, 1, 0)
    _swing(ch, 19, 0.45)
    cam = camera((0.6, -4.2, 0.9), (0.2, 0.6, 0.7), lens=38, dof_dist=4.2, fstop=3.5)
    return 19


def s26b_match_adult():
    sets.training_field("dusk")
    k = cast.kairo_adult(loc=(0, 0, 0), yaw=90)
    _swing(k, 1, 0.45)
    _swing(k, 9, 1.0)
    _swing(k, 43, 1.0)
    k.pose(43, neck=(-5, 0, 0))
    trail = MeshBuilder()
    trail.add(*tube((0.4, -0.05, 1.9), (1.4, -0.1, 0.6), 0.01, 0.002, 4))
    to = trail.build("SwingTrail", emission("Trail", (1.0, 0.9, 0.8), 8))
    key_vis(to, 1, True)
    key_vis(to, 8, False)
    cam = camera((0.9, -5.6, 1.2), (0.3, 0.6, 1.1), lens=38, dof_dist=5.6, fstop=3.5)
    return 43


# ============================================================ 7. THE HUNT BEGINS


def s27_tie_charm():
    world((0.01, 0.01, 0.014), 1.0)
    light("AREA", (0.5, -0.8, 0.6), 30, (1.0, 0.6, 0.4), size=0.8, target=(0, 0, 0.1), name="Key")
    armour = MeshBuilder()
    for r in range(5):
        armour.add(*box((0, 0.02, 0.32 - r * 0.11), (0.5, 0.03, 0.1), rot_z=0))
    ao = armour.build("ChestPlates", cast.mats()["black_metal"])
    ao.location = (0, 0, 0.35)
    ao.keyframe_insert("location", frame=1)
    ao.location = (0, 0, 0.0)
    ao.keyframe_insert("location", frame=22)
    robe = MeshBuilder()
    robe.add(*box((0, 0.06, 0.1), (0.6, 0.02, 0.8)))
    robe.build("InnerRobe", cast.mats()["charcoal"])
    ch = MeshBuilder()
    cast.charm_object(ch, (0, 0, 0), r=0.026)
    co = ch.build("Charm", cast.mats()["charm"])
    co.rotation_euler = (math.radians(90), 0, 0)
    co.location = (0.0, 0.035, 0.12)
    for sx in (-1, 1):
        h = cast.Hand(f"TieHand{sx}", (sx * 0.08, -0.03, 0.18), size=0.075, sleeve="black_metal", flip=sx)
        h.place(1, loc=(sx * 0.12, -0.03, 0.16), rot=(90, 0, sx * 70))
        h.curl(1, 0.5)
        h.place(14, loc=(sx * 0.07, -0.03, 0.14), rot=(90, 0, sx * 80))
        h.curl(14, 0.8)
        h.place(31, loc=(sx * 0.18, -0.06, 0.05), rot=(90, 0, sx * 60))
        h.curl(31, 0.3)
    cam = camera((0.12, -0.55, 0.22), (0.0, 0.03, 0.12), lens=55, dof_dist=0.58, fstop=2.4)
    return 31


def s28_fortress_draw():
    import shot_fortress  # reuse the look-dev environment

    shot_fortress.build()
    # replace the static placeholder with the animated adult Kairo
    for ob in list(bpy.data.objects):
        if ob.name in ("Protagonist", "Katana", "Glint"):
            bpy.data.objects.remove(ob)
    k = cast.kairo_adult(loc=(3.4, 1.2, 10.05), yaw=180 + 12)
    k.pose(1, shoulder_r=(20, 15), elbow_r=40, shoulder_l=(30, -10), elbow_l=60)
    k.pose(12, shoulder_r=(40, 10), elbow_r=80, shoulder_l=(40, -10), elbow_l=70)
    k.pose(24, shoulder_r=(110, 15), elbow_r=10, shoulder_l=(15, -6), elbow_l=10)
    k.pose(41, shoulder_r=(118, 15), elbow_r=8, neck=(-4, 0, 0))
    k.pose(1, neck=(5, 0, 0))
    cam = bpy.context.scene.camera
    cam_path(cam, [(1, (6.6, -6.2, 11.9), (-38, 300, 40), None), (41, (6.2, -5.2, 12.0), (-38, 300, 42), None)])
    return 41
