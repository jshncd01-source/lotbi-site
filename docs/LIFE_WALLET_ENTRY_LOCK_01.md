# LOTBI Life Wallet Entry Lock 01 — PC Web

## Scope and owner connection

- Repository: `lotbi-site`
- Surface: official `lotbiai.com` Desktop Web and responsive Mobile Web
- Native Android/iOS release code and deployment are outside this change.
- The existing Site child session and `/v2/me` identity contract remain the login owner. Opening Life Wallet revalidates that session and uses the returned stable `userId` only to derive an opaque local account scope.
- No new Core API, media upload, database migration, analytics event, or server-side wallet storage is introduced.

## Unlock and encryption

- PC Web offers exactly one unlock method: a Wallet-only numeric 4-digit PIN. It does not claim Windows Hello, Face ID, fingerprint, WebAuthn, or Passkey support.
- LOTBI login does not unlock the vault. The user must enter the PIN after the Site session is verified.
- The PIN is not the data-encryption key. Web Crypto generates a random 256-bit AES-GCM master key. PBKDF2-HMAC-SHA-256 with a random salt and 310,000 iterations protects that master key, and a second non-extractable device key stored by IndexedDB adds a browser-profile-bound wrapping layer.
- Card name, kind, note, front image, and optional back image are encrypted before IndexedDB storage. No plaintext card index, thumbnail, PIN, or master key is written to `localStorage`, logs, analytics, or Core requests.
- Three failed attempts start an increasing persisted wait. Five failures block PIN unlock. Because PC Web has no approved fresh reauthentication/key-recovery contract, the screen truthfully directs the user to support and does not invent an insecure reset path.

## Data and lifecycle

- Only user-selected JPEG/PNG originals are displayed. No sample ID/passport, generated image, OCR, or AI rewrite is stored.
- Empty vaults show `첫 자료 등록하기`. Existing vaults show only records decrypted after a successful PIN unlock.
- The in-memory key and decrypted DOM are cleared on Wallet exit, explicit lock, logout/session expiry, page hide/background transition, refresh/navigation, and 60 seconds of inactivity.
- Encrypted `.lotbiwallet` export/import uses a separate user-provided backup password, PBKDF2-HMAC-SHA-256 with 600,000 iterations, and AES-256-GCM. Import never overwrites an existing record ID.

## Verification status

- Automated: PIN format and leading zero, encrypted-at-rest record, locked read denial, correct/wrong PIN, PIN change, account isolation, failure wait/block, encrypted backup and duplicate-safe import.
- Local Chromium Desktop Web: unauthenticated gate, PIN `0123` setup, empty state, explicit lock, on-screen keypad unlock — PASS with synthetic data only.
- Local Chromium Mobile Web 390×844: PIN keypad and explanatory copy visible without clipping — PASS as viewport emulation, not a physical phone test.
- Actual Production authenticated account, file picker/camera, real background timer, multi-tab browser behavior, and browser-profile migration remain Production verification gates. Never use a real identity document for those checks.
