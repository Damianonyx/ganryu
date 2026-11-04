"""
Shared helpers for the opening-cinematic Blender shots.

Everything is generated procedurally from code (no .blend files), so shots
are reproducible and reviewable in diffs. Geometry is accumulated into a few
large meshes per material rather than thousands of objects, which keeps scene
build time low.

Run with the `bpy` Python module (Blender 5.2): see blender/README.md.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import bpy
from mathutils import Matrix, Vector

# ----------------------------------------------------------------- scene


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 2
    sc.cycles.volume_bounces = 1
    sc.cycles.transparent_max_bounces = 4
    try:
        sc.cycles.volume_step_rate = 4.0
    except AttributeError:
        pass
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Punchy"):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            continue
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.fps = 24
    sc.render.image_settings.file_format = "PNG"
    return sc


def world(color=(0.01, 0.01, 0.015), strength=1.0, top=None):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    try:
        w.use_nodes = True
    except AttributeError:
        pass
    nt = w.node_tree
    bg = nt.nodes["Background"]
    if top is None:
        bg.inputs["Color"].default_value = (*color, 1)
    else:
        # vertical gradient sky: horizon `color` → zenith `top`
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        # world Generated Z is the view direction's height: 0 = horizon, 1 = zenith
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (*color, 1)
        ramp.color_ramp.elements[1].position = 0.42
        ramp.color_ramp.elements[1].color = (*top, 1)
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    return w


def camera(loc, target, lens=35, dof_dist=None, fstop=2.8, name="Cam"):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_end = 2000
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    look_at(cam, target)
    if dof_dist is not None:
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = dof_dist
        cam_data.dof.aperture_fstop = fstop
    bpy.context.scene.camera = cam
    return cam


def look_at(obj, target):
    d = Vector(target) - Vector(obj.location)
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def light(kind, loc, energy, color=(1, 1, 1), size=1.0, target=None, name="Light"):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.size = size
    elif kind in ("POINT", "SPOT"):
        ld.shadow_soft_size = size
    elif kind == "SUN":
        ld.angle = size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    if target is not None:
        look_at(ob, target)
    return ob


# -------------------------------------------------------------- materials


def _bsdf(mat):
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    return mat.node_tree.nodes.get("Principled BSDF")


def principled(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0, sss=0.0, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def gradient_material(name, bottom, top, rough=0.5, metal=0.0, axis="Z", emit_bottom=None, emit_top=None, emit_strength=0.0, lo=0.0, hi=1.0, coat=0.0):
    """Base colour (and optional emission) ramps along a generated-coordinate axis."""
    m = principled(name, bottom, rough, metal, coat=coat)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])

    def ramp(c0, c1):
        r = nt.nodes.new("ShaderNodeValToRGB")
        r.color_ramp.elements[0].position = lo
        r.color_ramp.elements[0].color = (*c0, 1)
        r.color_ramp.elements[1].position = hi
        r.color_ramp.elements[1].color = (*c1, 1)
        nt.links.new(sep.outputs[axis], r.inputs["Fac"])
        return r

    nt.links.new(ramp(bottom, top).outputs["Color"], b.inputs["Base Color"])
    if emit_bottom is not None:
        nt.links.new(ramp(emit_bottom, emit_top).outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def flame_material(name, strength=12.0, seed=0.0):
    """Emission flame sheet: noise-shaped alpha, hot core to red edges."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Location"].default_value = (seed, seed * 0.7, 0)
    mapping.inputs["Scale"].default_value = (2.6, 1.0, 0.8)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.6
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    # fade with height: value = noise - z
    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    nt.links.new(noise.outputs["Fac"], sub.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.75
    nt.links.new(sep.outputs["Z"], mul.inputs[0])
    nt.links.new(mul.outputs[0], sub.inputs[1])
    # soften the sheet's side edges: value -= |x - 0.5| * 1.3
    xs = nt.nodes.new("ShaderNodeMath")
    xs.operation = "SUBTRACT"
    xs.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs["X"], xs.inputs[0])
    xa = nt.nodes.new("ShaderNodeMath")
    xa.operation = "ABSOLUTE"
    nt.links.new(xs.outputs[0], xa.inputs[0])
    xm = nt.nodes.new("ShaderNodeMath")
    xm.operation = "MULTIPLY"
    xm.inputs[1].default_value = 1.3
    nt.links.new(xa.outputs[0], xm.inputs[0])
    sub2 = nt.nodes.new("ShaderNodeMath")
    sub2.operation = "SUBTRACT"
    nt.links.new(sub.outputs[0], sub2.inputs[0])
    nt.links.new(xm.outputs[0], sub2.inputs[1])
    sub = sub2
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position = 0.08
    els[0].color = (0, 0, 0, 1)
    els[1].position = 0.55
    els[1].color = (1.0, 0.85, 0.45, 1)
    mid = els.new(0.22)
    mid.color = (0.9, 0.18, 0.02, 1)
    mid2 = els.new(0.36)
    mid2.color = (1.0, 0.45, 0.05, 1)
    nt.links.new(sub.outputs[0], ramp.inputs["Fac"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    # alpha mask
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "GREATER_THAN"
    mask.inputs[1].default_value = 0.1
    nt.links.new(sub.outputs[0], mask.inputs[0])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(mask.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def volume_box(name, center, size, density=0.02, color=(0.6, 0.6, 0.65), anisotropy=0.3, noise_scale=None, noise_amount=0.0):
    """Atmospheric fog (light shafts); optional noise for clouds/smoke."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Anisotropy"].default_value = anisotropy
    if noise_scale:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = noise_scale
        noise.inputs["Detail"].default_value = 4.0
        ramp = nt.nodes.new("ShaderNodeMapRange")
        ramp.inputs["From Min"].default_value = 0.45
        ramp.inputs["From Max"].default_value = 0.75
        ramp.inputs["To Min"].default_value = density * (1 - noise_amount)
        ramp.inputs["To Max"].default_value = density
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
        nt.links.new(ramp.outputs["Result"], vol.inputs["Density"])
    else:
        vol.inputs["Density"].default_value = density
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    me = bpy.data.meshes.new(name)
    sx, sy, sz = (s / 2 for s in size)
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me.from_pydata(v, [], f)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = center
    me.materials.append(m)
    return ob


# -------------------------------------------------------- mesh builder


@dataclass
class MeshBuilder:
    verts: list = field(default_factory=list)
    faces: list = field(default_factory=list)

    def add(self, verts, faces):
        o = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend([tuple(i + o for i in f) for f in faces])

    def build(self, name, mat, smooth=False, parent=None):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        me.validate()
        if smooth:
            for p in me.polygons:
                p.use_smooth = True
        if mat is not None:
            me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        if parent is not None:
            ob.parent = parent
        return ob


def _frame(direction, up_hint=Vector((0, 0, 1))):
    d = Vector(direction).normalized()
    if abs(d.dot(up_hint)) > 0.95:
        up_hint = Vector((1, 0, 0))
    x = d.cross(up_hint).normalized()
    y = x.cross(d).normalized()
    return d, x, y


def spike(base, tip, width, thickness=None, sides=4, twist=0.0, up_hint=Vector((0, 0, 1))):
    """Pyramid from a (flattened) polygon at `base` to a point at `tip`."""
    base = Vector(base)
    tip = Vector(tip)
    d, x, y = _frame(tip - base, up_hint)
    thickness = width if thickness is None else thickness
    verts = []
    for i in range(sides):
        a = twist + 2 * math.pi * i / sides
        verts.append(base + x * math.cos(a) * width * 0.5 + y * math.sin(a) * thickness * 0.5)
    verts.append(tip)
    n = sides
    faces = [(i, (i + 1) % n, n) for i in range(n)]
    faces.append(tuple(reversed(range(n))))
    return verts, faces


def curved_spike(base, direction, length, width, bend=Vector((0, 0, 0)), segs=4, thickness=None, sides=4, up_hint=Vector((0, 0, 1))):
    """A tapering horn/claw that bends toward `bend` along its length."""
    base = Vector(base)
    d = Vector(direction).normalized()
    pts = []
    for i in range(segs + 1):
        k = i / segs
        pts.append(base + d * length * k + Vector(bend) * (k * k))
    thickness = width if thickness is None else thickness
    verts, faces = [], []
    for i, p in enumerate(pts[:-1]):
        nd = (pts[i + 1] - p).normalized()
        _, x, y = _frame(nd, up_hint)
        r = 1 - i / segs
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append(p + x * math.cos(a) * width * 0.5 * r + y * math.sin(a) * thickness * 0.5 * r)
    verts.append(pts[-1])
    tip = len(verts) - 1
    for i in range(segs - 1):
        for s in range(sides):
            a, b = i * sides + s, i * sides + (s + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    last = (segs - 1) * sides
    for s in range(sides):
        faces.append((last + s, last + (s + 1) % sides, tip))
    faces.append(tuple(reversed(range(sides))))
    return verts, faces


def tube(p0, p1, r0, r1=None, sides=8, cap=True):
    p0, p1 = Vector(p0), Vector(p1)
    r1 = r0 if r1 is None else r1
    d, x, y = _frame(p1 - p0)
    verts = []
    for p, r in ((p0, r0), (p1, r1)):
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append(p + (x * math.cos(a) + y * math.sin(a)) * r)
    faces = [(s, (s + 1) % sides, sides + (s + 1) % sides, sides + s) for s in range(sides)]
    if cap:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple(range(sides, 2 * sides)))
    return verts, faces


def ellipsoid(center, radii, rot=Matrix.Identity(3), seg=16, rings=10):
    c = Vector(center)
    verts, faces = [], []
    for r in range(1, rings):
        th = math.pi * r / rings
        for s in range(seg):
            ph = 2 * math.pi * s / seg
            v = Vector((math.sin(th) * math.cos(ph) * radii[0], math.sin(th) * math.sin(ph) * radii[1], math.cos(th) * radii[2]))
            verts.append(c + rot @ v)
    top = len(verts)
    verts.append(c + rot @ Vector((0, 0, radii[2])))
    bot = len(verts)
    verts.append(c + rot @ Vector((0, 0, -radii[2])))
    for r in range(rings - 2):
        for s in range(seg):
            a = r * seg + s
            b = r * seg + (s + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    for s in range(seg):
        faces.append((top, (s + 1) % seg, s))
        o = (rings - 2) * seg
        faces.append((bot, o + s, o + (s + 1) % seg))
    return verts, faces


def box(center, size, rot_z=0.0, rot=None):
    c = Vector(center)
    sx, sy, sz = (s / 2 for s in size)
    R = rot if rot is not None else Matrix.Rotation(rot_z, 3, "Z")
    raw = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    verts = [c + R @ Vector(v) for v in raw]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return verts, faces


def torus_link(center, axis, ring_r, wire_r, plane_hint, seg=8, sides=4, stretch=1.6):
    """One chain link: an elongated torus whose long axis is `axis`."""
    c = Vector(center)
    a = Vector(axis).normalized()
    p = Vector(plane_hint)
    p = (p - a * p.dot(a)).normalized()
    q = a.cross(p)
    verts, faces = [], []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        ring_c = c + a * math.cos(t) * ring_r * stretch + p * math.sin(t) * ring_r
        tang = (-a * math.sin(t) * stretch + p * math.cos(t)).normalized()
        n1 = tang.cross(q).normalized()
        for j in range(sides):
            u = 2 * math.pi * j / sides
            verts.append(ring_c + (n1 * math.cos(u) + q * math.sin(u)) * wire_r)
    for i in range(seg):
        for j in range(sides):
            a0 = i * sides + j
            a1 = i * sides + (j + 1) % sides
            b0 = ((i + 1) % seg) * sides + j
            b1 = ((i + 1) % seg) * sides + (j + 1) % sides
            faces.append((a0, a1, b1, b0))
    return verts, faces


def crescent(center, facing, up, radius, width, thickness, sweep=2.4, segs=18):
    """Sickle/talon blade: a crescent in the plane spanned by `up` and `facing`."""
    c = Vector(center)
    u = Vector(up).normalized()
    f = Vector(facing).normalized()
    n = u.cross(f).normalized()
    outer, inner = [], []
    for i in range(segs + 1):
        k = i / segs
        ang = -math.pi / 2 + k * sweep
        w = width * math.sin(math.pi * min(1.0, k * 1.15)) ** 0.7
        dirv = f * math.cos(ang) + u * math.sin(ang)
        outer.append(c + dirv * radius)
        inner.append(c + dirv * (radius - w) + f * w * 0.25)
    verts, faces = [], []
    for side in (-1, 1):
        for i in range(segs + 1):
            verts.append(outer[i] + n * thickness * 0.5 * side * (1 - i / segs))
            verts.append(inner[i] + n * thickness * 0.5 * side * (1 - i / segs))
    m = 2 * (segs + 1)
    for i in range(segs):
        o0, i0, o1, i1 = 2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3
        faces.append((o0, o1, i1, i0))
        faces.append((m + o0, m + i0, m + i1, m + o1))
        faces.append((o0, m + o0, m + o1, o1))
        faces.append((i0, i1, m + i1, m + i0))
    return verts, faces


# ---------------------------------------------------------- scenery


def ground(size=200, mat=None, z=0.0, noise=0.0, res=80, seed=1):
    rnd = random.Random(seed)
    mb = MeshBuilder()
    h = size / 2
    verts = []
    for j in range(res + 1):
        for i in range(res + 1):
            x = -h + size * i / res
            y = -h + size * j / res
            zz = z + (noise * (math.sin(x * 0.3 + seed) * math.cos(y * 0.25) + rnd.uniform(-0.3, 0.3)) if noise else 0)
            verts.append((x, y, zz))
    faces = []
    for j in range(res):
        for i in range(res):
            a = j * (res + 1) + i
            faces.append((a, a + 1, a + res + 2, a + res + 1))
    mb.add(verts, faces)
    return mb.build("Ground", mat, smooth=True)


def pine(mb: MeshBuilder, base, height, rnd: random.Random):
    b = Vector(base)
    mb.add(*tube(b, b + Vector((0, 0, height * 0.35)), height * 0.025, height * 0.02, 6))
    tiers = 5
    for i in range(tiers):
        z = height * (0.22 + 0.16 * i)
        r = height * (0.3 - 0.05 * i) * rnd.uniform(0.85, 1.1)
        v, f = spike(b + Vector((0, 0, z)), b + Vector((0, 0, z + height * 0.32)), r * 2, r * 2, sides=7, twist=rnd.uniform(0, 1))
        mb.add(v, f)


def house(mb_wall: MeshBuilder, mb_roof: MeshBuilder, mb_wood: MeshBuilder, center, w, d, h, rot_z=0.0):
    """Minka-style house: walls, posts, and a flared hip roof."""
    c = Vector(center)
    R = Matrix.Rotation(rot_z, 3, "Z")
    mb_wall.add(*box(c + Vector((0, 0, h / 2)), (w, d, h), rot_z))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mb_wood.add(*box(c + R @ Vector((sx * w / 2, sy * d / 2, h / 2)), (0.16, 0.16, h + 0.1), rot_z))
    # roof: flared pyramid with an overhang
    ov = 0.55
    rh = h * 0.75
    eave = [Vector((sx * (w / 2 + ov), sy * (d / 2 + ov), h - 0.1)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    mid = [Vector((sx * (w / 2 - 0.1), sy * (d / 2 - 0.1), h + rh * 0.45)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    ridge = [Vector((-w * 0.25, 0, h + rh)), Vector((w * 0.25, 0, h + rh))]
    verts = [c + R @ v for v in eave + mid + ridge]
    faces = [
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        (4, 5, 9, 8), (5, 6, 9), (6, 7, 8, 9), (7, 4, 8),
    ]
    mb_roof.add(verts, faces)


def flame_sheet(name, loc, width, height, rot_z=0.0, strength=12.0, seed=0.0):
    me = bpy.data.meshes.new(name)
    w, h = width / 2, height
    me.from_pydata([(-w, 0, 0), (w, 0, 0), (w, 0, h), (-w, 0, h)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (0, 0, rot_z)
    me.materials.append(flame_material(name + "Mat", strength, seed))
    try:
        ob.visible_shadow = False
    except AttributeError:
        pass
    return ob


def embers(name, center, spread, count, mat, seed=3, size=0.02):
    rnd = random.Random(seed)
    mb = MeshBuilder()
    c = Vector(center)
    for _ in range(count):
        p = c + Vector((rnd.uniform(-1, 1) * spread[0], rnd.uniform(-1, 1) * spread[1], rnd.uniform(0, 1) * spread[2]))
        s = size * rnd.uniform(0.5, 1.6)
        mb.add(*box(p, (s, s, s * 2.5), rot_z=rnd.uniform(0, 3)))
    ob = mb.build(name, mat)
    try:
        ob.visible_shadow = False
    except AttributeError:
        pass
    return ob


def render(path, samples=64, res=None, frame=None):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    if res is not None:
        sc.render.resolution_x, sc.render.resolution_y = res
    if frame is not None:
        sc.frame_set(frame)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
