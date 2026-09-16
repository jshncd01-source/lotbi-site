# LOTBI Site Mobile Entry / App Link Contract

Status: site chooser and web fallback implemented. Native association remains fail-closed until the app-side chooser-first scope and real-device production association values are verified.

## Production origin

- Public origin: `https://lotbiai.com`
- Account origin `https://account.lotbiai.com` is outside this workstream and its session/auth boundary is unchanged.

## Chooser-first invariant

Ordinary mobile navigation to `https://lotbiai.com/<original-path>?<original-query>` must reach the LOTBI chooser before any native-app handoff. Desktop requests keep the existing site UI.

The site runtime applies only to user-facing page navigations. Static assets, `robots.txt`, `sitemap.xml`, `/.well-known/*`, `/api/*`, `/app/open/*`, and machine-readable/static extensions are excluded. GitHub Pages serves static content only; non-GET mutation requests are not routed through a chooser handler.

## Web choice

The visible URL stays on the original same-origin path/query. Choosing **웹으로 이용하기** records a short-lived host-only `__Host-lotbi_web_choice` cookie with `Secure`, `SameSite=Lax`, `Path=/`, and a ten-minute max age.

For `/app/open/...` fallback navigation, a temporary same-origin `__lotbi_web=1` query marker is added only to the validated internal target. On arrival it is removed with `history.replaceState`, the web-choice cookie is set, and no external redirect target is accepted.

## Reserved app bridge

The reserved post-chooser bridge is:

`https://lotbiai.com/app/open/<original-path>?<original-query>`

Examples:

- `/` -> `/app/open/`
- `/product/123` -> `/app/open/product/123`
- `/product/123?ref=kakao&qty=2` -> `/app/open/product/123?ref=kakao&qty=2`

The bridge carries navigation context only. It never grants purchase, payment, order, approval, or Transaction Kernel authority.

## App-not-installed fallback

GitHub Pages `404.html` detects `/app/open/...`, reconstructs only the same-origin relative destination, and shows a safe fallback with **웹으로 이용하기**. It does not invent Play Store or App Store URLs.

## Security rules

Targets are rejected to `/` when they are not same-origin relative paths or when they use protocol-relative, backslash, null-byte, static/machine-resource, or recursive `/app/open` forms. Query encoding is preserved except the temporary LOTBI bypass marker.

No `assetlinks.json` or Apple App Site Association file is published by this workstream.

## Native handoff gate

`APP_LINK_READY` remains `false` until the app workstream provides all of the following:

1. Android App Link scope limited to the post-chooser activation contract, with the real production/Google Play signing certificate fingerprint.
2. iOS Universal Link scope limited to the post-chooser activation contract, with the real Apple Team ID and verified production bundle identifier.
3. Installed-app restoration of the original path/query verified on Android and iPhone real devices.
4. App-not-installed and in-app-browser fallback verified without redirect loops.
5. Any store URLs used are real published LOTBI listings.

Until then the chooser CTA is disabled as **LOTBI 앱 준비 중**.
