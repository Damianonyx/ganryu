"""Small shared helpers for film shots."""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

from lib import look_at


def rock(name, loc, size, mat, detail=4, strength=0.2, scale=1.0):
    """Displaced ico-sphere rock/mountain. `strength` is in local (pre-scale) units."""
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
    mod.texture_coords = "LOCAL"
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return ob


def cam_path(cam, keys, target=None, lens=None):
    """keys: [(frame, (x, y, z), (tx, ty, tz) or None, lens or None), ...]."""
    for f, loc, tgt, ln in keys:
        cam.location = loc
        cam.keyframe_insert("location", frame=f)
        if tgt is not None:
            look_at(cam, tgt)
            cam.keyframe_insert("rotation_euler", frame=f)
        if ln is not None:
            cam.data.lens = ln
            cam.data.keyframe_insert("lens", frame=f)


def shake(cam, f0, f1, amount=0.6):
    """Short decaying camera shake (degrees) between f0 and f1."""
    base = tuple(cam.rotation_euler)
    cam.keyframe_insert("rotation_euler", frame=f0)
    n = max(2, (f1 - f0) // 2)
    for i in range(1, n):
        f = f0 + i * 2
        k = 1 - i / n
        a = math.radians(amount * k * (1 if i % 2 else -1))
        cam.rotation_euler = (base[0] + a, base[1], base[2] + a * 0.7)
        cam.keyframe_insert("rotation_euler", frame=f)
    cam.rotation_euler = base
    cam.keyframe_insert("rotation_euler", frame=f1)


def at(sec, shot_start):
    """Film seconds → local frame number inside a shot starting at `shot_start`."""
    return int(round((sec - shot_start) * 24)) + 1


def vec(*a):
    return Vector(a)
