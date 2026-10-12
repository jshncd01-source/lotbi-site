# Life Wallet entry design 01 — release handoff

## Scope

- Branch: `feature/life-wallet-entry-design-01-site`
- Base: Ncloud Site `main` `29cc6b13a7e081dda6a224717f50d0efcfa53e25`
- This branch is based on the prior Life Wallet session/category recovery branch and keeps that branch's session handoff and owner-selected category repair.
- The left navigation, logo, avatar, profile, recent chats, route order, wallet vault schema, PIN KDF, encrypted records, backup envelope, and existing items are not changed.

## Delivered

- The locked PIN view is a responsive contained card with the existing LOTBI blue accent and lock mark.
- The entry title is `PIN을 입력해 주세요`.
- The numeric pad remains 3 by 4; its single primary action is `열기`. The former duplicate `PIN으로 열기` button is removed.
- The web flow remains PIN-only; it does not claim or invoke WebAuthn, passkeys, Windows Hello, or biometric data.

## Native platform decision

- No mobile-app source change is required in this handoff. The current native wallet bridge already uses Android `BiometricPrompt` with `BIOMETRIC_STRONG | DEVICE_CREDENTIAL`, and iOS `LAContext.deviceOwnerAuthentication`, to unwrap the device-bound wallet key.
- This uses OS/device authentication only. LOTBI does not receive biometric templates or raw biometric data.
- Unsupported, cancel, failure, reset, new-device, and lockout paths remain on the existing PIN fallback or native error path. No server-side account passkey endpoint is coupled to wallet unlock.

## Verification

- PASS: `node scripts/asset_cache_version.mjs` (`aset-b224e33eef8d`)
- PASS: `node scripts/validate_life_wallet_entry_lock_01.mjs`
- PASS: `node scripts/validate_life_wallet_mobile_p0_01.mjs` (360/390/412px fixture)
- PASS: `node scripts/validate_life_wallet_pin_attachment_ux_p0.mjs`
- PASS: document save, PDF fallback, camera/exif parity, photo picker, session continuity, consumer sections, storage persistence checks.
- NOT TESTED: exact production-serving revision and real-device Android/iOS biometric prompt; no production deployment was performed.
- NOT TESTED: desktop sidebar browser screenshot fixture, because the local script cannot locate a supported Chrome/Chromium binary. Source scope does not alter sidebar markup or styles.

## Release boundary

- READY FOR GATE REVIEW only. Not merged, not deployed, and not production E2E verified.
- Deployment owner must independently review and merge through the Ncloud release gate. Do not force-push, reset, or run a production user-data test.
