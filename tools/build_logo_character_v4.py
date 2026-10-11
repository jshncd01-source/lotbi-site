"""Build the home 3D character (v4) in the shape of the official LOTBI logo character.

SITE-AVATAR-LOGO-ALIGN-01, second pass. The owner's reference is the logo
character, assets/brand/lotbi-mark-512.png (the same character as the header
lockup, the 404 mascot and the app splash). The first pass (v3) only recoloured
the approved V5 model, and next to the logo it still read as a different
character: small round head, upright round body standing on a floor shadow,
small ears, thin crest, thin pale eyes, small badge, tube arms.

v4 rebuilds every visible shape from measurements of the logo picture, while
keeping what makes it move:

* kept from V5: the rig -- Rig_Root/Body/Head/LeftArm/RightArm, their rest
  transforms and parenting -- all 13 animations byte for byte, every node and
  mesh name, the materials the runtime looks up (EyeCyanGlow, VisorDeepBlack),
  no mouth, no morph targets;
* moved: the two eye pivots (Rig_LeftEye/Rig_RightEye) to the centre of the new
  eyes, so a blink still closes each eye on itself (eye clips only scale and
  rotate them, never translate);
* rebuilt from the logo: a wide helmet head, a large black visor, thick glowing
  blue arc eyes (core + soft halo), big red/blue ear pods, a thick curved red
  horn on a white stalk, a bean-shaped body that ends in a rounded tail to the
  lower left (no feet), a wing arm down-left and a paddle arm raised to the
  right, a large red-to-blue chest badge with a glowing white rim. The head and
  horn lean 7 degrees like the logo.

Logo measurements (512 px picture, x right, y down) are mapped to model space
(Z-up, -Y toward the viewer, +X to the viewer's right) by X = (x - 267) * K and
Z = TOP - y * K, so the horn tip lands inside the site camera frame and the
tail ends above its bottom edge (see frame check in the validator).

Deterministic: numpy float32 output from fixed parameters -- the same V5 input
gives the same bytes.

    python tools/build_logo_character_v4.py \
        assets/models/lotbi-faithful-v2-rigged.glb \
        assets/models/lotbi-logo-character-v4-rigged.glb
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np


# ---------------------------------------------------------------- colours ----

def srgb_to_linear(hex_colour: str) -> np.ndarray:
    c = np.array([int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)], dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# Measured on lotbi-mark-512.png: ear/horn/badge red #F5576F, ear/badge blue
# #3A8DFD, eye glow #1474E6 with a near-white core. Lit and tone mapped on the
# site, a lighter red lands on the logo red (checked by rendering).
LOGO_RED = srgb_to_linear("#F5576F")
LOGO_BLUE = srgb_to_linear("#3A8DFD")
LIT_RED = srgb_to_linear("#FF6A82")
BASE_RED = srgb_to_linear("#E23A57")   # lit + tone mapped -> about #F5576F on screen
BASE_BLUE = srgb_to_linear("#1F74F0")
EAR_BLUE = srgb_to_linear("#3C8EFF")
EYE_CORE = srgb_to_linear("#DDEEFF")
EYE_GLOW = srgb_to_linear("#1474E6")
VISOR = srgb_to_linear("#0B0F1A")
JOINT = srgb_to_linear("#3A4356")
WHITE = np.array([0.985, 0.992, 1.0])
PINK_TINT = srgb_to_linear("#FFD3DD")
BLUE_TINT = srgb_to_linear("#D2E4FF")


# ------------------------------------------------------- logo -> model map ----

K = 0.0054            # model units per logo pixel
TOP = 2.33            # model Z of the logo's top row (horn tip)
CX = 267              # logo x of the head centre


def logo(x_px: float, y_px: float) -> tuple[float, float]:
    return (x_px - CX) * K, TOP - y_px * K


# Rig pivots of the approved V5 asset (kept).
HEAD_PIVOT = np.array([0.0, 0.0, 1.46])
LEFT_EYE_V5 = np.array([-0.205, -0.676, 1.43])

# Head: logo helmet 335 x 220 px centred at (267, 195), leaning 7 degrees (the
# viewer's right side lower: ears at y 204 / 233, eyes at y 205 / 219).
HEAD_C = np.array([0.0, 0.0, logo(267, 195)[1]])
HEAD_R = np.array([0.94, 0.70, 0.665])
HEAD_E_FRONT, HEAD_E_CROSS = 2.08, 2.0
ROLL = np.radians(7.0)

# Visor: 254 x 178 px, a little below the head centre.
VISOR_HALF = np.array([0.675, 0.525])
VISOR_CZ = -0.085
VISOR_E = 2.35

# Eyes: arcs 55 px wide, 9 px thick, centres 113 px apart.
EYE_X = 57 * K
EYE_R = 27 * K
EYE_CZ = -0.215          # arc circle centre below the head centre (unrolled)
EYE_TUBE = 0.028
EYE_HALO = (0.056, 0.088)
EYE_ARC = (np.radians(8.0), np.radians(172.0))

# Ears: pods about 0.6 x 0.5 head units, sunk into the head sides.
EAR_R = np.array([0.17, 0.28, 0.33])
EAR_CZ = -0.10

GRID = dict(head=(72, 40), ear=(40, 22), body=64)


# ------------------------------------------------------------------ glb io ----

COMPONENT = {5126: (np.float32, 4), 5123: (np.uint16, 2), 5125: (np.uint32, 4), 5121: (np.uint8, 1)}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack("<4sII", raw[:12])
    if magic != b"glTF" or version != 2:
        raise SystemExit("not a glTF 2.0 binary")
    json_len, json_type = struct.unpack("<I4s", raw[12:20])
    doc = json.loads(raw[20:20 + json_len])
    bin_len, bin_type = struct.unpack("<I4s", raw[20 + json_len:28 + json_len])
    if json_type != b"JSON" or bin_type != b"BIN\x00":
        raise SystemExit("unexpected chunk layout")
    return raw, doc, raw[28 + json_len:28 + json_len + bin_len]


def accessor_array(doc, blob, index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    dtype, _ = COMPONENT[acc["componentType"]]
    width = WIDTH[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride")
    if stride and stride != width * np.dtype(dtype).itemsize:
        raise SystemExit("interleaved buffers are not expected in this asset")
    arr = np.frombuffer(blob, dtype=dtype, count=acc["count"] * width, offset=start)
    return arr.reshape(acc["count"], width).copy() if width > 1 else arr.copy()


def write_glb(doc, arrays: list[np.ndarray], path: Path) -> bytes:
    """Pack every accessor into one tight buffer, one bufferView per accessor."""
    chunks, views, offset = [], [], 0
    for index, acc in enumerate(doc["accessors"]):
        dtype, _ = COMPONENT[acc["componentType"]]
        data = np.ascontiguousarray(arrays[index], dtype=dtype)
        pad = (-offset) % 4
        if pad:
            chunks.append(b"\x00" * pad)
            offset += pad
        body = data.tobytes()
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(body)}
        if acc.get("_target"):
            view["target"] = acc.pop("_target")
        views.append(view)
        acc["bufferView"] = index
        acc.pop("byteOffset", None)
        acc["count"] = int(data.shape[0])
        if acc["type"] == "VEC3" and acc["componentType"] == 5126 and "min" in acc:
            acc["min"] = [float(v) for v in data.min(axis=0)]
            acc["max"] = [float(v) for v in data.max(axis=0)]
        elif acc["type"] == "SCALAR" and "min" in acc:
            acc["min"] = [float(data.min())]
            acc["max"] = [float(data.max())]
        chunks.append(body)
        offset += len(body)
    pad = (-offset) % 4
    if pad:
        chunks.append(b"\x00" * pad)
        offset += pad
    doc["bufferViews"] = views
    doc["buffers"] = [{"byteLength": offset}]
    json_bytes = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    blob = b"".join(chunks)
    out = (struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_bytes) + 8 + len(blob))
           + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
           + struct.pack("<I4s", len(blob), b"BIN\x00") + blob)
    path.write_bytes(out)
    return out


# --------------------------------------------------------------- geometry ----

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def spow(v, p):
    return np.sign(v) * np.abs(v) ** p


def catmull(points, values, samples):
    """Smooth interpolation through (points, values) -- Catmull-Rom on a sorted axis."""
    points = np.asarray(points, float)
    values = np.asarray(values, float)
    out = np.empty_like(samples, dtype=float)
    for i, s in enumerate(samples):
        k = int(np.clip(np.searchsorted(points, s) - 1, 0, len(points) - 2))
        p0, p1 = points[k], points[k + 1]
        v1, v2 = values[k], values[k + 1]
        v0 = values[k - 1] if k > 0 else 2 * v1 - v2
        v3 = values[k + 2] if k + 2 < len(values) else 2 * v2 - v1
        t = (s - p0) / (p1 - p0)
        out[i] = 0.5 * ((2 * v1) + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t
                        + (-v0 + 3 * v1 - 3 * v2 + v3) * t ** 3)
    return out


def vertex_normals(positions, faces):
    a, b, c = (positions[faces[:, k]] for k in range(3))
    face = np.cross(b - a, c - a)
    normals = np.zeros_like(positions)
    for k in range(3):
        np.add.at(normals, faces[:, k], face)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    return normals / np.where(length == 0, 1, length)


def ring_faces(rings: int, ring: int, south: int | None, north: int | None):
    """Faces for `rings` stacked rings of `ring` vertices (wrapping), plus pole fans."""
    faces = []
    for i in range(rings - 1):
        for k in range(ring):
            a, b = i * ring + k, i * ring + (k + 1) % ring
            c, d = a + ring, b + ring
            faces += [(a, b, c), (b, d, c)]
    if south is not None:
        faces += [(south, (k + 1) % ring, k) for k in range(ring)]
    if north is not None:
        top = (rings - 1) * ring
        faces += [(north, top + k, top + (k + 1) % ring) for k in range(ring)]
    return np.asarray(faces, dtype=np.int64)


def outward(positions, faces, centre):
    """Flip the winding if the mesh's normals point inward."""
    normals = vertex_normals(positions, faces)
    if np.mean(np.sum(normals * (positions - centre), axis=1)) < 0:
        faces = faces[:, ::-1].copy()
    return faces


def superellipsoid(radii, e_front, e_cross, nu, nv):
    """Closed superellipsoid around the origin, z up, single pole vertices."""
    m1, m2 = 2.0 / e_front, 2.0 / e_cross
    v = np.linspace(-np.pi / 2, np.pi / 2, nv + 1)[1:-1]
    u = np.linspace(-np.pi, np.pi, nu, endpoint=False)
    vv, uu = np.meshgrid(v, u, indexing="ij")
    ring = np.stack([radii[0] * spow(np.cos(vv), m1) * spow(np.cos(uu), m2),
                     radii[1] * spow(np.cos(vv), m1) * spow(np.sin(uu), m2),
                     radii[2] * spow(np.sin(vv), m1)], axis=-1).reshape(-1, 3)
    positions = np.vstack([ring, [[0, 0, -radii[2]], [0, 0, radii[2]]]])
    faces = ring_faces(nv - 1, nu, len(ring), len(ring) + 1)
    return positions, outward(positions, faces, np.zeros(3))


def head_front_y(x, z):
    """Front (-Y) surface of the head shell at head-local (x, z), unrolled."""
    ef, ec = HEAD_E_FRONT, HEAD_E_CROSS
    t = np.clip(1 - np.abs(z / HEAD_R[2]) ** ef, 0, None)
    h = np.clip(t ** (ec / ef) - np.abs(x / HEAD_R[0]) ** ec, 0, None)
    return -HEAD_R[1] * h ** (1 / ec)


def visor_rho(x, z):
    return (np.abs(x / VISOR_HALF[0]) ** VISOR_E + np.abs((z - VISOR_CZ) / VISOR_HALF[1]) ** VISOR_E) ** (1 / VISOR_E)


def visor_lift(rho):
    # A raised glass plate: 0.022 proud of the shell, its edge dropping steeply
    # into it (a shallow crossing would show a jagged line).
    return 0.022 * (1 - smoothstep(0.90, 1.0, rho)) - 0.010 * smoothstep(0.97, 1.0, rho)


def visor_bezel(ring=10):
    """A thin light rim along the visor outline, on the shell (hides the seam)."""
    theta = np.linspace(-np.pi, np.pi, 160, endpoint=False)
    m = 2.0 / VISOR_E
    x = VISOR_HALF[0] * 1.004 * spow(np.cos(theta), m)
    z = VISOR_CZ + VISOR_HALF[1] * 1.004 * spow(np.sin(theta), m)
    y = head_front_y(x, z) + 0.002
    centre = np.stack([x, y, z], axis=-1)
    centre = np.vstack([centre, centre[:1]])
    pos, faces = tube(centre, np.full(len(centre), 0.016), np.array([0.0, -1.0, 0.0]), ring=ring, caps=False)
    model = roll_head(pos)
    return model, vertex_normals(model, faces), np.tile(srgb_to_linear("#E3E8F0"), (len(model), 1)), faces


def roll_head(points):
    """Head-local (unrolled, centred) -> model space, leaning the right side down."""
    c, s = np.cos(ROLL), np.sin(ROLL)
    p = np.asarray(points, float)
    out = np.empty_like(p)
    out[..., 0] = c * p[..., 0] + s * p[..., 2]
    out[..., 1] = p[..., 1]
    out[..., 2] = -s * p[..., 0] + c * p[..., 2]
    return out + HEAD_C


def tube(centre, radius, normal_hint, ring=16, caps=True, squash=1.0):
    """Tube along a centreline with per-point radius and rounded ends (caps).

    ``normal_hint`` picks the first cross-section axis; ``squash`` scales the
    radius along it (a flat ribbon-like glow when < 1).
    """
    centre = np.asarray(centre, float)
    radius = np.asarray(radius, float)
    tangent = np.gradient(centre, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
    hint = np.asarray(normal_hint, float)
    if hint.ndim == 1:
        hint = np.tile(hint, (len(centre), 1))
    n1 = hint - np.sum(hint * tangent, axis=1, keepdims=True) * tangent
    n1 /= np.linalg.norm(n1, axis=1, keepdims=True)
    n2 = np.cross(tangent, n1)
    poles = None
    if caps:
        poles = (centre[0] - tangent[0] * radius[0], centre[-1] + tangent[-1] * radius[-1])
        ang = np.linspace(0, np.pi / 2, 6)[1:-1]
        head = [(centre[0] - tangent[0] * radius[0] * np.sin(a), radius[0] * np.cos(a)) for a in ang[::-1]]
        tail = [(centre[-1] + tangent[-1] * radius[-1] * np.sin(a), radius[-1] * np.cos(a)) for a in ang]
        idx = [0] * len(head) + list(range(len(centre))) + [len(centre) - 1] * len(tail)
        centre = np.vstack([[h[0] for h in head], centre, [t[0] for t in tail]])
        radius = np.concatenate([[h[1] for h in head], radius, [t[1] for t in tail]])
        n1, n2 = n1[idx], n2[idx]
    phi = np.linspace(0, 2 * np.pi, ring, endpoint=False)
    rings = (centre[:, None, :]
             + radius[:, None, None] * (squash * np.cos(phi)[None, :, None] * n1[:, None, :]
                                        + np.sin(phi)[None, :, None] * n2[:, None, :])).reshape(-1, 3)
    if caps:
        positions = np.vstack([rings, poles[0], poles[1]])
        faces = ring_faces(len(centre), ring, len(rings), len(rings) + 1)
    else:
        positions = rings
        faces = ring_faces(len(centre), ring, None, None)
    normals = vertex_normals(positions, faces)
    ref = np.repeat(centre, ring, axis=0)
    if np.mean(np.sum(normals[:len(ref)] * (positions[:len(ref)] - ref), axis=1)) < 0:
        faces = faces[:, ::-1].copy()
    return positions, faces


def paddle(root, tip, width_axis_hint, width, thickness, taper=(0.7, 1.0), nu=36, nv=24):
    """A rounded paddle (flattened ellipsoid) from root to tip, wider at the tip."""
    root, tip = np.asarray(root, float), np.asarray(tip, float)
    axis = tip - root
    length = np.linalg.norm(axis)
    e1 = axis / length
    e2 = np.asarray(width_axis_hint, float)
    e2 = e2 - e2.dot(e1) * e1
    e2 /= np.linalg.norm(e2)
    e3 = np.cross(e1, e2)
    v = np.linspace(-np.pi / 2, np.pi / 2, nv + 1)[1:-1]
    u = np.linspace(-np.pi, np.pi, nu, endpoint=False)
    vv, uu = np.meshgrid(v, u, indexing="ij")
    along = np.sin(vv)                      # -1 root .. 1 tip
    side, depth = np.cos(vv) * np.cos(uu), np.cos(vv) * np.sin(uu)
    grow = taper[0] + (taper[1] - taper[0]) * (along + 1) / 2
    local = (root + e1 * (length / 2) * (along[..., None] + 1)
             + e2 * (width / 2) * (side * grow)[..., None]
             + e3 * (thickness / 2) * (depth * (0.6 + 0.4 * grow))[..., None]).reshape(-1, 3)
    positions = np.vstack([local, root[None, :], tip[None, :]])
    faces = ring_faces(nv - 1, nu, len(local), len(local) + 1)
    return positions, outward(positions, faces, (root + tip) / 2)


# ----------------------------------------------------------------- parts ----

def head_shell():
    pos, faces = superellipsoid(HEAD_R, HEAD_E_FRONT, HEAD_E_CROSS, *GRID["head"])
    model = roll_head(pos)
    n = vertex_normals(model, faces)
    # Faint iridescence like the logo: pink on the lower left, blue on the right.
    pink = 0.10 * smoothstep(0.35, 0.95, -n[:, 0]) * smoothstep(0.2, -0.6, n[:, 2])
    blue = 0.12 * smoothstep(0.35, 0.95, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    return model, n, colours, faces


def visor():
    nr, nt = 22, 120
    rho = np.linspace(0, 1, nr + 1)[1:]
    theta = np.linspace(-np.pi, np.pi, nt, endpoint=False)
    rr, tt = np.meshgrid(rho, theta, indexing="ij")
    m = 2.0 / VISOR_E
    x = VISOR_HALF[0] * rr * spow(np.cos(tt), m)
    z = VISOR_CZ + VISOR_HALF[1] * rr * spow(np.sin(tt), m)
    y = head_front_y(x, z) - visor_lift(rr)
    ring = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    centre = np.array([[0.0, head_front_y(0.0, VISOR_CZ) - visor_lift(0.0), VISOR_CZ]])
    local = np.vstack([ring, centre])
    faces = []
    for i in range(nr - 1):
        for k in range(nt):
            a, b = i * nt + k, i * nt + (k + 1) % nt
            faces += [(a, c := a + nt, b), (b, c, b + nt)]
    faces += [(len(ring), k, (k + 1) % nt) for k in range(nt)]
    faces = np.asarray(faces, dtype=np.int64)
    model = roll_head(local)
    n = vertex_normals(model, faces)
    if np.mean(n[:, 1]) > 0:
        faces = faces[:, ::-1].copy()
        n = -n
    colours = np.tile(VISOR, (len(model), 1))
    return model, n, colours, faces


def eye(side: float, radius_scale: float = 1.0, ring=12):
    """One ^-shaped arc on the visor, side -1 = viewer's left. Halos (scale > 1)
    are flattened onto the glass so the glow spreads over the visor."""
    phi = np.linspace(EYE_ARC[0], EYE_ARC[1], 40)
    x = side * EYE_X + EYE_R * np.cos(phi)
    z = EYE_CZ + EYE_R * np.sin(phi)
    y = head_front_y(x, z) - visor_lift(visor_rho(x, z)) - 0.010
    centre = np.stack([x, y, z], axis=-1)
    squash = 1.0 if radius_scale == 1.0 else 0.30 / radius_scale
    pos, faces = tube(centre, np.full(len(phi), EYE_TUBE * radius_scale), np.array([0.0, -1.0, 0.0]),
                      ring=ring, squash=squash)
    return roll_head(pos), faces


def eye_pivot(side: float):
    z = EYE_CZ + EYE_R * 0.55
    return roll_head(np.array([side * EYE_X, head_front_y(side * EYE_X, z) - 0.02, z]))


def ear(side: float, colour):
    pos, faces = superellipsoid(EAR_R, 2.3, 2.6, *GRID["ear"])
    half_width = HEAD_R[0] * (1 - abs(EAR_CZ / HEAD_R[2]) ** HEAD_E_FRONT) ** (1 / HEAD_E_FRONT)
    pos = pos + np.array([side * (half_width - 0.035), 0.03, EAR_CZ])
    model = roll_head(pos)
    n = vertex_normals(model, faces)
    lighter = 0.10 * smoothstep(0.3, 0.95, n[:, 2])        # top highlight tint
    colours = colour * (1 - lighter)[:, None] + WHITE * lighter[:, None]
    return model, n, colours, faces


def horn():
    """The logo's thick red horn: blunt left end over the stalk, tip up-right."""
    t = np.linspace(0, 1, 48)
    p = [np.array(v, float) for v in ((logo(272, 58)[0], 0.0, logo(272, 58)[1]),
                                     (logo(312, 44)[0], 0.0, logo(312, 44)[1]),
                                     (logo(348, 36)[0], 0.0, logo(348, 36)[1]),
                                     (logo(363, 5)[0], 0.0, logo(363, 5)[1]))]
    u = 1 - t
    centre = (u ** 3)[:, None] * p[0] + (3 * u * u * t)[:, None] * p[1] + (3 * u * t * t)[:, None] * p[2] + (t ** 3)[:, None] * p[3]
    half = 0.118 * (1 - t) ** 0.75 + 0.012
    pos, faces = tube(centre, half, np.array([0.0, 0.0, 1.0]), ring=24)
    # Flatten front-to-back a little (the logo horn is a fin, not a cone).
    pos[:, 1] *= 0.86
    n = vertex_normals(pos, faces)
    along = np.interp(pos[:, 0], [centre[0, 0], centre[-1, 0]], [0.0, 1.0])
    white = 0.40 * (1 - smoothstep(0.02, 0.18, along)) * smoothstep(0.0, -0.8, n[:, 2])
    blue = 0.45 * smoothstep(0.15, 0.85, -n[:, 2]) * smoothstep(0.15, 0.35, along) * (1 - smoothstep(0.5, 0.75, along))
    colours = BASE_RED * (1 - white - blue)[:, None] + WHITE * white[:, None] + LOGO_BLUE * blue[:, None]
    return pos, n, colours, faces


def stalk():
    """White stalk from the crown up into the horn."""
    bottom = np.array([logo(306, 98)[0], 0.0, logo(306, 98)[1]])
    top = np.array([logo(312, 58)[0], 0.0, logo(312, 58)[1]])
    t = np.linspace(0, 1, 16)
    centre = bottom + (top - bottom) * t[:, None]
    radius = 0.145 - 0.035 * t
    pos, faces = tube(centre, radius, np.array([1.0, 0.0, 0.0]), ring=28)
    n = vertex_normals(pos, faces)
    return pos, n, np.tile(WHITE, (len(pos), 1)), faces


def body():
    """Bean-shaped body: under the head, widest low, a rounded tail to the lower left."""
    top_z, z_c, cap_h, cap_r = 1.05, -0.10, 0.30, 0.50
    zs = np.linspace(top_z, z_c, 34)
    radius = catmull([-0.10, 0.15, 0.45, 0.72, 1.05], [0.500, 0.495, 0.440, 0.360, 0.30], zs)
    cx = catmull([-0.10, 0.15, 0.45, 0.72, 1.05], [-0.22, -0.12, -0.04, 0.0, 0.02], zs)
    belly = catmull([-0.10, 0.15, 0.45, 0.72, 1.05], [-0.02, -0.04, -0.03, -0.01, 0.0], zs)
    alpha = np.linspace(0, np.pi / 2, 14)[1:-1]
    zs = np.concatenate([zs, z_c - cap_h * np.sin(alpha)])
    radius = np.concatenate([radius, cap_r * np.cos(alpha)])
    cx = np.concatenate([cx, -0.22 - 0.08 * np.sin(alpha)])
    belly = np.concatenate([belly, -0.02 * np.cos(alpha)])
    seg = GRID["body"]
    phi = np.linspace(-np.pi, np.pi, seg, endpoint=False)
    ring = np.stack([cx[:, None] + radius[:, None] * np.cos(phi)[None, :],
                     belly[:, None] + 0.84 * radius[:, None] * np.sin(phi)[None, :],
                     np.repeat(zs[:, None], seg, axis=1)], axis=-1).reshape(-1, 3)
    # rings run top -> bottom; poles: top (hidden in the head) and the tail tip
    top = np.array([cx[0], belly[0], top_z + 0.02])
    tail = np.array([-0.30, -0.02, z_c - cap_h])
    positions = np.vstack([ring, top, tail])
    faces = ring_faces(len(zs), seg, len(ring), len(ring) + 1)
    faces = outward(positions, faces, np.array([-0.08, 0.0, 0.3]))
    n = vertex_normals(positions, faces)
    pink = 0.14 * smoothstep(0.25, 0.95, -n[:, 0]) * smoothstep(0.6, -0.2, positions[:, 2])
    blue = 0.12 * smoothstep(0.3, 0.95, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    return positions, n, colours, faces


def body_surface(x, z):
    """Front point and normal of the body near (x, z) (for the badge)."""
    pos, n, _, _ = BODY
    front = pos[(pos[:, 1] < 0)]
    normals = n[(pos[:, 1] < 0)]
    d = (front[:, 0] - x) ** 2 + (front[:, 2] - z) ** 2
    k = np.argsort(d)[:6]
    w = 1 / (d[k] + 1e-6)
    return (front[k] * w[:, None]).sum(0) / w.sum(), (normals[k] * w[:, None]).sum(0) / w.sum()


def badge():
    cx, cz = logo(249, 381)
    point, normal = body_surface(cx, cz)
    normal /= np.linalg.norm(normal)
    e1 = np.cross(np.array([0.0, 0.0, 1.0]), normal)
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(normal, e1)
    radius = 28 * K
    nr, nt = 10, 72
    rho = np.linspace(0, 1, nr + 1)[1:]
    theta = np.linspace(0, 2 * np.pi, nt, endpoint=False)
    rr, tt = np.meshgrid(rho, theta, indexing="ij")
    dome = 0.014 + 0.010 * (1 - rr ** 2)
    ring = (point + (radius * rr * np.cos(tt))[..., None] * e1 + (radius * rr * np.sin(tt))[..., None] * e2
            + dome[..., None] * normal).reshape(-1, 3)
    centre = point + 0.024 * normal
    positions = np.vstack([ring, centre])
    faces = []
    for i in range(nr - 1):
        for k in range(nt):
            a, b = i * nt + k, i * nt + (k + 1) % nt
            faces += [(a, b, a + nt), (b, b + nt, a + nt)]
    faces += [(len(ring), (k + 1) % nt, k) for k in range(nt)]
    faces = np.asarray(faces, dtype=np.int64)
    n = vertex_normals(positions, faces)
    if np.dot(n.mean(0), normal) < 0:
        faces = faces[:, ::-1].copy()
        n = -n
    s = smoothstep(-0.75, 0.75, (positions - point) @ e1 / radius)
    colours = LOGO_RED * (1 - s)[:, None] + LOGO_BLUE * s[:, None]
    rim_centre = point + (radius + 0.004) * (np.cos(theta)[:, None] * e1 + np.sin(theta)[:, None] * e2) + 0.016 * normal
    rim_centre = np.vstack([rim_centre, rim_centre[:1]])
    return (positions, n, colours, faces), (rim_centre, normal)


def badge_rim(rim_centre, normal, radius, ring=10):
    pos, faces = tube(rim_centre, np.full(len(rim_centre), radius), normal, ring=ring, caps=False)
    return pos, faces


def arm(side: float):
    if side < 0:   # the logo's wing: down and out to the viewer's left
        root = np.array([logo(170, 332)[0], -0.06, logo(170, 332)[1]])
        tip = np.array([logo(70, 400)[0], -0.16, logo(70, 400)[1]])
        width_hint = np.array([0.35, 0.0, 0.94])
        pos, faces = paddle(root, tip, width_hint, width=0.27, thickness=0.09, taper=(0.72, 1.0))
    else:          # the waving paddle raised to the viewer's right
        root = np.array([logo(334, 338)[0], -0.08, logo(334, 338)[1]])
        tip = np.array([logo(446, 288)[0], -0.14, logo(446, 288)[1]])
        width_hint = np.array([-0.2, 0.0, 1.0])
        pos, faces = paddle(root, tip, width_hint, width=0.33, thickness=0.12, taper=(0.70, 1.0))
    n = vertex_normals(pos, faces)
    pink = (0.16 if side < 0 else 0.0) * smoothstep(0.2, 0.9, -n[:, 2])
    blue = (0.10 if side > 0 else 0.0) * smoothstep(0.2, 0.9, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    return pos, n, colours, faces, root, tip


def joint(root, tip):
    axis = (tip - root) / np.linalg.norm(tip - root)
    centre = root + axis * 0.05
    pos, faces = superellipsoid(np.array([0.03, 0.045, 0.065]), 2.0, 2.0, 24, 12)
    # orient: local z along a vertical-ish ring around the arm root
    zax = np.cross(axis, np.array([0.0, 1.0, 0.0]))
    zax /= np.linalg.norm(zax)
    yax = np.cross(zax, axis)
    rot = np.stack([axis, yax, zax], axis=1)
    model = pos @ rot.T + centre
    n = vertex_normals(model, faces)
    return model, n, np.tile(JOINT, (len(model), 1)), faces


# ------------------------------------------------------------------ build ----

BODY = None


def build(source: Path, target: Path) -> dict:
    global BODY
    raw, doc, blob = read_glb(source)
    arrays = [accessor_array(doc, blob, i) for i in range(len(doc["accessors"]))]
    nodes = {n["name"]: n for n in doc["nodes"]}
    meshes = {m["name"]: m for m in doc["meshes"]}
    materials = {m["name"]: i for i, m in enumerate(doc["materials"])}

    def add_material(spec):
        doc["materials"].append(spec)
        materials[spec["name"]] = len(doc["materials"]) - 1
        return materials[spec["name"]]

    def add_accessor(data, kind):
        data = np.asarray(data)
        if kind == "index":
            dtype = np.uint16 if data.max() < 65535 else np.uint32
            acc = {"componentType": 5123 if dtype is np.uint16 else 5125, "type": "SCALAR", "_target": 34963}
            arrays.append(data.reshape(-1).astype(dtype))
        else:
            acc = {"componentType": 5126, "type": "VEC3", "_target": 34962}
            if kind == "position":
                acc["min"], acc["max"] = [0, 0, 0], [0, 0, 0]
            arrays.append(data.astype(np.float32))
        acc["bufferView"] = 0
        doc["accessors"].append(acc)
        return len(doc["accessors"]) - 1

    def primitive(positions, normals, colours, faces, material):
        if normals is None:
            normals = vertex_normals(positions, faces)
        if colours is None:
            colours = np.ones_like(positions)
        return {"attributes": {"POSITION": add_accessor(positions, "position"),
                               "NORMAL": add_accessor(normals, "normal"),
                               "COLOR_0": add_accessor(colours, "colour")},
                "indices": add_accessor(faces, "index"), "material": material}

    def set_mesh(name, *prims):
        meshes[name]["primitives"] = list(prims)

    # Materials: tune the existing ones, add the glow halos (unlit, blended).
    mats = doc["materials"]
    mats[materials["GlossyWhite"]]["emissiveFactor"] = [0.07, 0.072, 0.08]
    mats[materials["VisorDeepBlack"]]["pbrMetallicRoughness"].update(metallicFactor=0.2, roughnessFactor=0.06)
    mats[materials["EyeCyanGlow"]]["emissiveFactor"] = [0.34, 0.60, 0.95]     # x2.2..3.9 at runtime: near-white blue core
    mats[materials["AccentPink"]]["emissiveFactor"] = [float(v) for v in (LOGO_RED * 0.10).round(4)]
    mats[materials["AccentBlue"]]["emissiveFactor"] = [float(v) for v in (LOGO_BLUE * 0.10).round(4)]
    mats[materials["ContinuousGradientGloss"]]["emissiveFactor"] = [0.0, 0.0, 0.0]
    unlit = {"KHR_materials_unlit": {}}
    halo_inner = add_material({"name": "EyeGlowHaloInner", "pbrMetallicRoughness": {
        "baseColorFactor": [0.0, 0.0, 0.0, 0.95], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "emissiveFactor": [0.02, 0.26, 0.95], "alphaMode": "BLEND"})
    halo_outer = add_material({"name": "EyeGlowHaloOuter", "pbrMetallicRoughness": {
        "baseColorFactor": [0.0, 0.0, 0.0, 0.40], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "emissiveFactor": [0.02, 0.20, 0.85], "alphaMode": "BLEND"})
    rim_glow = add_material({"name": "BadgeRimGlow", "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.2},
        "emissiveFactor": [0.55, 0.75, 1.0]})
    badge_face = add_material({"name": "BadgeGradientUnlit", "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 1.0}, "extensions": unlit})
    rim_halo = add_material({"name": "BadgeRimHalo", "pbrMetallicRoughness": {
        "baseColorFactor": [0.55, 0.80, 1.0, 0.45], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "alphaMode": "BLEND", "extensions": unlit})
    doc["extensionsUsed"] = sorted(set(doc.get("extensionsUsed", [])) | {"KHR_materials_unlit"})

    white, visor_m, eye_m = materials["GlossyWhite"], materials["VisorDeepBlack"], materials["EyeCyanGlow"]
    gloss = materials["ContinuousGradientGloss"]

    # Head (children of Rig_Head; mesh nodes keep their V5 offsets, so the
    # vertices are in model space).
    set_mesh("HeadShell", primitive(*head_shell(), white))
    set_mesh("Visor", primitive(*visor(), visor_m), primitive(*visor_bezel(), white))
    set_mesh("LeftEarPink", primitive(*ear(-1.0, BASE_RED), materials["AccentPink"]))
    set_mesh("RightEarBlue", primitive(*ear(1.0, BASE_BLUE), materials["AccentBlue"]))
    set_mesh("CrestContinuousGradient", primitive(*horn(), gloss))
    set_mesh("CrestWhiteBase", primitive(*stalk(), white))

    # Eyes: core + two soft halos, all under the eye pivots, which move to the
    # new eye centres (the eye mesh nodes cancel the pivot so vertices stay in
    # model space).
    for name, rig, side in (("LeftEye", "Rig_LeftEye", -1.0), ("RightEye", "Rig_RightEye", 1.0)):
        pos, faces = eye(side)
        core_colour = np.tile(EYE_CORE, (len(pos), 1))
        prims = [primitive(pos, None, core_colour, faces, eye_m)]
        for scale, mat in ((EYE_HALO[0] / EYE_TUBE, halo_inner), (EYE_HALO[1] / EYE_TUBE, halo_outer)):
            hpos, hfaces = eye(side, scale, ring=12)
            prims.append(primitive(hpos, None, None, hfaces, mat))
        set_mesh(name, *prims)
        pivot = eye_pivot(side)
        nodes[rig]["translation"] = [float(v) for v in np.round(pivot - HEAD_PIVOT, 6)]
        nodes[name]["translation"] = [float(v) for v in np.round(-pivot, 6)]

    # Body, badge (children of Rig_Body).
    BODY = body()
    set_mesh("SlimDropletTorso", primitive(*BODY, white))
    (badge_geo, (rim_centre, normal)) = badge()
    set_mesh("BadgeContinuousGradient", primitive(*badge_geo, badge_face))
    rim_pos, rim_faces = badge_rim(rim_centre, normal, 0.016)
    halo_pos, halo_faces = badge_rim(rim_centre, normal, 0.036)
    set_mesh("BadgeGlowRim", primitive(rim_pos, None, np.tile(WHITE, (len(rim_pos), 1)), rim_faces, rim_glow),
             primitive(halo_pos, None, None, halo_faces, rim_halo))

    # Arms + joints (children of Rig_LeftArm / Rig_RightArm).
    for mesh_name, joint_name, side in (("LeftArm", "LeftShoulderJoint", -1.0), ("RightWaveArm", "RightShoulderJoint", 1.0)):
        pos, n, colours, faces, root, tip = arm(side)
        set_mesh(mesh_name, primitive(pos, n, colours, faces, white))
        set_mesh(joint_name, primitive(*joint(root, tip), materials["JointDark"]))

    # Drop accessors the new meshes no longer use (keep animation data).
    used = set()
    for m in doc["meshes"]:
        for p in m["primitives"]:
            used.update(p["attributes"].values())
            used.add(p["indices"])
    for a in doc["animations"]:
        for s in a["samplers"]:
            used.update((s["input"], s["output"]))
    remap, kept_acc, kept_arr = {}, [], []
    for i, acc in enumerate(doc["accessors"]):
        if i in used:
            remap[i] = len(kept_acc)
            kept_acc.append(acc)
            kept_arr.append(arrays[i])
    doc["accessors"] = kept_acc
    for m in doc["meshes"]:
        for p in m["primitives"]:
            p["attributes"] = {k: remap[v] for k, v in p["attributes"].items()}
            p["indices"] = remap[p["indices"]]
    for a in doc["animations"]:
        for s in a["samplers"]:
            s["input"], s["output"] = remap[s["input"]], remap[s["output"]]
    old_views = {i: v for i, v in enumerate(doc["bufferViews"])}
    for acc in doc["accessors"]:
        if "_target" not in acc:
            view = old_views.get(acc["bufferView"], {})
            if "target" in view:
                acc["_target"] = view["target"]

    source_sha = hashlib.sha256(raw).hexdigest()
    logo_path = Path(__file__).resolve().parent.parent / "assets/brand/lotbi-mark-512.png"
    extras = doc["asset"].setdefault("extras", {})
    extras.update({
        "visualTarget": "assets/brand/lotbi-mark-512.png (official logo character, header lockup)",
        "visualTargetSha256": hashlib.sha256(logo_path.read_bytes()).hexdigest(),
        "visualStatus": "LOGO_CHARACTER_V4_OWNER_REVIEW",
        "derivedFrom": "assets/models/lotbi-faithful-v2-rigged.glb",
        "derivedFromSha256": source_sha,
        "logoAlignment": "all visible shapes rebuilt from the logo picture; rig, nodes and 13 animations of V5 kept, eye pivots moved to the new eyes",
        "mouth": False,
    })
    doc["asset"]["generator"] = "LOTBI tools/build_logo_character_v4.py (logo character on the V5 rig)"
    out = write_glb(doc, kept_arr, target)
    return {"source_sha256": source_sha, "target": str(target),
            "target_sha256": hashlib.sha256(out).hexdigest(), "bytes": len(out)}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2])), indent=1))
