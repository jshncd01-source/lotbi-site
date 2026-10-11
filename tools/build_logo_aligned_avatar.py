"""Build the logo-aligned home avatar GLB from the approved V5 avatar.

SITE-AVATAR-LOGO-ALIGN-01. The official LOTBI logo character
(assets/brand/lotbi-mark-512.png, the same character as the header lockup) is
the reference. The approved V5 avatar (lotbi-faithful-v2-rigged.glb) already
has the logo's skeleton -- white shell, black visor, two smiling eyes, side
ears, droplet body, waving arm, chest badge -- but reads as a different, paler
character next to the logo:

* its crest is a puffy pastel pink-violet-cyan blob, while the logo has one
  coral-red fin rising from a white collar and curving up to the viewer's
  right, blue on its underside;
* its ears, eyes and badge are washed pastel (colours carried by strong
  emissive on white), while the logo's are saturated coral red #F5576F and
  blue #3A8DFD, with glowing blue eyes.

This tool keeps everything that moves the character and only rebuilds what
must look like the logo:

* kept byte-for-byte in meaning: every node, name, transform and parent, the
  five rig nodes, all 13 animations, every other mesh, no mouth, no morph
  targets;
* rebuilt: CrestWhiteBase (white collar) and CrestContinuousGradient (the fin),
  in the same place under Rig_Head;
* recoloured: ears, eyes, chest badge and its rim (vertex colours + material
  emissive), from the logo's measured colours.

Deterministic: same input bytes -> same output bytes (numpy float32, fixed
segment counts, sorted JSON is not used so the original key order stays).

    python tools/build_logo_aligned_avatar.py \
        assets/models/lotbi-faithful-v2-rigged.glb \
        assets/models/lotbi-logo-aligned-v3-rigged.glb
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np

# Logo colours measured from assets/brand/lotbi-mark-512.png (vivid 10% of
# each part): fin/ear/badge red #F5576F..#FA546E, ear/badge blue #2A88FD..
# #3D97FD, eye glow #1474E6. Stored as linear RGB (glTF vertex colours).
def srgb_to_linear(hex_colour: str) -> np.ndarray:
    c = np.array([int(hex_colour[i:i + 2], 16) / 255.0 for i in (1, 3, 5)], dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

LOGO_RED = srgb_to_linear("#F5576F")
LOGO_BLUE = srgb_to_linear("#3A8DFD")
LOGO_EYE = srgb_to_linear("#1F6FFF")
# The fin and ears are lit from above and tone mapped: a lighter red lands on
# the logo's #F5576F on screen (checked by rendering).
LIT_RED = srgb_to_linear("#FF6E86")
WHITE = np.array([0.985, 0.992, 1.0])

FIN_SEGMENTS = 40      # along the spine
FIN_RING = 28          # around the cross-section
BASE_U, BASE_V = 32, 16

COMPONENT = {5126: (np.float32, 4), 5123: (np.uint16, 2), 5125: (np.uint32, 4), 5121: (np.uint8, 1)}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


# ------------------------------------------------------------------ glb io ----

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
    blob = raw[28 + json_len:28 + json_len + bin_len]
    return raw, doc, blob


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


def write_glb(doc, arrays: dict[int, np.ndarray], path: Path) -> bytes:
    """Repack every accessor (replaced ones from ``arrays``) into one tight buffer."""
    chunks, views = [], []
    offset = 0
    for index, acc in enumerate(doc["accessors"]):
        data = arrays[index]
        dtype, align = COMPONENT[acc["componentType"]]
        data = np.ascontiguousarray(data, dtype=dtype)
        pad = (-offset) % 4
        if pad:
            chunks.append(b"\x00" * pad)
            offset += pad
        body = data.tobytes()
        old_view = doc["bufferViews"][acc["bufferView"]]
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(body)}
        if "target" in old_view:
            view["target"] = old_view["target"]
        views.append(view)
        acc["bufferView"] = index
        acc.pop("byteOffset", None)
        acc["count"] = int(data.shape[0])
        if acc["type"] != "SCALAR" and acc["componentType"] == 5126 and acc.get("min") is not None:
            acc["min"] = [float(v) for v in data.min(axis=0)]
            acc["max"] = [float(v) for v in data.max(axis=0)]
        elif acc["type"] == "SCALAR" and acc.get("min") is not None:
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
    total = 12 + 8 + len(json_bytes) + 8 + len(blob)
    out = (struct.pack("<4sII", b"glTF", 2, total)
           + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
           + struct.pack("<I4s", len(blob), b"BIN\x00") + blob)
    path.write_bytes(out)
    return out


# --------------------------------------------------------------- geometry ----

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def bezier(points, t):
    p0, p1, p2, p3 = (np.asarray(p, dtype=np.float64) for p in points)
    u = 1 - t
    pos = (u ** 3)[:, None] * p0 + (3 * u * u * t)[:, None] * p1 + (3 * u * t * t)[:, None] * p2 + (t ** 3)[:, None] * p3
    tan = (3 * u * u)[:, None] * (p1 - p0) + (6 * u * t)[:, None] * (p2 - p1) + (3 * t * t)[:, None] * (p3 - p2)
    return pos, tan / np.linalg.norm(tan, axis=1, keepdims=True)


def vertex_normals(positions, indices):
    tri = indices.reshape(-1, 3)
    a, b, c = (positions[tri[:, k]] for k in range(3))
    face = np.cross(b - a, c - a)
    normals = np.zeros_like(positions)
    for k in range(3):
        np.add.at(normals, tri[:, k], face)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    return normals / np.where(length == 0, 1, length)


def fin_mesh():
    """The logo's crest: one fin rising from the crown and curving up to the viewer's right.

    Model space of the V5 asset: +x viewer's right, -y toward the viewer, +z up.
    The root sits inside the white collar; the free end is a rounded point.
    """
    # Logo proportions (head width = 1.58 model units): a white stalk 0.17 right
    # of the crown centre carries a blade about 0.31 wide at its root whose free
    # end points up-right about 0.45 right of the crown centre; stalk : blade
    # height is about 0.17 : 0.22. The site camera shows up to z ~= 2.43 above
    # this crown (2.10), and the old crest reached 2.37 -- so the same
    # proportions are scaled to end at ~2.36 and nothing is cut off.
    spine = [(0.135, 0.030, 2.130), (0.150, 0.030, 2.230), (0.265, 0.038, 2.290), (0.440, 0.045, 2.352)]
    t = np.linspace(0.0, 1.0, FIN_SEGMENTS + 1)
    centre, tangent = bezier(spine, t)
    depth_axis = np.array([0.0, 1.0, 0.0])
    side = np.cross(depth_axis, tangent)           # in the x-z plane; points to the fin's underside
    side /= np.linalg.norm(side, axis=1, keepdims=True)
    depth = np.cross(tangent, side)
    half_width = 0.160 * (1 - t) ** 1.05 + 0.012    # broad blade root, narrow free end
    half_depth = 0.088 * (1 - t) ** 0.80 + 0.011
    phi = np.linspace(0.0, 2 * np.pi, FIN_RING, endpoint=False)
    ring_c, ring_s = np.cos(phi), np.sin(phi)
    positions = (centre[:, None, :]
                 + side[:, None, :] * (half_width[:, None] * ring_c[None, :])[..., None]
                 + depth[:, None, :] * (half_depth[:, None] * ring_s[None, :])[..., None]).reshape(-1, 3)
    tip = centre[-1] + tangent[-1] * 0.012
    positions = np.vstack([positions, tip[None, :]])
    tip_index = len(positions) - 1
    faces = []
    for i in range(FIN_SEGMENTS):
        for k in range(FIN_RING):
            a = i * FIN_RING + k
            b = i * FIN_RING + (k + 1) % FIN_RING
            c = (i + 1) * FIN_RING + k
            d = (i + 1) * FIN_RING + (k + 1) % FIN_RING
            faces += [(a, c, b), (b, c, d)]
    last = FIN_SEGMENTS * FIN_RING
    for k in range(FIN_RING):
        faces.append((last + k, tip_index, last + (k + 1) % FIN_RING))
    indices = np.asarray(faces, dtype=np.uint32).reshape(-1)
    normals = vertex_normals(positions, indices)
    # Colour like the logo: coral red on top, blue on the underside near the
    # root, a short violet blend between; the free end stays red.
    along = np.concatenate([np.repeat(t, FIN_RING), [1.0]])
    under = np.concatenate([np.tile(ring_c, FIN_SEGMENTS + 1), [0.0]])
    blue = smoothstep(-0.05, 0.85, under) * (0.95 - 0.55 * along)
    colours = LIT_RED[None, :] * (1 - blue[:, None]) + LOGO_BLUE[None, :] * blue[:, None]
    return positions, normals, colours, indices


def collar_mesh():
    """The white stalk the fin rises from (a wide ellipsoid sunk into the crown)."""
    centre = np.array([0.150, 0.030, 2.090])
    radii = np.array([0.140, 0.112, 0.125])
    u = np.linspace(0.0, 2 * np.pi, BASE_U, endpoint=False)
    v = np.linspace(0.0, np.pi, BASE_V + 1)
    uu, vv = np.meshgrid(u, v)
    positions = np.stack([np.cos(uu) * np.sin(vv), np.sin(uu) * np.sin(vv), np.cos(vv)], axis=-1).reshape(-1, 3)
    positions = centre + positions * radii
    faces = []
    for i in range(BASE_V):
        for k in range(BASE_U):
            a = i * BASE_U + k
            b = i * BASE_U + (k + 1) % BASE_U
            c = (i + 1) * BASE_U + k
            d = (i + 1) * BASE_U + (k + 1) % BASE_U
            faces += [(a, c, b), (b, c, d)]
    indices = np.asarray(faces, dtype=np.uint32).reshape(-1)
    normals = vertex_normals(positions, indices)
    colours = np.tile(WHITE, (len(positions), 1))
    return positions, normals, colours, indices


# ------------------------------------------------------------------ build ----

def build(source: Path, target: Path) -> dict:
    raw, doc, blob = read_glb(source)
    arrays = {i: accessor_array(doc, blob, i) for i in range(len(doc["accessors"]))}
    mesh_by_name = {m["name"]: m for m in doc["meshes"]}
    material_by_name = {m["name"]: m for m in doc["materials"]}

    def primitive(name):
        prim = mesh_by_name[name]["primitives"]
        if len(prim) != 1:
            raise SystemExit(f"{name}: expected one primitive")
        return prim[0]

    def replace_geometry(name, positions, normals, colours, indices):
        prim = primitive(name)
        attrs = prim["attributes"]
        arrays[attrs["POSITION"]] = positions.astype(np.float32)
        arrays[attrs["NORMAL"]] = normals.astype(np.float32)
        arrays[attrs["COLOR_0"]] = colours.astype(np.float32)
        index_acc = doc["accessors"][prim["indices"]]
        dtype = np.uint16 if len(positions) < 65535 else np.uint32
        index_acc["componentType"] = 5123 if dtype is np.uint16 else 5125
        arrays[prim["indices"]] = indices.astype(dtype)

    def recolour(name, colours):
        arrays[primitive(name)["attributes"]["COLOR_0"]] = np.asarray(colours, dtype=np.float32)

    # Crest: same two meshes, same nodes (children of Rig_Head), new shape.
    replace_geometry("CrestContinuousGradient", *fin_mesh())
    replace_geometry("CrestWhiteBase", *collar_mesh())
    material_by_name["ContinuousGradientGloss"]["emissiveFactor"] = [0.0, 0.0, 0.0]

    def scale_about(name, factor, centre=None):
        prim = primitive(name)
        pos = arrays[prim["attributes"]["POSITION"]].astype(np.float64)
        c = (pos.min(axis=0) + pos.max(axis=0)) / 2 if centre is None else np.asarray(centre)
        arrays[prim["attributes"]["POSITION"]] = (c + (pos - c) * np.asarray(factor)).astype(np.float32)

    # Ears: the logo's red (viewer's left) and blue (viewer's right), a little
    # larger as on the logo; each grows about its own centre, out of the head.
    for name, side in (("LeftEarPink", -1.0), ("RightEarBlue", 1.0)):
        pos = arrays[primitive(name)["attributes"]["POSITION"]]
        inner = pos[:, 0].min() if side < 0 else pos[:, 0].max()
        centre = (pos.min(axis=0) + pos.max(axis=0)) / 2
        centre[0] = pos[:, 0].max() if side < 0 else pos[:, 0].min()   # grow outward from the head
        scale_about(name, (1.06, 1.12, 1.12), centre)
    for name, colour in (("LeftEarPink", LIT_RED), ("RightEarBlue", LOGO_BLUE)):
        count = len(arrays[primitive(name)["attributes"]["POSITION"]])
        recolour(name, np.tile(colour, (count, 1)))
    material_by_name["AccentPink"]["emissiveFactor"] = [float(v) for v in (LOGO_RED * 0.04).round(4)]
    material_by_name["AccentBlue"]["emissiveFactor"] = [float(v) for v in (LOGO_BLUE * 0.04).round(4)]

    # Eyes: the logo's glowing blue arcs read thicker -- the tube around each
    # arc's centreline (a circle in the x-z plane) grows 1.7x, the arc itself
    # keeps its place and size.
    for name in ("LeftEye", "RightEye"):
        attrs = primitive(name)["attributes"]
        pos = arrays[attrs["POSITION"]].astype(np.float64)
        x, z = pos[:, 0], pos[:, 2]
        fit = np.linalg.lstsq(np.c_[2 * x, 2 * z, np.ones_like(x)], x * x + z * z, rcond=None)[0]
        cx, cz = fit[0], fit[1]
        radius = np.sqrt(fit[2] + cx * cx + cz * cz)
        angle = np.arctan2(z - cz, x - cx)
        centreline = np.c_[cx + radius * np.cos(angle), np.full_like(x, pos[:, 1].mean()), cz + radius * np.sin(angle)]
        arrays[attrs["POSITION"]] = (centreline + (pos - centreline) * 1.7).astype(np.float32)
    for name in ("LeftEye", "RightEye"):
        count = len(arrays[primitive(name)["attributes"]["POSITION"]])
        recolour(name, np.tile(LOGO_EYE, (count, 1)))
    material_by_name["EyeCyanGlow"]["emissiveFactor"] = [0.01, 0.13, 0.72]

    # Badge: as large as on the logo (about 1.4x), red on the viewer's left into
    # blue on the right; a white rim. Both grow about the badge centre and
    # move forward a touch so the larger disc stays on the curved body.
    badge_pos = arrays[primitive("BadgeGlowRim")["attributes"]["POSITION"]]
    badge_centre = (badge_pos.min(axis=0) + badge_pos.max(axis=0)) / 2
    for name in ("BadgeGlowRim", "BadgeContinuousGradient"):
        scale_about(name, (1.4, 1.0, 1.4), badge_centre)
        attrs = primitive(name)["attributes"]
        arrays[attrs["POSITION"]][:, 1] -= 0.012
    badge = primitive("BadgeContinuousGradient")
    x = arrays[badge["attributes"]["POSITION"]][:, 0].astype(np.float64)
    s = smoothstep(-0.06, 0.06, x)
    recolour("BadgeContinuousGradient", LOGO_RED[None, :] * (1 - s[:, None]) + LOGO_BLUE[None, :] * s[:, None])
    rim = primitive("BadgeGlowRim")
    count = len(arrays[rim["attributes"]["POSITION"]])
    recolour("BadgeGlowRim", np.tile(WHITE, (count, 1)))

    source_sha = hashlib.sha256(raw).hexdigest()
    extras = doc["asset"].setdefault("extras", {})
    extras.update({
        "visualTarget": "assets/brand/lotbi-mark-512.png (official logo character, header lockup)",
        "visualTargetSha256": hashlib.sha256((Path(__file__).resolve().parent.parent / "assets/brand/lotbi-mark-512.png").read_bytes()).hexdigest(),
        "visualStatus": "LOGO_ALIGNED_OWNER_REVIEW",
        "derivedFrom": "assets/models/lotbi-faithful-v2-rigged.glb",
        "derivedFromSha256": source_sha,
        "logoAlignment": "crest fin + collar rebuilt; ears, eyes, badge recoloured to logo colours; rig, nodes and 13 animations unchanged",
        "mouth": False,
    })
    doc["asset"]["generator"] = "LOTBI tools/build_logo_aligned_avatar.py (from the approved V5 avatar)"
    out = write_glb(doc, arrays, target)
    return {"source": str(source), "source_sha256": source_sha, "target": str(target),
            "target_sha256": hashlib.sha256(out).hexdigest(), "bytes": len(out)}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    print(json.dumps(build(Path(sys.argv[1]), Path(sys.argv[2])), indent=1))
