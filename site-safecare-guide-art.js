export const SAFECARE_GUIDE_ART = Object.freeze({
  person: 'assets/safecare/person-capture-guide-v1.png',
  dog: 'assets/safecare/dog-capture-guide-v1.png',
  cat: 'assets/safecare/cat-capture-guide-v1.png',
});

export function createSafeCareGuideArtwork(kind) {
  const src = SAFECARE_GUIDE_ART[kind];
  if (!src) throw new TypeError(`Unknown SafeCare guide artwork: ${kind}`);
  const image = document.createElement('img');
  image.className = 'safecare-guide-art';
  image.src = src;
  image.alt = '';
  image.width = 112;
  image.height = 112;
  image.loading = 'eager';
  image.fetchPriority = 'high';
  image.decoding = 'async';
  return image;
}
