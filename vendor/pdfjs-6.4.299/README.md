# Mozilla pdf.js 6.4.299 (vendored)

Life Wallet draws a chosen PDF page into a canvas in the browser, so documents never leave
the device. Loaded only when a PDF is selected (`site-life-wallet-pdf.js`).

- Source: npm `pdfjs-dist@6.4.299` (Apache-2.0, see `LICENSE`), legacy build for older mobile browsers.
- `pdf.min.js` = `legacy/build/pdf.min.mjs`, `pdf.worker.min.js` = `legacy/build/pdf.worker.min.mjs`
  (renamed to `.js` because the site's nginx serves `.mjs` as `application/octet-stream`,
  which browsers refuse to run as a module).
- `cmaps/`: Korean CMaps only (`Adobe-Korea1-*`, `KSC*`, `UniKS-*`) for PDFs whose Korean fonts are not embedded.
- `wasm/`: JBIG2, OpenJPEG and QCMS decoders for scanned PDFs; their licenses sit next to them.
  The script engine (`quickjs-eval`) and the no-wasm JS fallbacks are left out on purpose.
- Sealed: not rewritten by `scripts/asset_cache_version.mjs`; a new version gets a new folder.

SHA-256:

```
bccc24ea711db8e44503629519904a5292d73b9daaa214bbe7cdcc282b0f4259  pdf.min.js
145d2dd3ab0c86151011dba95acfa2d5336e2accd59388ea43dbee0efddaaec6  pdf.worker.min.js
466f45c2a61a698152fb5400c27e56ff2ceb73dcb71fde3fc366a502308eaab0  wasm/jbig2.wasm
95e5002597af0824004aa57b1900fe019715db389e37640b1e58395e42f00cc5  wasm/openjpeg.wasm
663d86126d5f5fcb1c61490f94353e2a8375660b8c5498ab3ebab5a34b08800e  wasm/qcms_bg.wasm
```
