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
  "const MODEL_URL = '/assets/models/lotbi-logo-character-v5-rigged.glb'",
  "const MODEL_SHA256 = '2c1576a6a29cffb8f006b4ce0497906792efa356191e7ec2d57c5e0bf3f6e8a8'",
  'avatarRoot.rotation.y = Math.atan2(.62, 2.9)',
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
  'assets/models/lotbi-logo-character-v5-rigged.glb',
  'tools/build_logo_character_v5.py',
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

// SITE-AVATAR-LOGO-ALIGN-02 — the shipped model is the logo character
// (assets/brand/lotbi-mark-512.png) in 3D. Every visible shape is rebuilt from the
// logo by tools/build_logo_character_v5.py on the sealed V5 rig above (V5 stays
// byte-identical and is still served for cached pages): same rig, same 13 clips.
const CHARACTER = 'assets/models/lotbi-logo-character-v5-rigged.glb';
assert.equal(
  createHash('sha256').update(bytes(CHARACTER)).digest('hex'),
  '2c1576a6a29cffb8f006b4ce0497906792efa356191e7ec2d57c5e0bf3f6e8a8',
  'logo character GLB bytes changed (rebuild with tools/build_logo_character_v5.py and re-review)',
);
assert.ok(bytes(CHARACTER).length <= bytes('assets/models/lotbi-faithful-v2-rigged.glb').length, 'no heavier than the V5 model');
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
const character = readGlb(bytes(CHARACTER));
assert.equal(character.doc.asset.extras.derivedFromSha256, 'fb2729f56f18844e85a821f1cc8f2f6a7c64c95fa858bfcda994632131a35c3d');
assert.equal(character.doc.asset.extras.mouth, false);
assert.equal(character.doc.asset.extras.animationCount, 13);
// Same rig: every node keeps its name, parent, rotation, scale and mesh. Rest
// positions are V5's except the eye and arm pivots, which sit at the new eyes and
// arm roots: no clip translates them (checked below), and their mesh nodes cancel
// the pivot so the vertices stay in model space.
const MOVED = {
  Rig_LeftEye: ['Rig_Head', 'LeftEye'], Rig_RightEye: ['Rig_Head', 'RightEye'],
  Rig_LeftArm: ['Rig_Root', 'LeftArm', 'LeftShoulderJoint'], Rig_RightArm: ['Rig_Root', 'RightWaveArm', 'RightShoulderJoint'],
};
const movedNames = new Set(Object.entries(MOVED).flatMap(([pivot, [, ...children]]) => [pivot, ...children]));
assert.deepEqual(character.doc.nodes.map(({name, children, rotation, scale, mesh}) => ({name, children, rotation, scale, mesh})),
  v5.doc.nodes.map(({name, children, rotation, scale, mesh}) => ({name, children, rotation, scale, mesh})));
for (const [index, node] of character.doc.nodes.entries()) {
  if (!movedNames.has(node.name)) assert.deepEqual(node.translation, v5.doc.nodes[index].translation, `${node.name}: rest position`);
}
const nodeByName = name => character.doc.nodes.find(node => node.name === name);
const translation = name => nodeByName(name).translation ?? [0, 0, 0];
for (const [pivot, [parent, ...children]] of Object.entries(MOVED)) {
  for (const child of children) {
    const sum = [0, 1, 2].map(k => translation(parent)[k] + translation(pivot)[k] + translation(child)[k]);
    assert.ok(sum.every(v => Math.abs(v) < 1e-5), `${child} vertices stay in model space`);
  }
}
assert.ok(v5.doc.animations.every(animation => animation.channels.every(channel =>
  !(Object.keys(MOVED).includes(v5.doc.nodes[channel.target.node].name) && channel.target.path === 'translation'))),
'no clip translates an eye or arm pivot');
assert.deepEqual(character.doc.meshes.map(mesh => mesh.name), v5.doc.meshes.map(mesh => mesh.name));
const materialNames = character.doc.materials.map(material => material.name);
for (const name of v5.doc.materials.map(material => material.name)) assert.ok(materialNames.includes(name), `material kept: ${name}`);
assert.ok(character.doc.meshes.every(mesh => !mesh.primitives.some(primitive => primitive.targets?.length)));
// Same motion: all 13 animations, channel by channel, sample by sample.
assert.deepEqual(character.doc.animations.map(a => a.name), v5.doc.animations.map(a => a.name));
for (const [index, animation] of character.doc.animations.entries()) {
  const before = v5.doc.animations[index];
  assert.deepEqual(animation.channels, before.channels, `${animation.name}: channels`);
  for (const [s, sampler] of animation.samplers.entries()) {
    assert.equal(sampler.interpolation, before.samplers[s].interpolation);
    assert.deepEqual([...character.accessor(sampler.input)], [...v5.accessor(before.samplers[s].input)], `${animation.name}: times`);
    assert.deepEqual([...character.accessor(sampler.output)], [...v5.accessor(before.samplers[s].output)], `${animation.name}: values`);
  }
}
// Inside the home camera frame (model z about -0.54 to 2.43; the V5 crest reached
// 2.37) -- the horn tip and the tail both keep a margin.
const primitives = name => character.doc.meshes.find(m => m.name === name).primitives;
const bounds = name => primitives(name).reduce((box, primitive) => {
  const acc = character.doc.accessors[primitive.attributes.POSITION];
  return {min: box.min.map((v, k) => Math.min(v, acc.min[k])), max: box.max.map((v, k) => Math.max(v, acc.max[k]))};
}, {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]});
for (const mesh of character.doc.meshes) {
  const box = bounds(mesh.name);
  assert.ok(box.max[2] <= 2.375 && box.min[2] >= -0.48, `${mesh.name} stays inside the home frame (${box.min[2]}..${box.max[2]})`);
}
// The logo's shape: a head much wider than the body, a body ending in a tail to the
// lower left (no feet), a horn up to the right, the waving arm raised.
const head = bounds('HeadShell');
const torso = bounds('SlimDropletTorso');
assert.ok(head.max[0] - head.min[0] >= 1.5 * (torso.max[0] - torso.min[0]), 'big helmet head, about 1.6x the body width like the logo');
assert.ok(torso.min[2] < -0.3, 'the body ends in the logo tail');
const torsoPositions = character.accessor(primitives('SlimDropletTorso')[0].attributes.POSITION);
let lowest = 0;
for (let i = 0; i < torsoPositions.length; i += 3) if (torsoPositions[i + 2] < torsoPositions[lowest + 2]) lowest = i;
assert.ok(torsoPositions[lowest] < -0.15, "the tail leans to the viewer's left like the logo");
assert.ok(bounds('CrestContinuousGradient').max[0] > 0.4, "the horn points up to the viewer's right");
assert.ok(bounds('RightWaveArm').max[2] > bounds('LeftArm').max[2], 'the right arm is the raised one');
// Arms attached: each arm starts inside the body (no gap at the seam), and the
// shoulder fillets are white -- no dark joint dot.
// The arm's innermost point is compared with the body's edge at that same height.
const bodyEdgeAt = (z, side) => {
  let edge = side > 0 ? -Infinity : Infinity;
  for (let i = 0; i < torsoPositions.length; i += 3) {
    if (Math.abs(torsoPositions[i + 2] - z) < 0.04) edge = side > 0 ? Math.max(edge, torsoPositions[i]) : Math.min(edge, torsoPositions[i]);
  }
  return edge;
};
for (const [name, side] of [['LeftArm', -1], ['RightWaveArm', 1]]) {
  const arm = character.accessor(primitives(name)[0].attributes.POSITION);
  let inner = 0;
  for (let i = 0; i < arm.length; i += 3) if (side * arm[i] < side * arm[inner]) inner = i;
  const edge = bodyEdgeAt(arm[inner + 2], side);
  assert.ok(side * (edge - arm[inner]) >= 0.05, `${name} starts at least 0.05 inside the body (${arm[inner]} vs edge ${edge})`);
}
for (const name of ['LeftShoulderJoint', 'RightShoulderJoint']) {
  assert.ok(primitives(name).every(p => character.doc.materials[p.material].name !== 'JointDark'), `${name}: no dark joint dot`);
}
assert.ok(!avatar.includes('CircleGeometry'), 'no floor disc under the floating logo character');
// The logo's measured colours (vertex colours are linear RGB) and glow.
const colourMean = name => {
  const values = character.accessor(primitives(name)[0].attributes.COLOR_0);
  const sum = [0, 0, 0];
  for (let i = 0; i < values.length; i += 3) for (let k = 0; k < 3; k += 1) sum[k] += values[i + k];
  return sum.map(v => v / (values.length / 3));
};
const [lr, lg, lb] = colourMean('LeftEarPink');
const [rr, rg, rb] = colourMean('RightEarBlue');
assert.ok(lr > 0.6 && lg < 0.15 && lb < 0.2, `left ear is the logo's coral red (${lr}, ${lg}, ${lb})`);
assert.ok(rb > 0.75 && rr < 0.1 && rg < 0.35, `right ear is the logo's blue (${rr}, ${rg}, ${rb})`);
const material = name => character.doc.materials.find(m => m.name === name);
const [gr, gg, gb] = material('EyeGlowSoft1').emissiveFactor;
assert.ok(gb >= 0.9 && gr <= 0.05 && gg < 0.35, 'eyes glow the logo blue');
for (const side of ['LeftEye', 'RightEye']) {
  const names = primitives(side).map(p => character.doc.materials[p.material].name);
  assert.ok(names.includes('EyeCyanGlow'), `${side}: one thin glowing arc`);
  assert.ok(names.filter(n => n.startsWith('EyeGlowSoft')).length === 3, `${side}: a soft glow on the glass`);
}
assert.ok(primitives('Visor').some(p => character.doc.materials[p.material].name.startsWith('VisorReflection')), 'the visor has the logo glass reflection');
const crestColours = character.accessor(primitives('CrestContinuousGradient')[0].attributes.COLOR_0);
let reddish = 0;
for (let i = 0; i < crestColours.length; i += 3) if (crestColours[i] > 0.6 && crestColours[i + 2] < 0.5) reddish += 1;
assert.ok(reddish / (crestColours.length / 3) > 0.5, 'the horn is mostly the logo red');
const badgeColours = character.accessor(primitives('BadgeContinuousGradient')[0].attributes.COLOR_0);
let red = 0, blue = 0;
for (let i = 0; i < badgeColours.length; i += 3) {
  if (badgeColours[i] > 0.8 && badgeColours[i + 2] < 0.25) red += 1;
  if (badgeColours[i + 2] > 0.9 && badgeColours[i] < 0.1) blue += 1;
}
assert.ok(red > 0 && blue > 0, 'the badge runs from the logo red to the logo blue');

console.log('SITE-WEB-3D-AVATAR-INTEGRATION-01 + FALLBACK-RETRY-02 + LOGO-ALIGN-02 CONTRACT PASS');
