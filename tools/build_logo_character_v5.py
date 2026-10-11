"""Build the home 3D character (v5): the official LOTBI logo character in 3D.

SITE-AVATAR-LOGO-ALIGN-02. Reference: assets/brand/lotbi-mark-512.png (the header
lockup's character). v4 (build_logo_character_v4.py) was turned back by the
owner: arms looked cut off (separate from the body, dark joint dots), the eyes
read as a thick double ring, the body as a long round capsule, the visor and
badge as flat. v5 is measured again against the logo, row by row, and checked
by overlaying an orthographic front render on the logo (same 512 px grid):

* body: the logo's pear -- narrow under the head, leaning left, widest low,
  a rounded tail to the lower left;
* arms: the left one a broad flat fin hanging down-left, attached along a long
  seam on the body's left side; the right one a big raised paddle (the waving
  hand) on the body's right side; both start inside the body, so no gap shows
  at rest or while they move, and there is no dark joint dot (the joint meshes
  are white shoulder fillets inside the seam);
* eyes: one thin glowing arc each with a soft glow spread on the glass (three
  faint layers, no hard ring);
* visor: a glass reflection on its upper left and a faint lower rim;
* badge: a glowing white rim with a soft halo;
* head: the logo's rounder helmet, ears closer to the head, the horn's blunt
  end higher.

Kept from V5: the rig (Rig_Root/Body/Head and their rest transforms), all 13
animations byte for byte, every node and mesh name, the materials the runtime
looks up (EyeCyanGlow, VisorDeepBlack), no mouth, no morph targets. Moved: the
eye pivots to the new eyes and the arm pivots to the new arm roots -- no clip
translates an eye or an arm pivot (they only rotate or scale them), and the
mesh nodes cancel their pivot so vertices stay in model space.

Logo measurements (512 px picture, x right, y down) map to model space (Z-up,
-Y toward the viewer, +X to the viewer's right) by X = (x - 267) * K and
Z = TOP - y * K.

Deterministic: numpy float32 output from fixed parameters -- the same V5 input
gives the same bytes.

    python tools/build_logo_character_v5.py \
        assets/models/lotbi-faithful-v2-rigged.glb \
        assets/models/lotbi-logo-character-v5-rigged.glb
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
HEAD_R = np.array([0.885, 0.68, 0.625])
HEAD_E_FRONT, HEAD_E_CROSS = 2.0, 2.0
ROLL = np.radians(9.0)

# Visor: 254 x 178 px, a little below the head centre.
VISOR_HALF = np.array([0.690, 0.455])
VISOR_CZ = -0.03
VISOR_E = 2.4

# Eyes: arcs 55 px wide, 9 px thick, centres 113 px apart.
EYE_X = 60 * K
EYE_DX = 0.058           # the logo's eyes sit a little right of the head centre
EYE_R = 27 * K
EYE_CZ = -0.17          # arc circle centre below the head centre (unrolled)
EYE_TUBE = 0.019
EYE_GLOW = ((0.030, 0.62), (0.046, 0.30), (0.068, 0.13))   # (radius, alpha)
EYE_ARC = (np.radians(8.0), np.radians(172.0))

# Ears: pods about 0.6 x 0.5 head units, sunk into the head sides.
EAR_R = np.array([0.15, 0.265, 0.30])
EAR_OUT = 0.075          # how far an ear stands out of the head side
EAR_CZ = -0.10

GRID = dict(head=(64, 34), ear=(32, 18), body=56)


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
    pink = 0.22 * smoothstep(0.45, 0.98, -n[:, 0]) * smoothstep(0.3, -0.6, n[:, 2])
    blue = 0.22 * smoothstep(0.45, 0.98, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    return model, n, colours, faces


def visor():
    nr, nt = 18, 96
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
    phi = np.linspace(EYE_ARC[0], EYE_ARC[1], 32)
    x = EYE_DX + side * EYE_X + EYE_R * np.cos(phi)
    z = EYE_CZ + EYE_R * np.sin(phi)
    y = head_front_y(x, z) - visor_lift(visor_rho(x, z)) - 0.010
    centre = np.stack([x, y, z], axis=-1)
    squash = 1.0 if radius_scale == 1.0 else 0.22 / radius_scale
    pos, faces = tube(centre, np.full(len(phi), EYE_TUBE * radius_scale), np.array([0.0, -1.0, 0.0]),
                      ring=ring, squash=squash)
    return roll_head(pos), faces


def eye_pivot(side: float):
    z = EYE_CZ + EYE_R * 0.55
    x = EYE_DX + side * EYE_X
    return roll_head(np.array([x, head_front_y(x, z) - 0.02, z]))


def ear(side: float, colour):
    pos, faces = superellipsoid(EAR_R, 2.3, 2.6, *GRID["ear"])
    half_width = HEAD_R[0] * (1 - abs(EAR_CZ / HEAD_R[2]) ** HEAD_E_FRONT) ** (1 / HEAD_E_FRONT)
    pos = pos + np.array([side * (half_width + EAR_OUT - EAR_R[0]), 0.03, EAR_CZ])
    model = roll_head(pos)
    n = vertex_normals(model, faces)
    lighter = 0.10 * smoothstep(0.3, 0.95, n[:, 2])        # top highlight tint
    colours = colour * (1 - lighter)[:, None] + WHITE * lighter[:, None]
    return model, n, colours, faces


def horn():
    """The logo's thick red horn: blunt left end over the stalk, tip up-right."""
    t = np.linspace(0, 1, 48)
    p = [np.array(v, float) for v in ((logo(286, 44)[0], 0.0, logo(286, 44)[1]),
                                     (logo(320, 36)[0], 0.0, logo(320, 36)[1]),
                                     (logo(349, 22)[0], 0.0, logo(349, 22)[1]),
                                     (logo(364, 3)[0], 0.0, logo(364, 3)[1]))]
    u = 1 - t
    centre = (u ** 3)[:, None] * p[0] + (3 * u * u * t)[:, None] * p[1] + (3 * u * t * t)[:, None] * p[2] + (t ** 3)[:, None] * p[3]
    half = 0.095 * (1 - t) ** 0.75 + 0.011
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
    """The white base under the horn (logo rows 40..100): a low collar on the crown and a
    short column up into the horn's middle, one mesh."""
    centre = np.array([logo(300, 94)[0], 0.0, logo(300, 94)[1]])
    collar, collar_faces = superellipsoid(np.array([0.22, 0.17, 0.17]), 2.0, 2.0, 32, 16)
    collar = collar + centre
    bottom = np.array([logo(310, 90)[0], 0.0, logo(310, 90)[1]])
    top = np.array([logo(318, 40)[0], 0.0, logo(318, 40)[1]])
    t = np.linspace(0, 1, 10)
    column, column_faces = tube(bottom + (top - bottom) * t[:, None], 0.120 - 0.025 * t,
                                np.array([1.0, 0.0, 0.0]), ring=20)
    pos = np.vstack([collar, column])
    faces = np.vstack([collar_faces, column_faces + len(collar)])
    n = vertex_normals(pos, faces)
    return pos, n, np.tile(WHITE, (len(pos), 1)), faces


def body():
    """The logo's pear: narrow under the head, leaning left, widest low, rounded tail.

    Logo rows (y: left..right edge of the body without the arms): 330: 162..323,
    390: 125..331, 410: 123..327, 440: 129..320, 460: 137..309, 480: 150..293,
    500: 176..265, 510: 204..237 -> centre and half width per height below.
    """
    top_z = 1.0
    knots_z = [-0.05, 0.12, 0.22, 0.55, 0.75, 1.0]
    half = catmull(knots_z, [0.520, 0.551, 0.556, 0.435, 0.355, 0.30], np.linspace(top_z, -0.05, 36))
    zs = np.linspace(top_z, -0.05, 36)
    cx = catmull(knots_z, [-0.232, -0.227, -0.211, -0.135, -0.03, 0.0], zs)
    belly = catmull(knots_z, [-0.02, -0.04, -0.04, -0.03, -0.01, 0.0], zs)
    # rounded tail: from the widest-low ring down to the tip at logo y ~514
    z_c, cap_h, cap_r = -0.05, 0.396, 0.520
    alpha = np.linspace(0, np.pi / 2, 16)[1:-1]
    zs = np.concatenate([zs, z_c - cap_h * np.sin(alpha)])
    half = np.concatenate([half, cap_r * np.cos(alpha) ** 1.3])
    cx = np.concatenate([cx, -0.232 - 0.03 * np.sin(alpha)])
    belly = np.concatenate([belly, -0.02 * np.cos(alpha)])
    seg = GRID["body"]
    phi = np.linspace(-np.pi, np.pi, seg, endpoint=False)
    ring = np.stack([cx[:, None] + half[:, None] * np.cos(phi)[None, :],
                     belly[:, None] + 0.80 * half[:, None] * np.sin(phi)[None, :],
                     np.repeat(zs[:, None], seg, axis=1)], axis=-1).reshape(-1, 3)
    global BODY_PROFILE
    order = np.argsort(zs)
    BODY_PROFILE = (zs[order], cx[order], belly[order], half[order])
    top = np.array([cx[0], belly[0], top_z + 0.02])
    tail = np.array([-0.262, -0.01, z_c - cap_h])
    positions = np.vstack([ring, top, tail])
    faces = ring_faces(len(zs), seg, len(ring), len(ring) + 1)
    faces = outward(positions, faces, np.array([-0.15, 0.0, 0.3]))
    n = vertex_normals(positions, faces)
    pink = 0.26 * smoothstep(0.35, 0.97, -n[:, 0]) * smoothstep(0.6, -0.2, positions[:, 2])
    blue = 0.20 * smoothstep(0.4, 0.97, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    return positions, n, colours, faces


BODY_PROFILE = None


def body_front_y(x, z):
    """Front (-Y) surface of the body at (x, z) -- the body is horizontal elliptic rings."""
    zs, cx, belly, half = BODY_PROFILE
    c = np.interp(z, zs, cx)
    b_ = np.interp(z, zs, belly)
    h = np.interp(z, zs, half)
    return b_ - 0.80 * h * np.sqrt(np.clip(1 - ((x - c) / h) ** 2, 0, None))


def badge():
    """A round disc facing the viewer (the logo shows a circle), following the body."""
    cx, cz = logo(250, 380)
    radius = 31 * K
    nr, nt = 10, 72
    rho = np.linspace(0, 1, nr + 1)[1:]
    theta = np.linspace(0, 2 * np.pi, nt, endpoint=False)
    rr, tt = np.meshgrid(rho, theta, indexing="ij")
    x = cx + radius * rr * np.cos(tt)
    z = cz + radius * rr * np.sin(tt)
    y = body_front_y(x, z) - (0.014 + 0.010 * (1 - rr ** 2))
    ring = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    centre = np.array([[cx, body_front_y(cx, cz) - 0.024, cz]])
    positions = np.vstack([ring, centre])
    faces = []
    for i in range(nr - 1):
        for k in range(nt):
            a_, b_ = i * nt + k, i * nt + (k + 1) % nt
            faces += [(a_, b_, a_ + nt), (b_, b_ + nt, a_ + nt)]
    faces += [(len(ring), (k + 1) % nt, k) for k in range(nt)]
    faces = np.asarray(faces, dtype=np.int64)
    n = vertex_normals(positions, faces)
    if np.mean(n[:, 1]) > 0:
        faces = faces[:, ::-1].copy()
        n = -n
    s_ = smoothstep(-0.75, 0.75, (positions[:, 0] - cx) / radius)
    colours = LOGO_RED * (1 - s_)[:, None] + LOGO_BLUE * s_[:, None]
    rx = cx + (radius + 0.004) * np.cos(theta)
    rz = cz + (radius + 0.004) * np.sin(theta)
    rim_centre = np.stack([rx, body_front_y(rx, rz) - 0.016, rz], axis=-1)
    rim_centre = np.vstack([rim_centre, rim_centre[:1]])
    return (positions, n, colours, faces), (rim_centre, np.array([0.0, -1.0, 0.0]))


def badge_rim(rim_centre, normal, radius, ring=10):
    pos, faces = tube(rim_centre, np.full(len(rim_centre), radius), normal, ring=ring, caps=False)
    return pos, faces


# Arm roots (inside the body) and tips, from the logo. Left: a broad fin whose
# seam runs from (160, 315) to (125, 395) on the body's left side, tip at
# (63, 388). Right: a paddle from the seam at x ~330 (y 340..380) up to the
# hand at (445, 312).
LEFT_ROOT = np.array([logo(170, 345)[0], -0.06, logo(170, 345)[1]])
LEFT_TIP = np.array([logo(58, 389)[0], -0.14, logo(58, 389)[1]])
RIGHT_ROOT = np.array([logo(314, 366)[0], -0.06, logo(314, 366)[1]])
RIGHT_TIP = np.array([logo(447, 306)[0], -0.14, logo(447, 306)[1]])
ARM_PIVOT = {-1.0: np.array([logo(150, 352)[0], -0.08, logo(150, 352)[1]]),
             1.0: np.array([logo(333, 360)[0], -0.08, logo(333, 360)[1]])}


def arm(side: float):
    if side < 0:   # the logo's fin: broad at the body, narrowing down and out to the left
        pos, faces = paddle(LEFT_ROOT, LEFT_TIP, np.array([0.45, 0.0, 0.89]), width=0.56, thickness=0.085,
                            taper=(1.0, 0.30), nu=32, nv=22)
    else:          # the waving hand: narrower at the body, a big round paddle at the end
        pos, faces = paddle(RIGHT_ROOT, RIGHT_TIP, np.array([-0.38, 0.0, 0.92]), width=0.40, thickness=0.13,
                            taper=(0.80, 1.0), nu=32, nv=22)
    n = vertex_normals(pos, faces)
    pink = (0.18 if side < 0 else 0.0) * smoothstep(0.2, 0.9, -n[:, 2])
    blue = (0.12 if side > 0 else 0.0) * smoothstep(0.2, 0.9, n[:, 0])
    colours = WHITE * (1 - pink - blue)[:, None] + PINK_TINT * pink[:, None] + BLUE_TINT * blue[:, None]
    root, tip = (LEFT_ROOT, LEFT_TIP) if side < 0 else (RIGHT_ROOT, RIGHT_TIP)
    return pos, n, colours, faces, root, tip


def joint(root, tip):
    """A white shoulder fillet over the seam (no dark joint dot)."""
    axis = (tip - root) / np.linalg.norm(tip - root)
    centre = root + axis * 0.05
    pos, faces = superellipsoid(np.array([0.06, 0.065, 0.095]), 2.0, 2.0, 20, 12)
    zax = np.cross(axis, np.array([0.0, 1.0, 0.0]))
    zax /= np.linalg.norm(zax)
    yax = np.cross(zax, axis)
    model = pos @ np.stack([axis, yax, zax], axis=1).T + centre
    n = vertex_normals(model, faces)
    return model, n, np.tile(WHITE, (len(model), 1)), faces


def visor_reflection():
    """Glass reflections like the logo: a soft crescent upper left, a faint lower rim."""
    shapes = []
    for (t0, t1, r0, r1, alpha) in ((np.radians(100), np.radians(165), 0.80, 0.93, 0.30),
                                    (np.radians(205), np.radians(335), 0.88, 0.96, 0.14)):
        tt = np.linspace(t0, t1, 48)
        rr = np.linspace(r0, r1, 5)
        T, R = np.meshgrid(tt, rr, indexing="ij")
        m = 2.0 / VISOR_E
        x = VISOR_HALF[0] * R * spow(np.cos(T), m)
        z = VISOR_CZ + VISOR_HALF[1] * R * spow(np.sin(T), m)
        y = head_front_y(x, z) - visor_lift(visor_rho(x, z)) - 0.004
        pts = np.stack([x, y, z], axis=-1)
        # fade both ends of the crescent with a narrower band
        mid = (r0 + r1) / 2
        taper = np.sin(np.linspace(0, np.pi, len(tt)))[:, None] ** 0.7
        pts[..., 0] = VISOR_HALF[0] * (mid + (R - mid) * taper) * spow(np.cos(T), m)
        pts[..., 2] = VISOR_CZ + VISOR_HALF[1] * (mid + (R - mid) * taper) * spow(np.sin(T), m)
        pts[..., 1] = head_front_y(pts[..., 0], pts[..., 2]) - visor_lift(visor_rho(pts[..., 0], pts[..., 2])) - 0.004
        faces = []
        nt, nr = pts.shape[:2]
        for i in range(nt - 1):
            for k in range(nr - 1):
                a_ = i * nr + k
                faces += [(a_, a_ + 1, a_ + nr), (a_ + 1, a_ + nr + 1, a_ + nr)]
        faces = np.asarray(faces, dtype=np.int64)
        flat = roll_head(pts.reshape(-1, 3))
        nrm = vertex_normals(flat, faces)
        if np.mean(nrm[:, 1]) > 0:
            faces = faces[:, ::-1].copy()
            nrm = -nrm
        shapes.append((flat, nrm, faces, alpha))
    return shapes


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
    mats[materials["GlossyWhite"]]["emissiveFactor"] = [0.10, 0.10, 0.11]
    mats[materials["VisorDeepBlack"]]["pbrMetallicRoughness"].update(metallicFactor=0.2, roughnessFactor=0.06)
    mats[materials["EyeCyanGlow"]]["emissiveFactor"] = [0.30, 0.58, 1.0]     # x2.2..3.9 at runtime: near-white blue core
    mats[materials["AccentPink"]]["emissiveFactor"] = [float(v) for v in (LOGO_RED * 0.10).round(4)]
    mats[materials["AccentBlue"]]["emissiveFactor"] = [float(v) for v in (LOGO_BLUE * 0.10).round(4)]
    mats[materials["ContinuousGradientGloss"]]["emissiveFactor"] = [0.0, 0.0, 0.0]
    unlit = {"KHR_materials_unlit": {}}
    glow_materials = []
    for index, (_, alpha) in enumerate(EYE_GLOW):
        glow_materials.append(add_material({"name": f"EyeGlowSoft{index + 1}", "pbrMetallicRoughness": {
            "baseColorFactor": [0.0, 0.0, 0.0, alpha], "metallicFactor": 0.0, "roughnessFactor": 1.0},
            "emissiveFactor": [0.02, 0.24, 1.0], "alphaMode": "BLEND"}))
    reflection_materials = [add_material({"name": f"VisorReflection{index + 1}", "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, alpha], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "alphaMode": "BLEND", "extensions": unlit}) for index, alpha in enumerate((0.30, 0.14))]
    rim_glow = add_material({"name": "BadgeRimGlow", "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.2},
        "emissiveFactor": [0.85, 0.95, 1.0]})
    badge_face = add_material({"name": "BadgeGradientUnlit", "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 1.0}, "extensions": unlit})
    rim_halo_soft = add_material({"name": "BadgeRimHaloSoft", "pbrMetallicRoughness": {
        "baseColorFactor": [0.45, 0.70, 1.0, 0.14], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "alphaMode": "BLEND", "extensions": unlit})
    rim_halo = add_material({"name": "BadgeRimHalo", "pbrMetallicRoughness": {
        "baseColorFactor": [0.55, 0.80, 1.0, 0.32], "metallicFactor": 0.0, "roughnessFactor": 1.0},
        "alphaMode": "BLEND", "extensions": unlit})
    doc["extensionsUsed"] = sorted(set(doc.get("extensionsUsed", [])) | {"KHR_materials_unlit"})

    white, visor_m, eye_m = materials["GlossyWhite"], materials["VisorDeepBlack"], materials["EyeCyanGlow"]
    gloss = materials["ContinuousGradientGloss"]

    # Head (children of Rig_Head; mesh nodes keep their V5 offsets, so the
    # vertices are in model space).
    set_mesh("HeadShell", primitive(*head_shell(), white))
    reflections = [primitive(flat, nrm, None, faces, mat) for (flat, nrm, faces, _), mat in zip(visor_reflection(), reflection_materials)]
    set_mesh("Visor", primitive(*visor(), visor_m), primitive(*visor_bezel(), white), *reflections)
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
        for (radius, _), mat in zip(EYE_GLOW, glow_materials):
            hpos, hfaces = eye(side, radius / EYE_TUBE, ring=8)
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
    rim_pos, rim_faces = badge_rim(rim_centre, normal, 0.014)
    halo_pos, halo_faces = badge_rim(rim_centre, normal, 0.030)
    halo2_pos, halo2_faces = badge_rim(rim_centre, normal, 0.050)
    set_mesh("BadgeGlowRim", primitive(rim_pos, None, np.tile(WHITE, (len(rim_pos), 1)), rim_faces, rim_glow),
             primitive(halo_pos, None, None, halo_faces, rim_halo),
             primitive(halo2_pos, None, None, halo2_faces, rim_halo_soft))

    # Arms + joints (children of Rig_LeftArm / Rig_RightArm).
    for mesh_name, joint_name, rig, side in (("LeftArm", "LeftShoulderJoint", "Rig_LeftArm", -1.0),
                                              ("RightWaveArm", "RightShoulderJoint", "Rig_RightArm", 1.0)):
        pos, n, colours, faces, root, tip = arm(side)
        set_mesh(mesh_name, primitive(pos, n, colours, faces, white))
        set_mesh(joint_name, primitive(*joint(root, tip), white))
        # The arm pivot moves to the new arm root (arm clips only rotate it).
        pivot = ARM_PIVOT[side]
        nodes[rig]["translation"] = [float(v) for v in np.round(pivot, 6)]
        for child in (mesh_name, joint_name):
            nodes[child]["translation"] = [float(v) for v in np.round(-pivot, 6)]

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
        "visualStatus": "LOGO_CHARACTER_V5_OWNER_REVIEW",
        "derivedFrom": "assets/models/lotbi-faithful-v2-rigged.glb",
        "derivedFromSha256": source_sha,
        "logoAlignment": "v5: all visible shapes rebuilt from the logo picture (overlay-checked); V5 rig and 13 animations kept; eye and arm pivots moved to the new eyes and arm roots",
        "mouth": False,
    })
    doc["asset"]["generator"] = "LOTBI tools/build_logo_character_v5.py (logo character on the V5 rig)"
    out = write_glb(doc, kept_arr, target)
    return {"source_sha256": source_sha, "target": str(target),
            "target_sha256": hashlib.sha256(out).hexdigest(), "bytes": len(out)}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2])), indent=1))
