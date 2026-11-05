"""
Cast for the opening film, built on the joint rig (see rig.py).

Designs follow docs/characters/*.webp where a sheet exists (Nethrak,
Kurogane-style followers, Vargash, adult Kairo). The father, mother, child
and villagers have no sheets yet and use simple period costume. These are
cinematic blockouts, not final game models.
"""

from __future__ import annotations

import math
import random

from mathutils import Vector

from lib import box, curved_spike, ellipsoid, principled, emission, spike, tube
from rig import Proportions, Puppet

_M = {}


def mats():
    if _M:
        return _M
    _M.update(
        skin=principled("Skin", (0.42, 0.27, 0.2), rough=0.6, sss=0.15),
        hair=principled("Hair", (0.02, 0.018, 0.016), rough=0.5),
        indigo=principled("Indigo", (0.05, 0.07, 0.13), rough=0.85),
        ochre=principled("Ochre", (0.32, 0.2, 0.1), rough=0.85),
        rose=principled("RoseKimono", (0.35, 0.12, 0.14), rough=0.8),
        cream=principled("Cream", (0.55, 0.5, 0.42), rough=0.85),
        charcoal=principled("Charcoal", (0.03, 0.03, 0.035), rough=0.8),
        black_cloth=principled("BlackCloth", (0.018, 0.017, 0.02), rough=0.9),
        black_metal=principled("BlackMetal", (0.02, 0.02, 0.025), rough=0.35, metal=0.9),
        gold=principled("Gold", (0.6, 0.42, 0.18), rough=0.3, metal=1.0),
        steel=principled("Steel", (0.75, 0.76, 0.8), rough=0.15, metal=1.0),
        wood=principled("PracticeWood", (0.3, 0.18, 0.09), rough=0.6),
        white_robe=principled("WhiteRobe", (0.62, 0.6, 0.6), rough=0.75),
        crimson=principled("Crimson", (0.42, 0.02, 0.03), rough=0.55),
        bone=principled("Bone", (0.55, 0.52, 0.46), rough=0.55),
        red_glow=emission("RedEyes", (1.0, 0.05, 0.02), 30.0),
        red_blade=principled("RedBlade", (0.55, 0.01, 0.02), rough=0.25, metal=0.6, emit=(1.0, 0.05, 0.02), emit_strength=1.6),
        hide=principled("BeastHide", (0.06, 0.065, 0.07), rough=0.75),
        fur=principled("BeastFur", (0.025, 0.025, 0.03), rough=0.9),
        wing=principled("Wing", (0.07, 0.08, 0.12), rough=0.6, sss=0.2),
        orange=principled("Orange", (0.5, 0.15, 0.04), rough=0.6),
        beast_eye=emission("BeastEye", (1.0, 0.3, 0.05), 25.0),
        charm=principled("Charm", (0.36, 0.22, 0.1), rough=0.7),
        cord=principled("Cord", (0.45, 0.04, 0.03), rough=0.7),
        shadow_scarf=principled("ShadowScarf", (0.01, 0.01, 0.014), rough=0.6, emit=(0.05, 0.05, 0.08), emit_strength=0.3),
    )
    return _M


# ----------------------------------------------------------- body parts


def _body(pp: Puppet, skin="skin", limb_r=0.045, cloth_arms=None, legs=True, feet="charcoal"):
    d = pp.dims
    H = d["H"]
    head_r = H * pp.p.head * 0.5
    pp.part_mat("head", skin).add(*ellipsoid((0, -0.005, head_r * 0.95), (head_r * 0.82, head_r * 0.92, head_r), seg=14, rings=10))
    pp.part_mat("neck", skin).add(*tube((0, 0, -0.02), (0, 0, H * 0.04), H * 0.03, H * 0.028, 8))
    for s in ("l", "r"):
        arm_mat = cloth_arms or skin
        pp.part_mat(f"shoulder_{s}", arm_mat).add(*tube((0, 0, 0), (0, 0, -d["upper"]), H * limb_r * 0.62, H * limb_r * 0.55, 8))
        pp.part_mat(f"elbow_{s}", arm_mat).add(*tube((0, 0, 0), (0, 0, -d["fore"]), H * limb_r * 0.55, H * limb_r * 0.45, 8))
        pp.part_mat(f"wrist_{s}", skin).add(*ellipsoid((0, -0.005, -H * 0.04), (H * 0.026, H * 0.018, H * 0.045), seg=8, rings=6))
        if legs:
            pp.part_mat(f"thigh_{s}", skin).add(*tube((0, 0, 0), (0, 0, -d["thigh"]), H * limb_r * 0.9, H * limb_r * 0.75, 8))
            pp.part_mat(f"knee_{s}", skin).add(*tube((0, 0, 0), (0, 0, -d["shin"]), H * limb_r * 0.72, H * limb_r * 0.55, 8))
        pp.part_mat(f"ankle_{s}", feet).add(*box((0, -H * 0.03, -H * 0.012), (H * 0.06, H * 0.14, H * 0.03)))


def _kimono_top(pp: Puppet, key, belt="charcoal", wide_sleeves=True, chest_scale=1.0):
    d = pp.dims
    H = d["H"]
    t = d["torso"]
    pp.part_mat("spine", key).add(*ellipsoid((0, 0, t * 0.22), (H * 0.1 * chest_scale, H * 0.075 * chest_scale, t * 0.32), seg=14, rings=8))
    pp.part_mat("chest", key).add(*ellipsoid((0, 0, t * 0.18), (H * 0.125 * chest_scale, H * 0.08 * chest_scale, t * 0.4), seg=14, rings=8))
    pp.part_mat("spine", belt).add(*tube((0, 0, t * 0.02), (0, 0, t * 0.16), H * 0.102 * chest_scale, H * 0.1 * chest_scale, 14))
    if wide_sleeves:
        for s in ("l", "r"):
            pp.part_mat(f"shoulder_{s}", key).add(*tube((0, 0, 0.02), (0, 0, -d["upper"] * 1.05), H * 0.05, H * 0.07, 10))
            pp.part_mat(f"elbow_{s}", key).add(*box((0, H * 0.02, -d["fore"] * 0.25), (H * 0.05, H * 0.12, d["fore"] * 0.6)))


def _hakama(pp: Puppet, key):
    d = pp.dims
    H = d["H"]
    pp.part_mat("hips", key).add(*tube((0, 0, 0.02), (0, 0, -H * 0.1), H * 0.11, H * 0.14, 14))
    for s in ("l", "r"):
        pp.part_mat(f"thigh_{s}", key).add(*tube((0, 0, 0), (0, 0, -d["thigh"]), H * 0.08, H * 0.1, 10))
        pp.part_mat(f"knee_{s}", key).add(*tube((0, 0, 0.02), (0, 0, -d["shin"] * 0.95), H * 0.1, H * 0.12, 10))


def _long_robe(pp: Puppet, key, flare=0.24, hem=None, hem_key=None, rnd=None):
    d = pp.dims
    H = d["H"]
    pp.part_mat("hips", key).add(*tube((0, 0, 0.05), (0, 0, -d["hip_z"] + 0.03), H * 0.11, H * flare, 18))
    if hem_key:
        rnd = rnd or random.Random(3)
        mb = pp.part_mat("hips", hem_key)
        r = H * flare
        z0 = -d["hip_z"] + 0.04
        for i in range(18):
            a = 2 * math.pi * (i + rnd.uniform(-0.3, 0.3)) / 18
            out = Vector((math.cos(a), math.sin(a), 0))
            h = rnd.uniform(0.15, 0.7)
            base = Vector((0, 0, z0)) + out * r * 1.01
            # brushstroke flames hug the robe, tapering inward as they rise
            tip = Vector((0, 0, z0 + h)) + out * (r - (r - pp.p.height * 0.11) * h / pp.dims["hip_z"]) * 1.01
            mb.add(*spike(base, tip, rnd.uniform(0.06, 0.14), 0.006, up_hint=out))


def _katana(mb, base, direction, length=0.95, saya=False):
    base = Vector(base)
    dv = Vector(direction).normalized()
    mb.add(*tube(base - dv * 0.22, base, 0.016, 0.016, 6))  # tsuka
    mb.add(*tube(base, base + dv * length, 0.012, 0.004, 4))


# --------------------------------------------------------------- the cast


def child(name="Child", loc=(0, 0, 0), yaw=0.0, sword=True):
    m = mats()
    pp = Puppet(name, Proportions(height=1.12, head=0.2, leg=0.42, torso=0.3, shoulder_w=0.11, hip_w=0.05, arm=0.36, child=True)).build(loc, yaw)
    _body(pp, limb_r=0.05, cloth_arms="indigo")
    _kimono_top(pp, "indigo", belt="ochre")
    H = pp.dims["H"]
    pp.part_mat("hips", "indigo").add(*tube((0, 0, 0.03), (0, 0, -H * 0.2), H * 0.11, H * 0.15, 14))
    head_r = H * 0.1
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.01, head_r * 1.25), (head_r * 0.85, head_r * 0.88, head_r * 0.6), seg=12, rings=8))
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.03, head_r * 1.95), (head_r * 0.25, head_r * 0.25, head_r * 0.22), seg=8, rings=6))
    _eyes(pp, head_r, big=True)
    if sword:
        _katana(pp.part_mat("wrist_r", "wood"), (0, -0.02, -0.06), (0, -0.25, -1), length=0.55)
    pp.finish(m)
    return pp


def _eyes(pp, head_r, big=False, glow=None):
    m = mats()
    s = 1.35 if big else 1.0
    for sx in (-1, 1):
        if glow:
            pp.part_mat("head", glow).add(*ellipsoid((sx * head_r * 0.33, -head_r * 0.82, head_r * 1.0), (head_r * 0.13 * s, head_r * 0.05, head_r * 0.07 * s), seg=8, rings=5))
        else:
            pp.part_mat("head", "cream").add(*ellipsoid((sx * head_r * 0.33, -head_r * 0.8, head_r * 1.0), (head_r * 0.14 * s, head_r * 0.06, head_r * 0.09 * s), seg=8, rings=5))
            pp.part_mat("head", "hair").add(*ellipsoid((sx * head_r * 0.33, -head_r * 0.86, head_r * 1.0), (head_r * 0.07 * s, head_r * 0.03, head_r * 0.075 * s), seg=6, rings=4))


def father(name="Father", loc=(0, 0, 0), yaw=0.0):
    m = mats()
    pp = Puppet(name, Proportions(height=1.76)).build(loc, yaw)
    _body(pp, cloth_arms="ochre")
    _kimono_top(pp, "ochre", belt="charcoal")
    _hakama(pp, "indigo")
    head_r = pp.dims["H"] * 0.065
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.01, head_r * 1.15), (head_r * 0.86, head_r * 0.9, head_r * 0.62), seg=12, rings=8))
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.02, head_r * 1.85), (head_r * 0.18, head_r * 0.42, head_r * 0.15), seg=8, rings=6))
    _eyes(pp, head_r)
    pp.finish(m)
    return pp


def mother(name="Mother", loc=(0, 0, 0), yaw=0.0):
    m = mats()
    pp = Puppet(name, Proportions(height=1.6, shoulder_w=0.105, hip_w=0.05)).build(loc, yaw)
    _body(pp, cloth_arms="rose", legs=False)
    _kimono_top(pp, "rose", belt="cream", chest_scale=0.92)
    _long_robe(pp, "rose", flare=0.17)
    head_r = pp.dims["H"] * 0.065
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.01, head_r * 1.15), (head_r * 0.9, head_r * 0.95, head_r * 0.7), seg=12, rings=8))
    pp.part_mat("head", "hair").add(*ellipsoid((0, head_r * 0.7, head_r * 1.5), (head_r * 0.55, head_r * 0.5, head_r * 0.45), seg=10, rings=6))
    pp.part_mat("head", "gold").add(*tube((-head_r * 0.9, head_r * 0.7, head_r * 1.7), (head_r * 0.9, head_r * 0.7, head_r * 1.5), 0.005, 0.005, 4))
    _eyes(pp, head_r)
    pp.finish(m)
    return pp


def villager(name, loc=(0, 0, 0), yaw=0.0, seed=0):
    m = mats()
    rnd = random.Random(seed)
    pp = Puppet(name, Proportions(height=rnd.uniform(1.55, 1.75))).build(loc, yaw)
    cloth = rnd.choice(("indigo", "ochre", "cream", "charcoal"))
    _body(pp, cloth_arms=cloth)
    _kimono_top(pp, cloth)
    _hakama(pp, rnd.choice(("indigo", "charcoal")))
    head_r = pp.dims["H"] * 0.065
    pp.part_mat("head", "hair").add(*ellipsoid((0, 0.01, head_r * 1.15), (head_r * 0.86, head_r * 0.9, head_r * 0.62), seg=10, rings=6))
    pp.finish(m)
    return pp


def follower(name, loc=(0, 0, 0), yaw=0.0, seed=0):
    """Kurogane-style samurai: black robe, horned kabuto, masked, katana."""
    m = mats()
    rnd = random.Random(seed)
    pp = Puppet(name, Proportions(height=rnd.uniform(1.75, 1.85))).build(loc, yaw)
    _body(pp, skin="black_metal", cloth_arms="black_cloth", feet="black_cloth")
    _kimono_top(pp, "black_cloth", belt="black_cloth")
    _long_robe(pp, "black_cloth", flare=0.2)
    H = pp.dims["H"]
    head_r = H * 0.065
    hm = pp.part_mat("head", "black_metal")
    hm.add(*ellipsoid((0, 0, head_r * 1.2), (head_r * 1.15, head_r * 1.15, head_r * 0.9), seg=14, rings=8))
    hm.add(*tube((0, 0.01, head_r * 0.95), (0, 0.04, head_r * 0.1), head_r * 1.25, head_r * 1.55, 14))
    g = pp.part_mat("head", "gold")
    g.add(*curved_spike((0, -head_r, head_r * 1.6), (0, -0.1, 1), head_r * 2.2, head_r * 0.22, segs=4))
    for sx in (-1, 1):
        g.add(*curved_spike((sx * head_r * 0.5, -head_r * 0.9, head_r * 1.5), (sx * 0.8, -0.2, 1), head_r * 2.0, head_r * 0.2, bend=Vector((sx * 0.02, 0, -0.03)), segs=4))
    _katana(pp.part_mat("wrist_r", "steel"), (0, -0.02, -0.06), (0, -0.15, -1), length=0.85)
    pp.finish(m)
    return pp


def nethrak(name="Nethrak", loc=(0, 0, 0), yaw=0.0):
    """Leader: conical steel hat, skull face, red eyes, white robe with crimson flames, oversized red blade."""
    m = mats()
    pp = Puppet(name, Proportions(height=1.98, shoulder_w=0.13)).build(loc, yaw)
    _body(pp, skin="black_cloth", cloth_arms="white_robe", legs=False, feet="black_cloth")
    _kimono_top(pp, "white_robe", belt="charcoal", chest_scale=1.08)
    _long_robe(pp, "white_robe", flare=0.27, hem_key="crimson")
    H = pp.dims["H"]
    head_r = H * 0.062
    # skull face
    pp.part_mat("head", "bone").add(*ellipsoid((0, -0.01, head_r * 0.95), (head_r * 0.8, head_r * 0.85, head_r * 0.98), seg=14, rings=10))
    pp.part_mat("head", "black_cloth").add(*ellipsoid((0, -head_r * 0.6, head_r * 0.45), (head_r * 0.5, head_r * 0.3, head_r * 0.2), seg=8, rings=5))
    for sx in (-1, 1):
        pp.part_mat("head", "black_cloth").add(*ellipsoid((sx * head_r * 0.33, -head_r * 0.62, head_r * 1.05), (head_r * 0.22, head_r * 0.2, head_r * 0.2), seg=8, rings=5))
    _eyes(pp, head_r * 1.08, glow="red_glow")
    # conical steel hat (jingasa)
    pp.part_mat("head", "steel").add(*spike((0, 0, head_r * 1.5), (0, 0, head_r * 2.9), head_r * 8.0, head_r * 8.0, sides=20))
    # high collar
    pp.part_mat("chest", "white_robe").add(*tube((0, 0, pp.dims["torso"] * 0.42), (0, 0, pp.dims["torso"] * 0.62), H * 0.07, H * 0.085, 12))
    # oversized red blade in the right hand
    mb = pp.part_mat("wrist_r", "charcoal")
    mb.add(*tube((0, -0.0, 0.18), (0, 0, -0.1), 0.022, 0.022, 6))
    pp.part_mat("wrist_r", "red_blade").add(*box((0, 0, -0.85), (0.02, 0.11, 1.5)))
    pp.part_mat("wrist_r", "red_blade").add(*spike((0, 0, -1.6), (0, 0.05, -1.82), 0.02, 0.11, sides=4))
    # extra sheathed blades at the back
    for z in (0.0, 0.1):
        pp.part_mat("hips", "black_metal").add(*tube((-0.45, 0.2, z), (0.5, 0.25, z - 0.05), 0.025, 0.025, 6))
    pp.finish(m)
    return pp


def kairo_adult(name="Kairo", loc=(0, 0, 0), yaw=0.0):
    """Adult main character: black armour, horned helm, shadow scarf, katana."""
    m = mats()
    pp = Puppet(name, Proportions(height=1.8, shoulder_w=0.125)).build(loc, yaw)
    _body(pp, skin="black_metal", cloth_arms="black_metal", feet="black_metal")
    _kimono_top(pp, "black_metal", belt="charcoal", wide_sleeves=False, chest_scale=1.05)
    _hakama(pp, "black_cloth")
    H = pp.dims["H"]
    head_r = H * 0.065
    hm = pp.part_mat("head", "black_metal")
    hm.add(*ellipsoid((0, 0, head_r * 1.05), (head_r * 0.95, head_r * 1.0, head_r * 1.08), seg=14, rings=10))
    for sx in (-1, 1):
        hm.add(*curved_spike((sx * head_r * 0.5, -head_r * 0.2, head_r * 1.7), (sx * 0.5, 0.1, 1), head_r * 1.8, head_r * 0.25, bend=Vector((sx * 0.02, 0.04, -0.02)), segs=4))
        pp.part_mat(f"shoulder_{'l' if sx > 0 else 'r'}", "black_metal").add(*spike((0, 0, 0.02), (sx * 0.03, 0, 0.16), 0.12, 0.1, sides=4))
    # visor slit
    pp.part_mat("head", "charcoal").add(*box((0, -head_r * 0.95, head_r * 1.0), (head_r * 1.2, 0.01, head_r * 0.12)))
    # shadow scarf flowing from the neck
    sc = pp.part_mat("neck", "shadow_scarf")
    sc.add(*tube((0, 0, 0.0), (0, 0, 0.07), H * 0.045, H * 0.05, 10))
    sc.add(*curved_spike((0, 0.06, 0.03), (0.25, 1, -0.15), 1.15, 0.2, bend=Vector((0.35, 0.15, -0.35)), segs=8, thickness=0.025))
    sc.add(*curved_spike((0.03, 0.06, 0.0), (-0.3, 1, -0.4), 0.8, 0.14, bend=Vector((-0.25, 0.1, -0.2)), segs=6, thickness=0.02))
    _katana(pp.part_mat("wrist_r", "steel"), (0, -0.02, -0.06), (0, -0.2, -1), length=0.9)
    pp.finish(m)
    return pp


def vargash(name="Vargash", loc=(0, 0, 0), yaw=0.0, scale=1.6):
    """Winged bat-wolf (the beast that breaks the gate)."""
    m = mats()
    pp = Puppet(name, Proportions(height=2.6 * scale, head=0.12, leg=0.42, torso=0.32, shoulder_w=0.15, hip_w=0.07, arm=0.42)).build(loc, yaw)
    _body(pp, skin="hide", limb_r=0.07, feet="fur")
    H = pp.dims["H"]
    t = pp.dims["torso"]
    pp.part_mat("chest", "hide").add(*ellipsoid((0, 0, t * 0.2), (H * 0.17, H * 0.11, t * 0.48), seg=14, rings=8))
    pp.part_mat("spine", "hide").add(*ellipsoid((0, 0, t * 0.2), (H * 0.12, H * 0.09, t * 0.32), seg=12, rings=8))
    pp.part_mat("chest", "fur").add(*ellipsoid((0, 0.03, t * 0.48), (H * 0.15, H * 0.1, t * 0.22), seg=12, rings=6))
    pp.part_mat("hips", "black_cloth").add(*tube((0, 0, 0.05), (0, 0, -H * 0.1), H * 0.13, H * 0.15, 12))
    for s in ("l", "r"):
        pp.part_mat(f"thigh_{s}", "black_cloth").add(*tube((0, 0, 0), (0, 0, -pp.dims["thigh"]), H * 0.075, H * 0.07, 10))
    pp.part_mat("hips", "orange").add(*box((0, -H * 0.12, -H * 0.12), (H * 0.08, 0.02, H * 0.2)))
    head_r = H * 0.06
    pp.part_mat("head", "fur").add(*ellipsoid((0, 0, head_r), (head_r * 1.1, head_r * 1.0, head_r * 1.0), seg=12, rings=8))
    pp.part_mat("head", "fur").add(*spike((0, -head_r * 0.6, head_r * 0.8), (0, -head_r * 2.0, head_r * 0.6), head_r * 0.9, head_r * 0.7, sides=6))
    for sx in (-1, 1):
        pp.part_mat("head", "fur").add(*spike((sx * head_r * 0.6, 0, head_r * 1.6), (sx * head_r * 0.9, 0.02, head_r * 2.8), head_r * 0.45, head_r * 0.2))
        pp.part_mat("head", "beast_eye").add(*ellipsoid((sx * head_r * 0.42, -head_r * 0.85, head_r * 1.15), (head_r * 0.12, head_r * 0.05, head_r * 0.07), seg=6, rings=4))
        # wings: membrane fans from the shoulder blades
        wing = pp.part_mat("chest", "wing")
        base = Vector((sx * H * 0.08, H * 0.06, t * 0.4))
        tips = [base + Vector((sx * H * (0.35 + 0.15 * k), H * 0.1, H * (0.42 - 0.2 * k))) for k in range(4)]
        for a, b in zip(tips, tips[1:]):
            wing.add([base, a, b], [(0, 1, 2), (0, 2, 1)])
        bones = pp.part_mat("chest", "fur")
        for tp in tips:
            bones.add(*tube(base, tp, 0.03, 0.012, 5))
        pp.part_mat("chest", "orange").add(*curved_spike(tips[0], (sx * 0.2, 0, 1), H * 0.12, 0.05, segs=3))
    # tail
    pp.part_mat("hips", "fur").add(*curved_spike((0, H * 0.05, -H * 0.05), (0, 1, -0.6), H * 0.4, H * 0.06, bend=Vector((0, 0.1, -0.2)), segs=6))
    # bone gauntlet on the left arm
    pp.part_mat("elbow_l", "cream").add(*tube((0, 0, 0), (0, 0, -pp.dims["fore"]), H * 0.06, H * 0.065, 8))
    pp.finish(m)
    return pp


def charm_object(mb, center, r=0.025):
    """Wooden charm disc (placeholder keepsake)."""
    mb.add(*tube(Vector(center) + Vector((0, -0.004, 0)), Vector(center) + Vector((0, 0.004, 0)), r, r, 14))


class Hand:
    """Close-up hand: palm plus four two-segment fingers and a thumb on joints.

    Palm faces -Z at rest (fingers along +Y). curl(frame, k) bends all
    fingers by k (0 open, 1 fist).
    """

    def __init__(self, name, loc, size=0.09, mat="skin", sleeve=None, flip=1):
        import bpy as _bpy

        from rig import _empty

        m = mats()
        self.root = _empty(f"{name}_root", None, loc)
        self.root.rotation_mode = "XYZ"
        self.f = []
        s = size
        palm = MeshBuilderLocal()
        palm.add(*ellipsoid((0, s * 0.45, 0), (s * 0.46, s * 0.55, s * 0.16), seg=12, rings=8))
        palm.add(*tube((0, -s * 0.05, 0), (0, -s * 0.9, 0), s * 0.32, s * 0.36, 10))
        ob = palm.build(f"{name}_palm", m[mat], smooth=True)
        ob.parent = self.root
        if sleeve:
            sl = MeshBuilderLocal()
            sl.add(*tube((0, -s * 0.6, 0), (0, -s * 3.0, 0), s * 0.5, s * 0.9, 12))
            o2 = sl.build(f"{name}_sleeve", m[sleeve], smooth=True)
            o2.parent = self.root
        for i in range(4):
            x = (-0.3 + i * 0.2) * s * flip
            j1 = _empty(f"{name}_f{i}a", self.root, (x, s * 0.95, 0))
            j2 = _empty(f"{name}_f{i}b", j1, (0, s * 0.36, 0))
            ln = s * (0.36 - 0.04 * abs(i - 1.5))
            for j, L in ((j1, ln), (j2, ln * 0.85)):
                mb = MeshBuilderLocal()
                mb.add(*tube((0, 0, 0), (0, L, 0), s * 0.075, s * 0.062, 8))
                mb.add(*ellipsoid((0, L, 0), (s * 0.062, s * 0.062, s * 0.062), seg=6, rings=4))
                fo = mb.build(f"{j.name}_mesh", m[mat], smooth=True)
                fo.parent = j
                j.rotation_mode = "XYZ"
            self.f.append((j1, j2))
        tj = _empty(f"{name}_thumb", self.root, (-0.42 * s * flip, s * 0.25, -s * 0.05))
        tj.rotation_mode = "XYZ"
        tb = MeshBuilderLocal()
        tb.add(*tube((0, 0, 0), (-0.2 * s * flip, s * 0.42, -s * 0.05), s * 0.085, s * 0.07, 8))
        to = tb.build(f"{name}_thumb_mesh", m[mat], smooth=True)
        to.parent = tj
        self.thumb = tj
        self.flip = flip

    def curl(self, frame, k, spread=0.0):
        import math as _m

        for i, (a, b) in enumerate(self.f):
            a.rotation_euler = (_m.radians(-80 * k), 0, _m.radians((i - 1.5) * spread * 6))
            b.rotation_euler = (_m.radians(-95 * k), 0, 0)
            a.keyframe_insert("rotation_euler", frame=frame)
            b.keyframe_insert("rotation_euler", frame=frame)
        self.thumb.rotation_euler = (_m.radians(-30 * k), 0, _m.radians(-40 * k * self.flip))
        self.thumb.keyframe_insert("rotation_euler", frame=frame)

    def place(self, frame, loc=None, rot=None):
        import math as _m

        if loc is not None:
            self.root.location = loc
            self.root.keyframe_insert("location", frame=frame)
        if rot is not None:
            self.root.rotation_euler = tuple(_m.radians(r) for r in rot)
            self.root.keyframe_insert("rotation_euler", frame=frame)


def MeshBuilderLocal():
    from lib import MeshBuilder

    return MeshBuilder()
