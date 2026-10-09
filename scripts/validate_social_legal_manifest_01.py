"""Social Signup legal manifest digests are deployment-stable.

* The consent digest of terms.html / privacy.html equals the validate_hardening
  lock for the same file (one canonical form for both checks).
* Rewriting every asset cache token (what each Site release does) does not
  change the digest; changing one character of the policy text does.
"""
from __future__ import annotations

import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


manifest = _load("emit_social_signup_legal_manifest")
hardening = _load("validate_hardening")
errors: list[str] = []

for label, _version, path, _uri in manifest.DOCS:
    digest = manifest.repo_digest(path)
    locked = hardening.LOCKED_SHA256[path.name]
    if digest != locked:
        errors.append(f"{label}: consent digest {digest} != hardening lock {locked}")
    text = path.read_text(encoding="utf-8")
    if not re.search(r"\?v=aset-[0-9a-f]+", text):
        errors.append(f"{label}: expected asset cache tokens in {path.name}")
    retokened = re.sub(r"\?v=aset-[0-9a-f]+", "?v=aset-000000000000", text).replace("\n", "\r\n")
    if manifest.canonical_digest(retokened) != digest:
        errors.append(f"{label}: digest moved with asset tokens / line endings")
    edited = text.replace("LOTBI", "L0TBI", 1)
    if manifest.canonical_digest(edited) == digest:
        errors.append(f"{label}: digest ignored a policy text change")

if errors:
    raise SystemExit("\n".join(errors))
print("SOCIAL LEGAL MANIFEST 01 PASS — consent digests equal the hardening locks and survive asset-token rewrites.")
