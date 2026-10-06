import assert from 'node:assert/strict';
import {createBackdropDismissGuard} from '../site-surface-dismiss.js';

const backdrop = {};
const content = {};

const guard = createBackdropDismissGuard(backdrop);

guard.notePointerDown({target: content});
assert.equal(
  guard.shouldDismiss({target: backdrop}),
  false,
  'a text drag that starts inside the panel and ends on the backdrop must keep the workspace open',
);

guard.notePointerDown({target: backdrop});
assert.equal(
  guard.shouldDismiss({target: backdrop}),
  true,
  'a direct backdrop press and click must still close the workspace',
);

assert.equal(
  guard.shouldDismiss({target: backdrop}),
  true,
  'a synthetic backdrop click without a pointerdown must retain the existing close contract',
);

console.log('SURFACE_DRAG_DISMISS_GUARD_01 PASS');
