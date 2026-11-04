"""
Procedural character builds for the cinematic test shots.

`build_thorn_antagonist` follows the turnaround sheet supplied by the
project owner (spined crown, beaked red helmet, layered thorn-shard armour,
tattered robe, red veins, four chains ending in glowing sickle talons). It is
a blockout for staging and lighting — the final in-game model should replace
it. The samurai, protagonist, and monster builders are generic placeholders.
"""

from __future__ import annotations

import math
import random

import bpy
from mathutils import Matrix, Vector

from lib import (
    MeshBuilder,
    curved_spike,
    ellipsoid,
    gradient_material,
    principled,
    spike,
    torus_link,
    tube,
)


def _root(name, origin, rot_z, scale):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = origin
    root.rotation_euler = (0, 0, rot_z)
    root.scale = (scale, scale, scale)
    return root


def build_thorn_antagonist(origin=(0, 0, 0), rot_z=0.0, scale=1.0, seed=7, sway=0.0):
    """Front faces -Y. Height to crown tip ≈ 3.3 m before scaling."""
    rnd = random.Random(seed)
    root = _root("ThornAntagonist", origin, rot_z, scale)

    shard_mat = gradient_material(
        "ThornShard", bottom=(0.035, 0.01, 0.012), top=(0.2, 0.19, 0.2), rough=0.5, metal=0.3, lo=0.0, hi=0.55, coat=0.2
    )
    shard_red = principled("ThornShardRed", (0.16, 0.01, 0.015), rough=0.4, metal=0.2, coat=0.4)
    body_mat = principled("ThornBody", (0.035, 0.004, 0.005), rough=0.5, emit=(0.6, 0.02, 0.01), emit_strength=0.06)
    lacquer = principled("ThornLacquer", (0.3, 0.012, 0.018), rough=0.25, metal=0.1, coat=0.8)
    vein = principled("ThornVein", (0.5, 0.02, 0.01), rough=0.3, emit=(1.0, 0.06, 0.02), emit_strength=6.0)
    chain_mat = principled("ThornChain", (0.22, 0.03, 0.03), rough=0.32, metal=0.85)
    blade_mat = gradient_material(
        "ThornBlade",
        bottom=(0.9, 0.28, 0.05),
        top=(0.35, 0.01, 0.01),
        rough=0.18,
        metal=0.2,
        emit_bottom=(1.0, 0.32, 0.04),
        emit_top=(0.45, 0.0, 0.0),
        emit_strength=3.2,
        lo=0.1,
        hi=0.8,
    )

    body = MeshBuilder()
    shards = MeshBuilder()
    reds = MeshBuilder()
    lac = MeshBuilder()
    veins = MeshBuilder()
    chains = MeshBuilder()
    blades = MeshBuilder()

    # --- torso
    tc = Vector((0, 0, 1.95))
    tr = (0.24, 0.16, 0.42)
    body.add(*ellipsoid(tc, tr, seg=18, rings=12))
    body.add(*ellipsoid((0, 0, 1.5), (0.2, 0.15, 0.18), seg=14, rings=8))
    for _ in range(420):
        th = rnd.uniform(0.08, 0.95) * math.pi
        ph = rnd.uniform(0, 2 * math.pi)
        n = Vector((math.sin(th) * math.cos(ph) / tr[0], math.sin(th) * math.sin(ph) / tr[1], math.cos(th) / tr[2])).normalized()
        p = tc + Vector((math.sin(th) * math.cos(ph) * tr[0], math.sin(th) * math.sin(ph) * tr[1], math.cos(th) * tr[2]))
        if abs(p.x) < 0.035 and p.y < 0:
            continue  # leave the red sternum ridge visible
        d = (n * 0.75 + Vector((0, 0, -0.65)) + Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 0))).normalized()
        ln = rnd.uniform(0.16, 0.36)
        w = rnd.uniform(0.09, 0.17)
        target = reds if rnd.random() < 0.1 else shards
        target.add(*spike(p - n * 0.02, p + d * ln, w, w * 0.22, up_hint=n))
    # sternum ridge and veins
    for i in range(14):
        z = 2.3 - i * 0.07
        p = Vector((0, -0.16 * math.sin(math.acos(max(-1, min(1, (z - tc.z) / tr[2])))) - 0.005, z))
        veins.add(*spike(p, p + Vector((0, -0.05, -0.05)), 0.035, 0.02))
    for sx in (-1, 1):
        pts = [Vector((sx * (0.04 + 0.05 * k), -0.13 + 0.01 * k, 2.15 - 0.12 * k)) for k in range(5)]
        for a, b in zip(pts, pts[1:]):
            veins.add(*tube(a, b, 0.008, 0.006, 5))

    # --- shoulders: big shard clusters
    for sx in (-1, 1):
        sc = Vector((sx * 0.3, 0, 2.3))
        body.add(*ellipsoid(sc, (0.1, 0.1, 0.09), seg=10, rings=6))
        for _ in range(55):
            d = Vector((sx * rnd.uniform(0.3, 1.0), rnd.uniform(-0.5, 0.5), rnd.uniform(-0.2, 0.9))).normalized()
            ln = rnd.uniform(0.18, 0.4)
            w = rnd.uniform(0.09, 0.16)
            shards.add(*spike(sc + d * 0.06, sc + d * ln, w, w * 0.25))

    # --- neck + head (high collar of shards)
    body.add(*tube((0, 0, 2.33), (0, -0.04, 2.66), 0.06, 0.05, 8))
    for _ in range(40):
        a = rnd.uniform(0, 2 * math.pi)
        out = Vector((math.cos(a), math.sin(a) * 0.8, 0))
        p = Vector((0, -0.02, rnd.uniform(2.3, 2.5))) + out * 0.08
        d = (out * 0.5 + Vector((0, 0, 1))).normalized()
        shards.add(*spike(p, p + d * rnd.uniform(0.15, 0.28), 0.08, 0.02, up_hint=out))
    tilt = Matrix.Rotation(0.38, 3, "X")
    head_c = Vector((0, -0.05, 2.8))
    lac.add(*ellipsoid(head_c, (0.13, 0.17, 0.16), rot=tilt, seg=18, rings=12))
    # beaked face plate
    lac.add(*curved_spike(head_c + Vector((0, -0.12, -0.04)), (0, -0.35, -1), 0.3, 0.13, bend=Vector((0, 0.05, 0)), segs=5, thickness=0.09, sides=6))
    for sx in (-1, 1):
        veins.add(*spike(head_c + Vector((sx * 0.055, -0.155, -0.01)), head_c + Vector((sx * 0.1, -0.13, 0.01)), 0.02, 0.012))
    # spined crown radiating around the head
    crown_c = head_c + Vector((0, 0.04, 0.06))
    n_sp = 11
    for i in range(n_sp):
        a = math.radians(-105 + 210 * i / (n_sp - 1)) + rnd.uniform(-0.06, 0.06)
        centred = 1 - abs(a) / math.radians(110)
        ln = 0.32 + 0.5 * centred * rnd.uniform(0.75, 1.1)
        d = Vector((math.sin(a), 0.15 + 0.15 * rnd.random(), math.cos(a))).normalized()
        lac.add(*spike(crown_c + d * 0.08, crown_c + d * (0.1 + ln), 0.06, 0.05, sides=6))
    for _ in range(10):
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-0.3, 1), rnd.uniform(0.3, 1))).normalized()
        lac.add(*spike(head_c + d * 0.13, head_c + d * rnd.uniform(0.2, 0.3), 0.025, 0.02))

    # --- arms, hands, wrist horns
    hands = []
    for sx in (-1, 1):
        S = Vector((sx * 0.33, 0, 2.27))
        E = Vector((sx * 0.47, -0.02 + sway * 0.05, 1.82))
        H = Vector((sx * 0.52, -0.12 + sway * 0.08, 1.4))
        hands.append((sx, H))
        body.add(*tube(S, E, 0.075, 0.06, 8))
        body.add(*tube(E, H, 0.06, 0.05, 8))
        for seg_a, seg_b in ((S, E), (E, H)):
            for _ in range(45):
                k = rnd.random()
                p = seg_a.lerp(seg_b, k)
                out = Vector((sx, rnd.uniform(-0.6, 0.4), rnd.uniform(-0.2, 0.3))).normalized()
                d = (out * 0.6 + (seg_b - seg_a).normalized() * 0.8).normalized()
                w = rnd.uniform(0.07, 0.12)
                shards.add(*spike(p, p + d * rnd.uniform(0.12, 0.26), w, w * 0.25))
        lac.add(*ellipsoid(H, (0.07, 0.065, 0.075), seg=12, rings=8))
        for f in range(4):
            base = H + Vector((sx * 0.02, -0.05 + 0.03 * f, -0.04))
            lac.add(*curved_spike(base, (0, -0.4, -1), 0.09, 0.025, bend=Vector((0, 0.04, 0)), segs=3, sides=4))
        lac.add(*curved_spike(H + Vector((sx * 0.03, 0.02, 0.06)), (sx * 0.25, 0.05, 1), 0.34, 0.06, bend=Vector((sx * 0.1, 0, -0.02)), segs=5, sides=5))

    # --- robe: tattered shard layers to the ground
    body.add(*tube((0, 0, 1.55), (0, 0, 0.2), 0.22, 0.44, 14))
    for _ in range(900):
        z = rnd.uniform(0.2, 1.6)
        k = (1.6 - z) / 1.4
        r = 0.23 + 0.22 * k
        ph = rnd.uniform(0, 2 * math.pi)
        out = Vector((math.cos(ph), math.sin(ph) * 0.8, 0))
        p = Vector((0, 0, z)) + out * r
        d = (Vector((0, 0, -1)) + out * rnd.uniform(0.1, 0.35) + Vector((rnd.uniform(-0.1, 0.1), 0, 0))).normalized()
        ln = rnd.uniform(0.35, 0.85) * (0.6 + 0.6 * k)
        end = p + d * ln
        if end.z < 0.0:
            end.z = rnd.uniform(0.0, 0.06)
        w = rnd.uniform(0.12, 0.24)
        target = reds if rnd.random() < 0.18 else shards
        target.add(*spike(p - out * 0.02, end, w, w * 0.18, up_hint=out))

    # --- chains and sickle talons (two per hand)
    for sx, H in hands:
        for j, off in enumerate((-0.05, 0.05)):
            start = H + Vector((sx * 0.01 + off * 0.3, -0.03, -0.07))
            end = Vector((H.x + sx * (0.02 + 0.1 * j) + sway * 0.05, H.y - 0.05 + off, 0.68))
            n_links = int((start - end).length / 0.042)
            axis = (end - start).normalized()
            prev = None
            for i in range(n_links):
                c = start.lerp(end, (i + 0.5) / n_links)
                c.x += sx * 0.03 * math.sin(math.pi * i / n_links)
                hint = Vector((1, 0, 0)) if i % 2 == 0 else Vector((0, 1, 0))
                chains.add(*torus_link(c, axis, 0.012, 0.0055, hint, seg=8, sides=4))
                if i % 3 == 1:
                    for t in range(2):
                        out = Vector((math.cos(i + t * 3.1), math.sin(i + t * 3.1), 0))
                        chains.add(*spike(c, c + out * 0.035, 0.008, 0.008, sides=3))
                prev = c
            # spiked collar
            lac.add(*ellipsoid(end, (0.035, 0.035, 0.045), seg=8, rings=6))
            for t in range(5):
                a = 2 * math.pi * t / 5
                out = Vector((math.cos(a), math.sin(a), 0.4)).normalized()
                lac.add(*spike(end, end + out * 0.07, 0.015, 0.015, sides=3))
            # the talon: hangs, then hooks outward and up
            outward = Vector((sx * (0.7 + 0.3 * j), -0.25 + 0.5 * j, 0)).normalized()
            hint = outward.cross(Vector((0, 0, 1))).normalized()
            blades.add(*curved_spike(end, (0, 0, -1), 0.62, 0.15, bend=outward * 0.42 + Vector((0, 0, 0.2)), segs=10, thickness=0.02, sides=4, up_hint=hint))
            for b in range(3):
                bp = end + Vector((0, 0, -0.1 - 0.1 * b)) + outward * 0.02 * b * b
                lac.add(*spike(bp, bp - outward * 0.06 + Vector((0, 0, 0.03)), 0.02, 0.01, sides=3))

    for mb, name, mat, smooth in (
        (body, "ThornBodyMesh", body_mat, True),
        (shards, "ThornShards", shard_mat, False),
        (reds, "ThornRedShards", shard_red, False),
        (lac, "ThornLacquerMesh", lacquer, True),
        (veins, "ThornVeins", vein, False),
        (chains, "ThornChains", chain_mat, False),
        (blades, "ThornBlades", blade_mat, True),
    ):
        mb.build(name, mat, smooth=smooth, parent=root)
    return root


def samurai_silhouette(mb: MeshBuilder, base, height=1.75, facing=-math.pi / 2, rnd=None, sword=True, crest=True):
    """Generic armoured samurai, low detail (background figures)."""
    rnd = rnd or random.Random(1)
    b = Vector(base)
    R = Matrix.Rotation(facing + math.pi / 2, 3, "Z")
    H = height

    def P(x, y, z):
        return b + R @ Vector((x * H, y * H, z * H))

    mb.add(*tube(P(-0.06, 0, 0), P(-0.07, 0, 0.45), 0.05 * H, 0.06 * H, 6))
    mb.add(*tube(P(0.06, 0, 0), P(0.07, 0, 0.45), 0.05 * H, 0.06 * H, 6))
    mb.add(*tube(P(0, 0, 0.12), P(0, 0, 0.55), 0.17 * H, 0.1 * H, 8))  # hakama / kusazuri
    mb.add(*ellipsoid(P(0, 0, 0.68), (0.12 * H, 0.09 * H, 0.17 * H), seg=10, rings=6))
    for sx in (-1, 1):
        mb.add(*tube(P(sx * 0.16, 0, 0.8), P(sx * 0.22, -0.04, 0.52), 0.04 * H, 0.035 * H, 6))
        v, f = spike(P(sx * 0.17, 0, 0.84), P(sx * 0.25, 0, 0.66), 0.14 * H, 0.08 * H, sides=4)
        mb.add(v, f)  # sode shoulder plates
    mb.add(*ellipsoid(P(0, 0, 0.92), (0.075 * H, 0.08 * H, 0.07 * H), seg=10, rings=6))
    mb.add(*ellipsoid(P(0, 0, 0.95), (0.11 * H, 0.11 * H, 0.06 * H), seg=10, rings=6))  # kabuto
    mb.add(*tube(P(0, 0.02, 0.9), P(0, 0.06, 0.82), 0.12 * H, 0.15 * H, 8, cap=False))  # neck guard
    if crest:
        for sx in (-1, 1):
            mb.add(*curved_spike(P(sx * 0.02, -0.06, 0.98), (sx * 0.5, -0.2, 1), 0.16 * H, 0.02 * H, bend=Vector((sx * 0.06 * H, 0, -0.02 * H)), segs=4))
    if sword:
        mb.add(*tube(P(0.22, -0.06, 0.5), P(0.3, -0.25, 1.05), 0.008 * H, 0.006 * H, 4))


def protagonist_silhouette(mb: MeshBuilder, base, height=1.78, facing=0.0, draw=1.0):
    """Placeholder adult protagonist (no final design yet): topknot, light armour, katana.

    facing: yaw in radians (0 = looks toward +Y). draw 0..1 raises the blade.
    """
    b = Vector(base)
    R = Matrix.Rotation(facing, 3, "Z")
    H = height

    def P(x, y, z):
        return b + R @ Vector((x * H, y * H, z * H))

    mb.add(*tube(P(-0.07, 0, 0), P(-0.06, 0, 0.47), 0.045 * H, 0.06 * H, 6))
    mb.add(*tube(P(0.09, 0.05, 0), P(0.06, 0, 0.47), 0.045 * H, 0.06 * H, 6))
    mb.add(*tube(P(0, 0, 0.14), P(0, 0, 0.56), 0.15 * H, 0.1 * H, 8))
    mb.add(*ellipsoid(P(0, 0, 0.69), (0.115 * H, 0.08 * H, 0.17 * H), seg=10, rings=6))
    v, f = spike(P(0.15, 0, 0.84), P(0.23, 0, 0.67), 0.13 * H, 0.07 * H)  # one sode
    mb.add(v, f)
    mb.add(*ellipsoid(P(0, 0, 0.93), (0.07 * H, 0.075 * H, 0.085 * H), seg=10, rings=6))
    mb.add(*ellipsoid(P(0, 0.03, 1.02), (0.03 * H, 0.04 * H, 0.025 * H), seg=8, rings=5))  # topknot
    mb.add(*curved_spike(P(0, 0.05, 1.01), (0, 1, -0.4), 0.2 * H, 0.03 * H, bend=Vector((0, 0.05 * H, -0.1 * H)), segs=4))
    # sword arm: from rest (blade low) to raised forward
    sh = P(0.14, 0, 0.82)
    a = math.radians(-20 + 125 * draw)
    hand = sh + R @ Vector((0.04 * H, math.sin(a) * 0.36 * H, -math.cos(a) * 0.36 * H))
    mb.add(*tube(sh, hand, 0.035 * H, 0.03 * H, 6))
    mb.add(*tube(P(-0.14, 0, 0.82), hand + R @ Vector((-0.04 * H, 0, -0.03 * H)), 0.035 * H, 0.03 * H, 6))
    blade_dir = R @ Vector((0.02, math.sin(a + 0.5), -math.cos(a + 0.5)))
    tip = hand + blade_dir.normalized() * 0.62 * H
    mb.add(*tube(hand - blade_dir.normalized() * 0.1 * H, hand, 0.015 * H, 0.015 * H, 5))
    return hand, tip


def monster_silhouette(mb: MeshBuilder, base, height=5.0, facing=0.0, rnd=None):
    rnd = rnd or random.Random(4)
    b = Vector(base)
    R = Matrix.Rotation(facing, 3, "Z")
    H = height

    def P(x, y, z):
        return b + R @ Vector((x * H, y * H, z * H))

    mb.add(*ellipsoid(P(0, 0, 0.55), (0.35 * H, 0.28 * H, 0.38 * H), seg=14, rings=8))
    mb.add(*ellipsoid(P(0, -0.15, 0.86), (0.16 * H, 0.15 * H, 0.13 * H), seg=12, rings=8))
    for sx in (-1, 1):
        mb.add(*curved_spike(P(sx * 0.1, -0.12, 0.95), (sx * 0.6, 0.1, 1), 0.35 * H, 0.06 * H, bend=Vector((sx * 0.12 * H, 0, -0.08 * H)), segs=5))
        mb.add(*tube(P(sx * 0.32, -0.05, 0.75), P(sx * 0.45, -0.2, 0.05), 0.08 * H, 0.06 * H, 6))
        mb.add(*tube(P(sx * 0.15, 0, 0.3), P(sx * 0.18, -0.05, 0), 0.09 * H, 0.08 * H, 6))
    for _ in range(30):
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(0, 1), rnd.uniform(0.2, 1))).normalized()
        p = P(0, 0, 0.6) + d * 0.33 * H
        mb.add(*spike(p, p + d * rnd.uniform(0.05, 0.14) * H, 0.04 * H, 0.04 * H))
    return [P(sx * 0.06, -0.29, 0.88) for sx in (-1, 1)]
