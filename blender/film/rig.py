"""
Joint rig for animated cinematic characters.

Each character is a hierarchy of empties (joints) with rigid mesh parts
parented to them, like a puppet. It's predictable to pose from code. At
rest every joint is world-aligned, and characters face -Y.

Pose angles are degrees:
    fwd   swing toward the character's front (rotation about -X)
    side  swing outward to the character's left/right (about ±Y)
    twist rotation about the bone's long axis (Z)

Keyframes use Bezier interpolation, so motion eases in and out.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import bpy
from mathutils import Vector

from lib import MeshBuilder

JOINTS = (
    "hips", "spine", "chest", "neck", "head",
    "shoulder_l", "elbow_l", "wrist_l", "shoulder_r", "elbow_r", "wrist_r",
    "thigh_l", "knee_l", "ankle_l", "thigh_r", "knee_r", "ankle_r",
)


@dataclass
class Proportions:
    height: float = 1.75
    head: float = 0.13  # head height fraction
    leg: float = 0.47  # hip height fraction
    torso: float = 0.3
    shoulder_w: float = 0.12  # half width fraction
    hip_w: float = 0.055
    arm: float = 0.36  # total arm length fraction
    child: bool = False


@dataclass
class Puppet:
    name: str
    p: Proportions
    root: bpy.types.Object = None
    j: dict = field(default_factory=dict)
    parts: dict = field(default_factory=dict)

    # ------------------------------------------------------------ build
    def build(self, location=(0, 0, 0), yaw=0.0):
        H = self.p.height
        self.root = _empty(f"{self.name}_root", None, location)
        self.root.rotation_euler = (0, 0, math.radians(yaw))
        hip_z = H * self.p.leg
        torso = H * self.p.torso
        thigh = hip_z * 0.52
        shin = hip_z * 0.48
        upper = H * self.p.arm * 0.52
        fore = H * self.p.arm * 0.48
        self.dims = dict(H=H, hip_z=hip_z, torso=torso, thigh=thigh, shin=shin, upper=upper, fore=fore)
        j = self.j
        j["hips"] = _empty(f"{self.name}_hips", self.root, (0, 0, hip_z))
        j["spine"] = _empty(f"{self.name}_spine", j["hips"], (0, 0, 0.0))
        j["chest"] = _empty(f"{self.name}_chest", j["spine"], (0, 0, torso * 0.5))
        j["neck"] = _empty(f"{self.name}_neck", j["chest"], (0, 0, torso * 0.5))
        j["head"] = _empty(f"{self.name}_head", j["neck"], (0, 0, H * 0.035))
        for s, sx in (("l", 1), ("r", -1)):
            j[f"shoulder_{s}"] = _empty(f"{self.name}_shoulder_{s}", j["chest"], (sx * H * self.p.shoulder_w, 0, torso * 0.42))
            j[f"elbow_{s}"] = _empty(f"{self.name}_elbow_{s}", j[f"shoulder_{s}"], (0, 0, -upper))
            j[f"wrist_{s}"] = _empty(f"{self.name}_wrist_{s}", j[f"elbow_{s}"], (0, 0, -fore))
            j[f"thigh_{s}"] = _empty(f"{self.name}_thigh_{s}", j["hips"], (sx * H * self.p.hip_w, 0, 0))
            j[f"knee_{s}"] = _empty(f"{self.name}_knee_{s}", j[f"thigh_{s}"], (0, 0, -thigh))
            j[f"ankle_{s}"] = _empty(f"{self.name}_ankle_{s}", j[f"knee_{s}"], (0, 0, -shin))
        for k in JOINTS:
            j[k].rotation_mode = "XYZ"
        return self

    def part(self, joint) -> MeshBuilder:
        """MeshBuilder in the joint's local space (origin at the joint)."""
        return self.parts.setdefault(joint, {}).setdefault("_default", MeshBuilder())

    def part_mat(self, joint, key) -> MeshBuilder:
        return self.parts.setdefault(joint, {}).setdefault(key, MeshBuilder())

    def finish(self, materials: dict, smooth=True):
        """Create the mesh objects. `materials` maps part keys to materials."""
        for joint, groups in self.parts.items():
            for key, mb in groups.items():
                if not mb.verts:
                    continue
                mat = materials.get(key, materials.get("_default"))
                ob = mb.build(f"{self.name}_{joint}_{key}", mat, smooth=smooth)
                ob.parent = self.j[joint]
        return self

    # ------------------------------------------------------------- pose
    def pose(self, frame, **kw):
        """Key a pose. Joint kwargs take (fwd, side, twist) tuples or a number (fwd).

        Special keys: loc=(x,y,z) root location, yaw=degrees root heading,
        drop=metres lowering of the hips (crouch/kneel), lean is an alias for spine.
        """
        if "loc" in kw:
            self.root.location = kw.pop("loc")
            self.root.keyframe_insert("location", frame=frame)
        if "yaw" in kw:
            self.root.rotation_euler.z = math.radians(kw.pop("yaw"))
            self.root.keyframe_insert("rotation_euler", index=2, frame=frame)
        if "drop" in kw:
            self.j["hips"].location.z = self.dims["hip_z"] - kw.pop("drop")
            self.j["hips"].keyframe_insert("location", index=2, frame=frame)
        if "lean" in kw:
            kw["spine"] = kw.pop("lean")
        for name, v in kw.items():
            ob = self.j[name]
            fwd, side, twist = (v, 0, 0) if isinstance(v, (int, float)) else (tuple(v) + (0, 0))[:3]
            sgn = -1 if name.endswith("_r") else 1
            ob.rotation_euler = (math.radians(-fwd), math.radians(side * sgn), math.radians(twist))
            ob.keyframe_insert("rotation_euler", frame=frame)

    def rest(self, frame, keep=()):
        self.pose(frame, **{k: (0, 0, 0) for k in JOINTS if k not in keep})

    # ----------------------------------------------------- procedural
    def walk(self, f0, f1, start, end, cycle=24, stride=30, arm=22, bob=0.04, lean=4, run=False):
        """Walk (or run) in a straight line from start to end between frames f0 and f1."""
        start, end = Vector(start), Vector(end)
        d = end - start
        # facing vector at yaw θ is (sin θ, -cos θ); solve for the walk direction
        yaw = math.degrees(math.atan2(d.x, -d.y)) if d.length > 1e-6 else None
        half = cycle / 2
        f = f0
        i = 0
        while f <= f1 + 1e-6:
            k = (f - f0) / max(1, (f1 - f0))
            ph = (i % 2) * 2 - 1  # alternating -1, 1
            loc = start.lerp(end, k)
            self.pose(int(round(f)), loc=tuple(loc), **({"yaw": yaw} if yaw is not None else {}))
            sw = stride * (1.5 if run else 1.0)
            self.pose(
                int(round(f)),
                thigh_l=(sw * ph, 0, 0), thigh_r=(-sw * ph, 0, 0),
                knee_l=(-(10 if ph > 0 else 35 if run else 25), 0, 0), knee_r=(-(10 if ph < 0 else 35 if run else 25), 0, 0),
                shoulder_l=(-arm * ph * (1.6 if run else 1), 6, 0), shoulder_r=(arm * ph * (1.6 if run else 1), 6, 0),
                elbow_l=(25 if run else 10, 0, 0), elbow_r=(25 if run else 10, 0, 0),
                spine=(lean * (3 if run else 1), 0, 4 * ph),
            )
            # mid-step: passing pose with a bob
            fm = int(round(f + half / 2))
            if fm <= f1:
                self.j["hips"].location.z = self.dims["hip_z"] + bob * (1.5 if run else 1)
                self.j["hips"].keyframe_insert("location", index=2, frame=fm)
                self.j["hips"].location.z = self.dims["hip_z"]
                self.j["hips"].keyframe_insert("location", index=2, frame=int(round(f)))
            f += half
            i += 1


def _empty(name, parent, loc):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.05
    bpy.context.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    ob.location = loc
    return ob


def smooth_all_keys():
    """Use Bezier with automatic clamped handles everywhere (gentle easing)."""
    for act in bpy.data.actions:
        for fc in _fcurves(act):
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"


def _fcurves(action):
    fcs = getattr(action, "fcurves", None)
    if fcs is not None:
        return list(fcs)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out
