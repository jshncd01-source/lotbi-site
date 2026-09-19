import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(path.join(ROOT, relative), 'utf8');
const bytes = relative => readFileSync(path.join(ROOT, relative));

const index = read('index.html');
const callbackHtml = read('auth/callback/index.html');
const callback = read('auth-callback.js');
const avatar = read('site-avatar.js');
const avatarCss = read('site-avatar.css');
const conversationCss = read('site-conversation.css');
const conversation = read('site-conversation.js');

assert.ok(index.includes('data-lotbi-avatar-stage'));
assert.ok(index.includes('data-lotbi-avatar-fallback'));
assert.ok(index.includes('type="module" src="site-avatar.js"'));
assert.ok(index.includes('href="site-avatar.css"'));
assert.ok(index.includes('"three": "/avatar-runtime/vendor/three/three.module.js"'));
assert.ok(index.includes('"three/addons/": "/avatar-runtime/vendor/three/addons/"'));

assert.ok(callbackHtml.includes('type="module" src="/site-avatar.js"'));
assert.ok(callbackHtml.includes('href="/site-avatar.css"'));
assert.ok(callbackHtml.includes('"three": "/avatar-runtime/vendor/three/three.module.js"'));
assert.ok(callback.includes("new CustomEvent('lotbi:home-shell-hydrated')"));

for (const token of [
  "const MODEL_URL = '/assets/models/lotbi-faithful-v2-rigged.glb'",
  "const MODEL_SHA256 = 'fb2729f56f18844e85a821f1cc8f2f6a7c64c95fa858bfcda994632131a35c3d'",
  "const AVATAR_SOURCE_HEAD = 'b131f898246ce9852d23dd17009f5914b6ae252e'",
  "const CLIPS_URL = '/assets/animations/lotbi-clips.v1.json'",
  "const CONTRACT_URL = '/avatar-runtime/contracts/avatar-rig-controls.v2.json'",
  'new GLTFLoader().loadAsync(MODEL_URL)',
  'gltf.animations.length !== 13',
  'createFaithfulBinding(gltf.scene, contract)',
  'camera.position.set(.62, .85, 2.9)',
  'camera.lookAt(0, .55, 0)',
  'new ResizeObserver(resize)',
  "window.addEventListener('resize', resize",
  "document.addEventListener('visibilitychange', handleVisibility)",
  'renderer?.dispose()',
  'renderer?.forceContextLoss?.()',
  'disposeScene(avatarRoot)',
  "container.classList.add('avatar-3d-fallback')",
  'const terminalStages = new WeakSet()',
  'pendingStage === stage',
  'terminalStages.add(stage)',
  '!terminalStages.has(stage)',
  "const documentObserver = new MutationObserver(reconcileAvatar)",
  "window.addEventListener('lotbi:home-shell-hydrated', reconcileAvatar)",
  "Object.defineProperty(window, '__lotbiSiteAvatar'",
  "window.addEventListener(LIFECYCLE_EVENT, event => activeMount?.driveLifecycle(event.detail))",
  "controller.hostEvent(lifecycleToken, phase, now)",
]) assert.ok(avatar.includes(token), `missing Site Avatar runtime contract: ${token}`);

for (const token of [
  "new CustomEvent('lotbi-avatar-lifecycle'",
  "driveAvatar('listening-start'",
  "driveAvatar('listening-end'",
  "driveAvatar('response-wait'",
  "driveAvatar('response-complete'",
  "driveAvatar('cancel'",
]) assert.ok(conversation.includes(token), `missing Site Avatar lifecycle connection: ${token}`);

for (const forbidden of [
  'authorization',
  'account.lotbiai.com',
  'api.lotbiai.com',
  'localstorage',
  'sessionstorage',
  'document.cookie',
  'openai',
]) assert.ok(!avatar.toLowerCase().includes(forbidden), `Avatar runtime crossed a forbidden boundary: ${forbidden}`);

for (const token of [
  '.chat-character-wrap.avatar-3d-ready .site-avatar-stage',
  '.chat-character-wrap.avatar-3d-ready .chat-character-logo',
  '.chat-character-wrap.avatar-3d-fallback .site-avatar-stage',
  '@media (prefers-reduced-motion: reduce)',
]) assert.ok(avatarCss.includes(token), `missing Avatar CSS contract: ${token}`);

assert.ok(conversationCss.includes('.conversation-active .chat-character-wrap'));
assert.ok(conversationCss.includes('width: 44px'));
assert.ok(conversationCss.includes('width: 38px'));
assert.ok(conversationCss.includes('.chat-assistant-row'));
assert.ok(conversationCss.includes('.assistant-avatar-slot'));

const requiredFiles = [
  'assets/models/lotbi-faithful-v2-rigged.glb',
  'assets/animations/lotbi-clips.v1.json',
  'avatar-runtime/contracts/avatar-rig-controls.v2.json',
  'avatar-runtime/runtime/controller.mjs',
  'avatar-runtime/runtime/faithful-binding.mjs',
  'avatar-runtime/runtime/animation.mjs',
  'avatar-runtime/runtime/speech-envelope.mjs',
  'avatar-runtime/runtime/speech-variation.mjs',
  'avatar-runtime/runtime/state-machine.mjs',
  'avatar-runtime/runtime/refinement.mjs',
  'avatar-runtime/runtime/refinement-binding.mjs',
  'avatar-runtime/runtime/three-binding.mjs',
  'avatar-runtime/vendor/three/three.module.js',
  'avatar-runtime/vendor/three/three.core.js',
  'avatar-runtime/vendor/three/addons/loaders/GLTFLoader.js',
  'avatar-runtime/vendor/three/addons/utils/BufferGeometryUtils.js',
];
for (const relative of requiredFiles) assert.ok(bytes(relative).length > 0, `missing Avatar runtime file: ${relative}`);

assert.equal(
  createHash('sha256').update(bytes('assets/models/lotbi-faithful-v2-rigged.glb')).digest('hex'),
  'fb2729f56f18844e85a821f1cc8f2f6a7c64c95fa858bfcda994632131a35c3d',
  'official sealed GLB bytes changed',
);
assert.equal(bytes('assets/models/lotbi-faithful-v2-rigged.glb').length, 1_163_912);

const model = bytes('assets/models/lotbi-faithful-v2-rigged.glb');
assert.equal(model.toString('ascii', 0, 4), 'glTF');
const jsonLength = model.readUInt32LE(12);
assert.equal(model.toString('ascii', 16, 20), 'JSON');
const gltf = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8'));
assert.deepEqual(
  gltf.animations.map(animation => animation.name),
  ['idle', 'blink', 'listening', 'thinking', 'speaking', 'laugh', 'cry', 'surprised', 'worried', 'excited', 'nod', 'wave', 'celebrate'],
);
const authoredNames = [
  ...gltf.nodes.map(node => node.name ?? ''),
  ...gltf.meshes.map(mesh => mesh.name ?? ''),
  ...gltf.materials.map(material => material.name ?? ''),
  ...gltf.animations.map(animation => animation.name ?? ''),
];
assert.ok(authoredNames.every(name => !/(?:mouth|lips?|viseme)/i.test(name)));
assert.ok(gltf.meshes.every(mesh => !mesh.primitives.some(primitive => primitive.targets?.length)));

const clips = JSON.parse(read('assets/animations/lotbi-clips.v1.json'));
const contract = JSON.parse(read('avatar-runtime/contracts/avatar-rig-controls.v2.json'));
for (const action of ['idle', 'listening', 'thinking', 'speaking', 'wave', 'nod']) {
  assert.ok(clips.clips[action], `sealed clip missing: ${action}`);
}
assert.equal(Object.keys(contract.bones).length, 5);

console.log('SITE-WEB-3D-AVATAR-INTEGRATION-01 + FALLBACK-RETRY-02 CONTRACT PASS');
