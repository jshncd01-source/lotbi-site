#!/usr/bin/env python3
"""Validate the public LOTBI production AASA source contract."""
from __future__ import annotations

import json
from pathlib import Path

PATH = Path(".well-known/apple-app-site-association")
CANONICAL_APP_ID = "5H34TQ4BWB.com.lotbiai.app"
CANONICAL_PATHS = ["/app/open/*"]

payload = json.loads(PATH.read_text(encoding="utf-8"))
if not isinstance(payload, dict):
    raise SystemExit("AASA root must be an object")

applinks = payload.get("applinks")
if not isinstance(applinks, dict):
    raise SystemExit("AASA applinks object is required")
if applinks.get("apps") != []:
    raise SystemExit("AASA applinks.apps must remain the empty legacy array")

details = applinks.get("details")
if not isinstance(details, list):
    raise SystemExit("AASA applinks.details must be a list")
if details != [{"appID": CANONICAL_APP_ID, "paths": CANONICAL_PATHS}]:
    raise SystemExit(
        "AASA applinks.details must contain only the canonical Production appID "
        "scoped exactly to /app/open/*"
    )

print("LOTBI AASA source contract: OK")
