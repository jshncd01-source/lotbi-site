# hls.js 1.6.19 (vendored, light build)

실시간 도로 CCTV (TRAFFIC-CCTV P0) plays the ITS 국가교통정보센터 HTTPS HLS streams in the reader's
browser. Safari and iOS play HLS themselves; Android Chrome, Samsung Internet and desktop Chrome
need this player on top of Media Source Extensions. Loaded only when such a browser opens a live
camera (`site-life-traffic-cctv.js`), never on page load.

- Source: npm `hls.js@1.6.19` (published 2026-08-19, Apache-2.0, see `LICENSE`),
  `dist/hls.light.min.js` unchanged. The light build leaves out subtitles, alternate audio and
  DRM, none of which a traffic camera stream uses.
- Tarball integrity (npm registry `dist.integrity`), checked before copying:
  `sha512-A//aZeaAgM5rgUCbTURD4gkfyw5Uag2/4Jky7CfDOukL/DN+P5DjbgK2BYteyP3/KnCkPfkGVkbLxQG2T0AbUQ==`
- The file ends with a `sourceMappingURL` comment; the map is not shipped (developer tools may
  report it missing; nothing else reads it).
- Sealed: not rewritten by `scripts/asset_cache_version.mjs`; a new version gets a new folder.
  The page loads it with Subresource Integrity (`HLS_SCRIPT_INTEGRITY` in the screen module).

SHA-256:

```
997b01f5943bbc5750c4f52c5e6671d161728104b03c75ec4ea4eb7db9628ab6  hls.light.min.js
```

SRI: `sha384-iLLNHt3V/kPmTJ59eKPOjc+6Qf/z6IObViLeySBT6dkvUuCbmRSU82tfSlI2meV0`
