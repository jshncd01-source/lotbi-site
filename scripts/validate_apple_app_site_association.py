#!/usr/bin/env python3
"""Validate the public LOTBI AASA source contract.

The checked-in file is intentionally fail-closed while the Apple Application
Identifier Prefix is unavailable. When that external value is supplied later,
the same validator permits only the LOTBI production bundle and the explicit
/app/open/ App Link surface.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

PATH = Path(".well-known/apple-app-site-association")
BUNDLE_ID = "com.lotbiai.app"
APP_ID_RE = re.compile(r"^[A-Z0-9]+\.com\.lotbiai\.app$")

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

for row in details:
    if not isinstance(row, dict):
        raise SystemExit("AASA detail must be an object")
    app_id = row.get("appID")
    if not isinstance(app_id, str) or not APP_ID_RE.fullmatch(app_id):
        raise SystemExit("AASA appID must use the real Apple prefix plus com.lotbiai.app")
    paths = row.get("paths")
    components = row.get("components")
    allowed = False
    if isinstance(paths, list):
        allowed = any(isinstance(value, str) and value.startswith("/app/open/") for value in paths)
    if isinstance(components, list):
        allowed = allowed or any(
            isinstance(value, dict)
            and isinstance(value.get("/"), str)
            and value["/"].startswith("/app/open/")
            for value in components
        )
    if not allowed:
        raise SystemExit("AASA detail must be scoped to /app/open/*")

print("LOTBI AASA source contract: OK")
