const REQUEST_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const TAU=Math.PI*2;
const PROFILE_VERSION='1.0.0';
const PROFILE_KEYS=['version','requestId','reducedMotion','cadenceHz','phase','pitchGain','rollGain','bodyGain','gazeGain','dotStep','dotDirection'];

function validateId(requestId) {
  if(typeof requestId!=='string'||!REQUEST_ID.test(requestId)) throw new TypeError('Invalid request id');
}

// FNV-1a over the ASCII request-id contract. This is presentation entropy only,
// never an authority, identity or security primitive.
function hash32(text) {
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++) {h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return h>>>0;
}
function mix32(value) {
  let x=value>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return x>>>0;
}
const unit=(seed,salt)=>mix32((seed^salt)>>>0)/0x100000000;
const range=(seed,salt,min,max)=>min+(max-min)*unit(seed,salt);

export function deriveSpeechVariation(requestId,{reducedMotion=false}={}) {
  validateId(requestId);
  if(typeof reducedMotion!=='boolean') throw new TypeError('reducedMotion must be boolean');
  const seed=hash32(requestId);
  return Object.freeze({
    version:PROFILE_VERSION,
    requestId,
    reducedMotion,
    cadenceHz:range(seed,0x9e3779b9,.92,1.18),
    phase:range(seed,0x243f6a88,0,TAU),
    pitchGain:range(seed,0xb7e15162,.82,1.08),
    rollGain:range(seed,0x8aed2a6b,.80,1.12),
    bodyGain:range(seed,0x165667b1,.84,1.08),
    gazeGain:range(seed,0xd3a2646c,.82,1.08),
    dotStep:range(seed,0xfd7046c5,.92,1.34),
    dotDirection:unit(seed,0xb55a4f09)<.5?-1:1
  });
}

function validateProfile(profile) {
  if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.keys(profile).length!==PROFILE_KEYS.length||!PROFILE_KEYS.every(k=>Object.hasOwn(profile,k))) throw new TypeError('Invalid speech variation profile');
  validateId(profile.requestId);
  if(profile.version!==PROFILE_VERSION||typeof profile.reducedMotion!=='boolean'||![profile.cadenceHz,profile.phase,profile.pitchGain,profile.rollGain,profile.bodyGain,profile.gazeGain,profile.dotStep].every(Number.isFinite)||![ -1,1 ].includes(profile.dotDirection)) throw new TypeError('Invalid speech variation profile');
  if(profile.cadenceHz<.92||profile.cadenceHz>1.18||profile.phase<0||profile.phase>=TAU||profile.pitchGain<.82||profile.pitchGain>1.08||profile.rollGain<.80||profile.rollGain>1.12||profile.bodyGain<.84||profile.bodyGain>1.08||profile.gazeGain<.82||profile.gazeGain>1.08||profile.dotStep<.92||profile.dotStep>1.34) throw new RangeError('Speech variation profile out of bounds');
}

// Micro-expression only: no gesture selection, action/clip changes, mouth, lip or
// viseme channels. Consumers may add the bounded offsets after base speech pose.
export function sampleSpeechVariation(profile,position,energy) {
  validateProfile(profile);
  if(!Number.isFinite(position)||position<0||position>45||!Number.isFinite(energy)||energy<0||energy>1) throw new RangeError('Invalid speech variation sample');
  if(energy===0) return Object.freeze({headPitchDeg:0,headRollDeg:0,bodyPitchDeg:0,gazeYOffset:0,dots:Object.freeze([0,0,0])});
  if(profile.reducedMotion) return Object.freeze({headPitchDeg:0,headRollDeg:0,bodyPitchDeg:0,gazeYOffset:0,dots:Object.freeze([energy,energy,energy])});

  const base=TAU*profile.cadenceHz*position+profile.phase;
  const headPitchDeg=.48*profile.pitchGain*Math.sin(base)*energy;
  const headRollDeg=.30*profile.rollGain*Math.sin(base*.61+1.1)*energy;
  const bodyPitchDeg=.20*profile.bodyGain*Math.sin(base*.43-0.7)*energy;
  const gazeYOffset=.018*profile.gazeGain*Math.sin(base*.79+0.35)*energy;
  const dots=[0,1,2].map(i=>Math.min(1,energy*(.76+.24*Math.sin(base*1.07+profile.dotDirection*i*profile.dotStep)**2)));
  return Object.freeze({headPitchDeg,headRollDeg,bodyPitchDeg,gazeYOffset,dots:Object.freeze(dots)});
}
