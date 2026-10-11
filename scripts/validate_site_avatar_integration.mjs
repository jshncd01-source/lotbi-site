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
const assetVersion = JSON.parse(read('site-asset-version.json')).version;

assert.ok(index.includes('data-lotbi-avatar-stage'));
assert.ok(index.includes('data-lotbi-avatar-fallback'));
const homeAvatarVersion = index.match(/src="site-avatar\.js\?v=([^"]+)"/)?.[1] || '';
const homeAvatarCssVersion = index.match(/href="site-avatar\.css\?v=([^"]+)"/)?.[1] || '';
const callbackAvatarVersion = callbackHtml.match(/src="\/site-avatar\.js\?v=([^"]+)"/)?.[1] || '';
const callbackAvatarCssVersion = callbackHtml.match(/href="\/site-avatar\.css\?v=([^"]+)"/)?.[1] || '';
assert.ok(homeAvatarVersion);
assert.equal(homeAvatarCssVersion, homeAvatarVersion);
assert.equal(callbackAvatarVersion, homeAvatarVersion);
assert.equal(callbackAvatarCssVersion, homeAvatarVersion);
assert.ok(index.includes('"three": "/avatar-runtime/vendor/three/three.module.js"'));
assert.ok(index.includes('"three/addons/": "/avatar-runtime/vendor/three/addons/"'));

assert.ok(callbackHtml.includes('"three": "/avatar-runtime/vendor/three/three.module.js"'));
assert.ok(callback.includes("new CustomEvent('lotbi:home-shell-hydrated')"));

for (const token of [
  "const MODEL_URL = '/assets/models/lotbi-logo-aligned-v3-rigged.glb'",
  "const MODEL_SHA256 = 'a45cc1865018697737e90aba108f821c33220bfa244a34fc73f7d79b25633058'",
  "const AVATAR_SOURCE_HEAD = 'b131f898246ce9852d23dd17009f5914b6ae252e'",
  "const CLIPS_URL = '/assets/animations/lotbi-clips.v1.json?v=20260924-running1'",
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
  'let desiredLifecycle = null',
  "['listening-end', 'response-complete', 'cancel'].includes(detail.phase)",
  'activeMount?.driveLifecycle(detail)',
  'if (desiredLifecycle) driveLifecycle(desiredLifecycle)',
  'controller.setBackground(document.hidden, now)',
  "container.classList.remove('avatar-processing')",
  'const resumeId = `${desiredLifecycle.requestId}.r${++lifecycleResumeSequence}`',
  "controller.hostEvent(lifecycleToken, phase, now)",
]) assert.ok(avatar.includes(token), `missing Site Avatar runtime contract: ${token}`);
assert.ok(avatar.includes(`./avatar-runtime/runtime/controller.mjs?v=${assetVersion}`));
assert.ok(avatar.includes(`./avatar-runtime/runtime/refinement.mjs?v=${assetVersion}`));

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
  'assets/models/lotbi-logo-aligned-v3-rigged.glb',
  'tools/build_logo_aligned_avatar.py',
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

// SITE-AVATAR-LOGO-ALIGN-01 — the shipped model is the logo-aligned one. It is
// derived from the sealed V5 GLB above (kept byte-identical and still served for
// cached pages), changes only how the character looks, and moves exactly as before.
const ALIGNED = 'assets/models/lotbi-logo-aligned-v3-rigged.glb';
assert.equal(
  createHash('sha256').update(bytes(ALIGNED)).digest('hex'),
  'a45cc1865018697737e90aba108f821c33220bfa244a34fc73f7d79b25633058',
  'logo-aligned GLB bytes changed (rebuild with tools/build_logo_aligned_avatar.py and re-review)',
);
assert.ok(bytes(ALIGNED).length <= bytes('assets/models/lotbi-faithful-v2-rigged.glb').length, 'no heavier than the V5 model');
const readGlb = buffer => {
  const length = buffer.readUInt32LE(12);
  const doc = JSON.parse(buffer.subarray(20, 20 + length).toString('utf8'));
  const bin = buffer.subarray(28 + length);
  const width = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
  const accessor = index => {
    const acc = doc.accessors[index];
    const view = doc.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const count = acc.count * width[acc.type];
    const Type = {5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array}[acc.componentType];
    return new Type(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + count * Type.BYTES_PER_ELEMENT));
  };
  return {doc, accessor};
};
const v5 = readGlb(model);
const aligned = readGlb(bytes(ALIGNED));
assert.equal(aligned.doc.asset.extras.derivedFromSha256, 'fb2729f56f18844e85a821f1cc8f2f6a7c64c95fa858bfcda994632131a35c3d');
assert.equal(aligned.doc.asset.extras.mouth, false);
assert.equal(aligned.doc.asset.extras.animationCount, 13);
// Same skeleton: every node (name, parent, transform) and every mesh name.
assert.deepEqual(aligned.doc.nodes.map(({name, children, translation, rotation, scale, mesh}) => ({name, children, translation, rotation, scale, mesh})),
  v5.doc.nodes.map(({name, children, translation, rotation, scale, mesh}) => ({name, children, translation, rotation, scale, mesh})));
assert.deepEqual(aligned.doc.meshes.map(mesh => mesh.name), v5.doc.meshes.map(mesh => mesh.name));
assert.deepEqual(aligned.doc.materials.map(material => material.name), v5.doc.materials.map(material => material.name));
assert.ok(aligned.doc.meshes.every(mesh => !mesh.primitives.some(primitive => primitive.targets?.length)));
// Same motion: all 13 animations, channel by channel, sample by sample.
assert.deepEqual(aligned.doc.animations.map(a => a.name), v5.doc.animations.map(a => a.name));
for (const [index, animation] of aligned.doc.animations.entries()) {
  const before = v5.doc.animations[index];
  assert.deepEqual(animation.channels, before.channels, `${animation.name}: channels`);
  for (const [s, sampler] of animation.samplers.entries()) {
    assert.equal(sampler.interpolation, before.samplers[s].interpolation);
    assert.deepEqual([...aligned.accessor(sampler.input)], [...v5.accessor(before.samplers[s].input)], `${animation.name}: times`);
    assert.deepEqual([...aligned.accessor(sampler.output)], [...v5.accessor(before.samplers[s].output)], `${animation.name}: values`);
  }
}
// The logo's look: crest inside the camera frame (the site shows up to z ~= 2.43,
// the V5 crest reached 2.37), and the logo's measured colours.
const mesh = (glb, name) => glb.doc.meshes.find(m => m.name === name).primitives[0];
const zMax = name => aligned.doc.accessors[mesh(aligned, name).attributes.POSITION].max[2];
assert.ok(zMax('CrestContinuousGradient') <= 2.375 && zMax('CrestWhiteBase') <= 2.375, 'crest stays inside the home frame');
const colourMean = name => {
  const values = aligned.accessor(mesh(aligned, name).attributes.COLOR_0);
  const sum = [0, 0, 0];
  for (let i = 0; i < values.length; i += 3) for (let k = 0; k < 3; k += 1) sum[k] += values[i + k];
  return sum.map(v => v / (values.length / 3));
};
const [lr, lg, lb] = colourMean('LeftEarPink');
const [rr, rg, rb] = colourMean('RightEarBlue');
const [er, eg, eb] = colourMean('LeftEye');
assert.ok(lr > 0.9 && lg < 0.25 && lb < 0.35, `left ear is the logo's coral red (${lr}, ${lg}, ${lb})`);
assert.ok(rb > 0.9 && rr < 0.1 && rg < 0.35, `right ear is the logo's blue (${rr}, ${rg}, ${rb})`);
assert.ok(eb > 0.9 && er < 0.05 && eg < 0.3, `eyes glow blue like the logo (${er}, ${eg}, ${eb})`);
const crestColours = aligned.accessor(mesh(aligned, 'CrestContinuousGradient').attributes.COLOR_0);
let reddish = 0;
for (let i = 0; i < crestColours.length; i += 3) if (crestColours[i] > 0.6 && crestColours[i + 2] < 0.5) reddish += 1;
assert.ok(reddish / (crestColours.length / 3) > 0.5, 'the crest fin is mostly the logo red');

console.log('SITE-WEB-3D-AVATAR-INTEGRATION-01 + FALLBACK-RETRY-02 + LOGO-ALIGN-01 CONTRACT PASS');
