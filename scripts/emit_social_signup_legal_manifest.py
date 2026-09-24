#!/usr/bin/env python3
"""Emit non-secret Social Signup legal manifest values for reviewed Site HTML."""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DOCS = (
    (
        "TERMS",
        "LOTBI_TERMS_2026-09-17_R1",
        ROOT / "terms.html",
        "https://lotbiai.com/terms.html",
    ),
    (
        "PRIVACY",
        "LOTBI_PRIVACY_2026-09-24_R1",
        ROOT / "privacy.html",
        "https://lotbiai.com/privacy.html",
    ),
)

for label, version, path, uri in DOCS:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f"LOTBI_SOCIAL_{label}_VERSION={version}")
    print(f"LOTBI_SOCIAL_{label}_SHA256={digest}")
    print(f"LOTBI_SOCIAL_{label}_URI={uri}")
