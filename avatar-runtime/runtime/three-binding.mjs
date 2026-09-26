import {Euler,Quaternion,Vector3} from 'three';
import {validateControls,eyeWeights,zero} from './animation.mjs?v=aset-a8e6b3637394';

// The CP4 glTF bones have identity local rest rotations. Preserve imported rest
// transforms; Blender XYZ evaluates as Rz*Ry*Rx = Three's intrinsic ZYX.
export function createThreeBinding(scene,contract) {
  const bones={},eyes={},tears={},materials=new Map();
  scene.traverse(o=>{
    if(o.isBone && Object.hasOwn(contract.bones,o.name)) bones[o.name]={object:o,position:o.position.clone(),quaternion:o.quaternion.clone()};
    if(o.isMesh) {
      for(const m of Array.isArray(o.material)?o.material:[o.material]) materials.set(m.name,m);
      if(o.name==='Eye_L'||o.name==='Eye_R') eyes[o.name.slice(-1)]=o;
      if(o.name==='Tear_L'||o.name==='Tear_R') tears[o.name.slice(-1)]=o;
    }
  });
  if(Object.keys(bones).length!==5 || Object.keys(eyes).length!==2 || Object.keys(tears).length!==2 || !materials.has('Display_CyanWhite') || !materials.has('Visor_DeepNavy')) throw new Error('CP4 asset bindings missing');
  for(const side of ['L','R']) for(const name of contract.eye_targets['Eye_'+side]) if(eyes[side].morphTargetDictionary[name]===undefined) throw new Error('Missing eye target '+name);
  function apply(values) {
    validateControls(values,contract);const c={...zero(contract),...values};
    const rotation=Object.fromEntries(Object.keys(bones).map(n=>[n,[0,0,0]]));
    for(const [key,spec] of Object.entries(contract.controls)) if(spec.bone && spec.property==='rotation_euler') rotation[spec.bone][spec.axis_index]=c[key]*spec.sign*Math.PI/180;
    for(const [name,b] of Object.entries(bones)) {
      b.object.position.copy(b.position);
      b.object.quaternion.copy(b.quaternion).multiply(new Quaternion().setFromEuler(new Euler(...rotation[name],'ZYX')));
    }
    bones.Root.object.position.add(new Vector3(0,c.hover_m,0).applyQuaternion(bones.Root.quaternion));
    for(const side of ['L','R']) {
      for(const [name,value] of Object.entries(eyeWeights(c,side))) eyes[side].morphTargetInfluences[eyes[side].morphTargetDictionary[name]]=value;
      tears[side].morphTargetInfluences[tears[side].morphTargetDictionary.Reveal]=c['tear_'+side];
    }
    materials.get('Display_CyanWhite').emissiveIntensity=2.1+1.5*c.display_glow;
    const visor=materials.get('Visor_DeepNavy');visor.emissive.setRGB(.02,.07,.14);visor.emissiveIntensity=.2*c.display_glow;
    scene.updateMatrixWorld(true);
  }
  apply({});return {apply,bones,eyes,tears};
}
