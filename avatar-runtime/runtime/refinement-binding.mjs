import {Color} from 'three';
import {createThreeBinding} from './three-binding.mjs?v=aset-aa858474e430';

export function createRefinementBinding(scene,contract) {
  const base=createThreeBinding(scene,contract),materials=new Map(),dots=[];
  scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.set(m.name,m);});
  for(let i=1;i<=3;i++) {
    const dot=scene.getObjectByName('SpeechDot_'+i);
    if(!dot)throw new Error('Missing speech activity dot');
    // Shared in GLB; independent opacity at runtime for audio-reactive dots.
    dot.material=dot.material.clone();dot.material.transparent=true;dot.material.depthWrite=false;dots.push(dot);
  }
  for(const side of ['L','R'])for(const name of ['Listening','Focus','Smile'])if(base.eyes[side].morphTargetDictionary[name]===undefined)throw new Error('Missing refined eye '+name);
  for(const name of ['Display_Rim_Blue','Accent_RedBlue'])if(!materials.has(name))throw new Error('Missing refined material '+name);
  const red=new Color('#ed3158'),blue=new Color('#367aff'),white=new Color('#bce6ff');
  function apply(frame) {
    base.apply(frame.controls);
    for(const side of ['L','R'])for(const [name,w] of Object.entries(frame.eyes[side]))base.eyes[side].morphTargetInfluences[base.eyes[side].morphTargetDictionary[name]]=w;
    dots.forEach((dot,i)=>{dot.visible=frame.dots[i]>0;dot.material.opacity=Math.min(1,frame.dots[i]*2);dot.material.emissiveIntensity=1.3+frame.dots[i];});
    const rim=materials.get('Display_Rim_Blue');rim.emissive.copy(blue);rim.emissiveIntensity=frame.listeningGlow;
    for(const name of ['Accent_RedBlue']) {
      const m=materials.get(name);m.emissive.copy(red).lerp(blue,frame.taskMix).lerp(white,frame.completionLight);
      m.emissiveIntensity=.015+frame.taskGlow+.16*frame.completionLight;
    }
    scene.updateMatrixWorld(true);
  }
  return {apply,base,dots,materials};
}
