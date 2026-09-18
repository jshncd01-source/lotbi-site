// Runtime binding for the user-approved faithful rigid-part LOTBI model.
// The asset remains mouthless: speech is conveyed with eyes, head/body motion,
// and display glow. Imported rest transforms are always preserved.

const REQUIRED_NODES=[
  'Rig_Root','Rig_Body','Rig_Head','Rig_LeftEye','Rig_RightEye',
  'Rig_LeftArm','Rig_RightArm',
];

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const radians=degrees=>degrees*Math.PI/180;

function multiplyQuaternion(a,b){
  return [
    a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2],
  ];
}

function axisAngle(x,y,z,angle){
  const half=angle/2,s=Math.sin(half);
  return [x*s,y*s,z*s,Math.cos(half)];
}

// Source asset is Blender-style Z-up/front -Y. Compose source-local rotations
// as X(pitch), Y(-roll), Z(yaw), then the app's fixed X=-90deg wrapper maps
// them into Three's Y-up/front +Z delivery space.
function sourceRotation(pitch=0,yaw=0,roll=0){
  return multiplyQuaternion(
    multiplyQuaternion(axisAngle(0,0,1,radians(yaw)),axisAngle(0,1,0,radians(-roll))),
    axisAngle(1,0,0,radians(pitch)),
  );
}

function snapshot(object){
  return {
    position:[object.position.x,object.position.y,object.position.z],
    quaternion:[object.quaternion.x,object.quaternion.y,object.quaternion.z,object.quaternion.w],
    scale:[object.scale.x,object.scale.y,object.scale.z],
  };
}

function setVector(target,values){target.set(values[0],values[1],values[2]);}
function setQuaternion(target,values){target.set(values[0],values[1],values[2],values[3]);}

export function createFaithfulBinding(scene,contract){
  const objects={},materials=new Map();
  scene.traverse(object=>{
    if(REQUIRED_NODES.includes(object.name))objects[object.name]=object;
    if(object.isMesh){
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(material?.name)materials.set(material.name,material);
      }
    }
  });
  const missing=REQUIRED_NODES.filter(name=>!objects[name]);
  if(missing.length)throw new Error(`Faithful LOTBI rig nodes missing: ${missing.join(', ')}`);
  if(!materials.has('EyeCyanGlow')||!materials.has('VisorDeepBlack'))throw new Error('Faithful LOTBI materials missing');
  if(!contract?.controls)throw new Error('LOTBI control contract missing');

  const rest=Object.fromEntries(REQUIRED_NODES.map(name=>[name,snapshot(objects[name])]));
  const defaults=Object.fromEntries(Object.entries(contract.controls).map(([name,spec])=>[name,spec.default??0]));

  function apply(values={}){
    for(const [name,value] of Object.entries(values)){
      const spec=contract.controls[name];
      if(!spec||!Number.isFinite(value)||value<spec.min||value>spec.max)throw new RangeError(`Invalid faithful control: ${name}`);
    }
    const c={...defaults,...values};
    for(const name of REQUIRED_NODES){
      setVector(objects[name].position,rest[name].position);
      setQuaternion(objects[name].quaternion,rest[name].quaternion);
      setVector(objects[name].scale,rest[name].scale);
    }

    const pose=(name,pitch,yaw,roll)=>setQuaternion(
      objects[name].quaternion,
      multiplyQuaternion(rest[name].quaternion,sourceRotation(pitch,yaw,roll)),
    );
    pose('Rig_Root',0,c.root_yaw_deg,0);
    pose('Rig_Body',c.body_pitch_deg,c.body_yaw_deg,c.body_roll_deg);
    pose('Rig_Head',c.head_pitch_deg,c.head_yaw_deg,c.head_roll_deg);
    // Delivery lift Z maps to source -Y. Swing X and twist Y map directly to
    // source X and Z respectively after the fixed orientation conversion.
    pose('Rig_LeftArm',c.arm_L_swing_deg,c.arm_L_twist_deg,c.arm_L_lift_deg);
    pose('Rig_RightArm',c.arm_R_swing_deg,c.arm_R_twist_deg,-c.arm_R_lift_deg);
    objects.Rig_Root.position.z=rest.Rig_Root.position[2]+c.hover_m;

    const emotionTotal=Math.max(1,c.eye_surprised+c.eye_sad+c.eye_worried);
    const surprised=c.eye_surprised/emotionTotal;
    const sad=c.eye_sad/emotionTotal;
    const worried=c.eye_worried/emotionTotal;
    for(const [side,blink] of [['Left',c.blink_L],['Right',c.blink_R]]){
      const name=`Rig_${side}Eye`,object=objects[name],base=rest[name];
      const direction=side==='Left'?1:-1;
      object.position.x=base.position[0]+c.gaze_x*.012;
      object.position.z=base.position[2]+c.gaze_y*.008;
      object.scale.x=base.scale[0]*(1+.08*surprised-.04*sad);
      object.scale.z=base.scale[2]*Math.max(.06,(1-blink)*(1+.1*surprised-.25*sad-.12*worried));
      setQuaternion(object.quaternion,multiplyQuaternion(base.quaternion,axisAngle(0,1,0,radians(direction*(5*sad+3*worried)))));
    }

    const eyes=materials.get('EyeCyanGlow');
    eyes.emissiveIntensity=2.2+1.7*c.display_glow;
    const visor=materials.get('VisorDeepBlack');
    if(visor.emissive?.setRGB)visor.emissive.setRGB(.01,.035,.075);
    visor.emissiveIntensity=.12+.18*c.display_glow;
    scene.updateMatrixWorld(true);
  }

  apply();
  return Object.freeze({apply,objects,materials,rest});
}
