import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js?v=aset-cdfb642c3b79';
import {AvatarController} from './avatar-runtime/runtime/controller.mjs?v=aset-cdfb642c3b79';
import {createFaithfulBinding} from './avatar-runtime/runtime/faithful-binding.mjs?v=aset-cdfb642c3b79';
import {sampleRefinement} from './avatar-runtime/runtime/refinement.mjs?v=aset-cdfb642c3b79';

const MODEL_URL = '/assets/models/lotbi-faithful-v2-rigged.glb';
const MODEL_SHA256 = 'fb2729f56f18844e85a821f1cc8f2f6a7c64c95fa858bfcda994632131a35c3d';
const AVATAR_SOURCE_HEAD = 'b131f898246ce9852d23dd17009f5914b6ae252e';
const CLIPS_URL = '/assets/animations/lotbi-clips.v1.json?v=20260924-running1';
const CONTRACT_URL = '/avatar-runtime/contracts/avatar-rig-controls.v2.json';
const READY_EVENT = 'lotbi-avatar-ready';
const ERROR_EVENT = 'lotbi-avatar-error';
const LIFECYCLE_EVENT = 'lotbi-avatar-lifecycle';

let activeMount = null;
let pendingStage = null;
let mountGeneration = 0;
let desiredLifecycle = null;
const terminalStages = new WeakSet();
const diagnostics = {
  mounts: 0,
  disposals: 0,
  loadMs: null,
  state: 'waiting',
  errorCode: null,
};

const monotonicSeconds = () => performance.now() / 1000;

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'force-cache',
    referrerPolicy: 'same-origin',
  });
  if (!response.ok) throw new Error(`LOTBI Avatar asset load failed: ${url}`);
  return response.json();
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, {detail: Object.freeze({...detail})}));
}

function disposeScene(root) {
  root?.traverse(object => {
    if (object.geometry?.dispose) object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture && value.dispose) value.dispose();
      }
      material.dispose?.();
    }
  });
}

function currentSnapshot() {
  const stage = document.querySelector('[data-lotbi-avatar-stage]');
  return Object.freeze({
    version: 'site-avatar-v5-approved-integration-01',
    sourceHead: AVATAR_SOURCE_HEAD,
    model: MODEL_URL,
    modelSha256: MODEL_SHA256,
    animationCount: 13,
    mouth: false,
    ready: diagnostics.state === 'ready',
    state: diagnostics.state,
    errorCode: diagnostics.errorCode,
    loadMs: diagnostics.loadMs,
    mounts: diagnostics.mounts,
    disposals: diagnostics.disposals,
    connectedStage: Boolean(stage?.isConnected),
    canvasCount: stage?.querySelectorAll('canvas').length ?? 0,
    width: stage?.clientWidth ?? 0,
    height: stage?.clientHeight ?? 0,
  });
}

async function mountAvatar(stage) {
  if (!stage?.isConnected || activeMount?.stage === stage || pendingStage === stage || terminalStages.has(stage)) return;
  activeMount?.dispose();
  pendingStage = stage;

  const generation = ++mountGeneration;
  const container = stage.closest('[data-lotbi-avatar-container]');
  if (!container) return;

  const startedAt = performance.now();
  diagnostics.state = 'loading';
  diagnostics.errorCode = null;
  container.classList.remove('avatar-3d-ready', 'avatar-3d-fallback');
  container.classList.add('avatar-3d-loading');

  let renderer = null;
  let scene = null;
  let avatarRoot = null;
  let floor = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let disposed = false;
  let controller = null;
  let reducedMotionQuery = null;
  let lifecycleToken = null;
  let lifecycleResumeSequence = 0;
  let runtimeEpochSeconds = 0;
  const runtimeSeconds = () => Math.max(0, monotonicSeconds() - runtimeEpochSeconds);

  const resize = () => {
    if (disposed || !renderer) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    const camera = activeMount?.stage === stage ? activeMount.camera : null;
    if (camera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };

  const handleVisibility = () => {
    if (!controller || disposed) return;
    try {
      const now = runtimeSeconds();
      controller.setBackground(document.hidden, now);
      if (document.hidden) {
        lifecycleToken = null;
        container.classList.remove('avatar-processing');
        return;
      }
      if (desiredLifecycle && ['listening-start', 'response-wait'].includes(desiredLifecycle.phase)) {
        const resumeId = `${desiredLifecycle.requestId}.r${++lifecycleResumeSequence}`;
        lifecycleToken = controller.beginTurn(resumeId, now);
        controller.hostEvent(lifecycleToken, desiredLifecycle.phase, now);
        container.classList.toggle('avatar-processing', desiredLifecycle.phase === 'response-wait');
      }
    } catch (error) {
      container.classList.remove('avatar-processing');
      console.error('LOTBI Avatar lifecycle fallback', error);
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibility);
    reducedMotionQuery?.removeEventListener?.('change', handleReducedMotion);
    renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
    disposeScene(avatarRoot);
    floor?.geometry.dispose();
    floor?.material.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss?.();
    renderer?.domElement.remove();
    container.classList.remove('avatar-3d-loading', 'avatar-3d-ready', 'avatar-processing', 'avatar-reduced-motion');
    diagnostics.disposals += 1;
    if (activeMount?.stage === stage) activeMount = null;
  };

  const fail = (code, error) => {
    if (disposed) return;
    terminalStages.add(stage);
    if (pendingStage === stage) pendingStage = null;
    dispose();
    container.classList.add('avatar-3d-fallback');
    diagnostics.state = 'fallback';
    diagnostics.errorCode = code;
    emit(ERROR_EVENT, {code});
    console.error('LOTBI 3D Avatar fallback', error);
  };

  const handleContextLost = event => {
    event.preventDefault();
    fail('WEBGL_CONTEXT_LOST', new Error('WebGL context lost'));
  };

  const handleReducedMotion = event => {
    if (!controller || disposed) return;
    container.classList.toggle('avatar-reduced-motion', Boolean(event.matches));
    controller.setReducedMotion(Boolean(event.matches), runtimeSeconds());
  };

  try {
    const [contract, clips, gltf] = await Promise.all([
      fetchJson(CONTRACT_URL),
      fetchJson(CLIPS_URL),
      new GLTFLoader().loadAsync(MODEL_URL),
    ]);
    if (generation !== mountGeneration || !stage.isConnected) {
      disposeScene(gltf.scene);
      if (pendingStage === stage) pendingStage = null;
      dispose();
      return;
    }

    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, .01, 30);
    camera.position.set(.62, .85, 2.9);
    camera.lookAt(0, .55, 0);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    stage.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe6efff, 0xb4bfd3, 1.5));
    const key = new THREE.DirectionalLight(0xfff5f3, 4.2);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9caff, 2);
    rim.position.set(2, 1, -2);
    scene.add(rim);

    // The approved V5 asset is authored Z-up/front -Y. This wrapper is a
    // presentation transform only; the locked GLB geometry is untouched.
    gltf.scene.rotation.x = -Math.PI / 2;
    gltf.scene.scale.setScalar(.56);
    avatarRoot = new THREE.Group();
    avatarRoot.name = 'LOTBIAvatarSiteRuntimeRoot';
    avatarRoot.add(gltf.scene);
    scene.add(avatarRoot);

    floor = new THREE.Mesh(
      new THREE.CircleGeometry(.33, 64),
      new THREE.MeshBasicMaterial({color: 0xdce5f5, transparent: true, opacity: .72}),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.07;
    avatarRoot.add(floor);

    if (gltf.animations.length !== 13) throw new Error('Approved V5 animation set missing');
    const binding = createFaithfulBinding(gltf.scene, contract);
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    container.classList.toggle('avatar-reduced-motion', reducedMotionQuery.matches);
    runtimeEpochSeconds = monotonicSeconds();
    controller = new AvatarController(clips, contract, {
      speechMode: 'audio',
      reducedMotion: reducedMotionQuery.matches,
    });
    reducedMotionQuery.addEventListener?.('change', handleReducedMotion);

    const driveLifecycle = ({phase, requestId} = {}) => {
      const now = runtimeSeconds();
      if (phase === 'listening-start' || phase === 'response-wait') {
        if (document.hidden) {
          container.classList.remove('avatar-processing');
          return;
        }
        if (phase === 'response-wait') container.classList.add('avatar-processing');
        else container.classList.remove('avatar-processing');
        if (!lifecycleToken || lifecycleToken.id !== requestId) {
          if (lifecycleToken) controller.cancel(now, 'site-lifecycle-replaced');
          lifecycleToken = controller.beginTurn(requestId, now);
        }
        controller.hostEvent(lifecycleToken, phase, now);
        return;
      }
      if (phase === 'listening-end' && lifecycleToken) {
        controller.hostEvent(lifecycleToken, phase, now);
        return;
      }
      if (phase === 'response-complete' || phase === 'cancel') {
        container.classList.remove('avatar-processing');
      }
      if (phase === 'response-complete' && lifecycleToken) {
        controller.accept(lifecycleToken, {
          schema_version: '0.1.0-draft', request_id: lifecycleToken.id,
          speech: '', emotion: 'neutral', intensity: 0, gesture: 'none',
        }, now);
        lifecycleToken = null;
        return;
      }
      if (phase === 'cancel' && lifecycleToken) {
        controller.cancel(now, 'site-lifecycle-cancel');
        lifecycleToken = null;
      }
    };

    activeMount = {stage, camera, dispose, driveLifecycle};
    if (desiredLifecycle) driveLifecycle(desiredLifecycle);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    window.addEventListener('resize', resize, {passive: true});
    document.addEventListener('visibilitychange', handleVisibility);
    resize();

    const frame = timestampMs => {
      if (disposed) return;
      const time = runtimeSeconds();
      const controls = controller.sample(time);
      binding.apply(sampleRefinement(controller, time, controls).controls);
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);

    diagnostics.mounts += 1;
    if (pendingStage === stage) pendingStage = null;
    diagnostics.loadMs = Math.round(performance.now() - startedAt);
    diagnostics.state = 'ready';
    container.classList.remove('avatar-3d-loading', 'avatar-3d-fallback');
    container.classList.add('avatar-3d-ready');
    emit(READY_EVENT, {loadMs: diagnostics.loadMs, model: MODEL_URL});
  } catch (error) {
    fail('RUNTIME_INIT_FAILED', error);
  }
}

function reconcileAvatar() {
  const stage = document.querySelector('[data-lotbi-avatar-stage]');
  if (!stage) {
    activeMount?.dispose();
    return;
  }
  if (activeMount?.stage !== stage && pendingStage !== stage && !terminalStages.has(stage)) void mountAvatar(stage);
}

const documentObserver = new MutationObserver(reconcileAvatar);
documentObserver.observe(document.documentElement, {childList: true, subtree: true});
window.addEventListener('lotbi:home-shell-hydrated', reconcileAvatar);
window.addEventListener(LIFECYCLE_EVENT, event => {
  const detail = event instanceof CustomEvent ? event.detail : undefined;
  if (!detail || typeof detail.phase !== 'string' || typeof detail.requestId !== 'string') return;
  if (detail.phase === 'listening-start' || detail.phase === 'response-wait') {
    desiredLifecycle = Object.freeze({phase: detail.phase, requestId: detail.requestId});
  } else if (
    ['listening-end', 'response-complete', 'cancel'].includes(detail.phase)
    && desiredLifecycle?.requestId === detail.requestId
  ) {
    desiredLifecycle = null;
  }
  activeMount?.driveLifecycle(detail);
});
window.addEventListener('pagehide', () => activeMount?.dispose(), {once: true});

Object.defineProperty(window, '__lotbiSiteAvatar', {
  value: Object.freeze({snapshot: currentSnapshot}),
  writable: false,
  configurable: false,
});

reconcileAvatar();
