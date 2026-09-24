// Engine-independent, seconds-based CP4 sampling. No networking or audio playback.
export const ACTIONS = Object.freeze(['idle','blink','listening','thinking','running','speaking','laugh','cry','surprised','worried','excited','nod','wave','celebrate']);
export const smooth = t => { t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
export const zero = contract => Object.fromEntries(Object.keys(contract.controls).map(k=>[k,0]));
export function validateControls(values, contract) {
  if (!values || typeof values!=='object' || Array.isArray(values)) throw new TypeError('controls must be an object');
  for(const [key,value] of Object.entries(values)) {
    const range=contract.controls[key];
    if(!Object.hasOwn(contract.controls,key) || typeof value!=='number' || !Number.isFinite(value) || value<range.min || value>range.max) throw new RangeError('Invalid control: '+key);
  }
}
export function sampleClip(clips, contract, name, seconds, intensity=1, reducedMotion=false) {
  const clip=clips.clips[name];
  if(!Object.hasOwn(clips.clips,name) || !Number.isFinite(seconds) || seconds<0 || !Number.isFinite(intensity) || intensity<0 || intensity>1) throw new RangeError('Invalid clip sample');
  const result=zero(contract);
  const t=Math.min(seconds,clip.duration);
  const i=Math.max(0,clip.keys.findIndex((key,j)=>j<clip.keys.length-1 && t<=clip.keys[j+1][0]));
  const [a,va]=clip.keys[i], [b,vb]=clip.keys[i+1];
  const w=smooth((t-a)/(b-a));
  for(const k of Object.keys(result)) result[k]=((va[k]??0)*(1-w)+(vb[k]??0)*w)*intensity;
  if(reducedMotion) for(const k of Object.keys(result)) {
    if(k==='hover_m') result[k]=0;
    else if(k.endsWith('_deg')) result[k]*=.2;
    else if(k==='display_glow') result[k]*=.25;
  }
  validateControls(result,contract);
  return result;
}
// Crossfade the open emotional eye into ONE closed eye; never add full blink
// displacement on top of an open surprise/sad shape. Gaze diminishes for extremes.
export function eyeWeights(c,side) {
  const blink=c['blink_'+side];
  const sum=c.eye_surprised+c.eye_sad+c.eye_worried;
  const scale=1/Math.max(1,sum);
  const open=1-blink;
  const gaze=open*(1-.85*Math.min(1,sum));
  return {Blink:blink, LookPosX:Math.max(0,c.gaze_x)*gaze,
    LookNegX:Math.max(0,-c.gaze_x)*gaze, LookUp:Math.max(0,c.gaze_y)*gaze,
    LookDown:Math.max(0,-c.gaze_y)*gaze,
    Surprised:c.eye_surprised*scale*open, Sad:c.eye_sad*scale*open,
    Worried:c.eye_worried*scale*open};
}
