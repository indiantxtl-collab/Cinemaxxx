#!/usr/bin/env python3
"""Generate the Android origin from CINEMAXXX_SITE_URL; never inherit upstream's host."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

build = Path(sys.argv[1])
raw = os.environ.get("CINEMAXXX_SITE_URL", "").strip()
if not raw:
    raise SystemExit("CINEMAXXX_SITE_URL is required. Set it to this fork's own HTTPS deployment origin before building Android.")
url = urlsplit(raw)
if (url.scheme != "https" or not url.hostname or url.username or url.password or url.port
        or url.path not in ("", "/") or url.query or url.fragment):
    raise SystemExit("CINEMAXXX_SITE_URL must be an HTTPS origin without credentials, port, path, query or fragment.")
host = url.hostname.lower().encode("idna").decode("ascii")
if (host in {"localhost", "cinemaxtv.space", "www.cinemaxtv.space", "cinemax-orpin.vercel.app"}
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", host)
        or "." not in host or any(len(label) > 63 or label.startswith("-") or label.endswith("-") for label in host.split("."))):
    raise SystemExit("Use the new deployment's own public hostname, not localhost or the original CINEMAX host.")
origin = f"https://{host}"
java = build / "gen" / "com" / "cinemaxxx" / "app" / "Deployment.java"
java.parent.mkdir(parents=True, exist_ok=True)
java.write_text(
    'package com.cinemaxxx.app;\n\n/** Generated from CINEMAXXX_SITE_URL by android/build.sh. */\n'
    'public final class Deployment {\n'
    f'    public static final String HOST = {json.dumps(host)};\n'
    f'    public static final String HOME_URL = {json.dumps(origin + "/")};\n'
    '    private Deployment() {}\n}\n', encoding="utf-8")
manifest = Path(__file__).resolve().parents[1] / "app" / "src" / "main" / "AndroidManifest.xml"
(build / "AndroidManifest.xml").write_text(
    manifest.read_text(encoding="utf-8").replace("www.__CINEMAXXX_HOST__", "www." + host).replace("__CINEMAXXX_HOST__", host),
    encoding="utf-8")
(build / "deployment.json").write_text(json.dumps({"origin": origin, "host": host}), encoding="utf-8")
print(f"Android deployment origin: {origin}")
