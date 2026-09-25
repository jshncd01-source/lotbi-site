import {eyeWeights, smooth} from './animation.mjs?v=aset-317a9f39c081';
import {deriveSpeechVariation,sampleSpeechVariation} from './speech-variation.mjs?v=aset-317a9f39c081';

// Presentation only. Call after controller.sample(t). The host owns listening,
// progress and verifiedCompletion; an AI expression cannot set these states.
export function sampleRefinement(controller,t,controls) {
  if(!Number.isFinite(t)||t<controller.lastTime)throw new RangeError('Use the controller clock');
  const c={...controls},turn=controller.turn,active=!controller.background;
  const state=active?controller.state:'idle',reduced=controller.reducedMotion;
  const end=turn?.emotionEnd??(state==='speaking'||turn?.paused?Infinity:(turn?.emotionAt??0)+12);
  const joy=active&&['happy','excited'].includes(turn?.expression?.emotion)?turn.expression.intensity*(1-smooth((t-end)/.3)):0;
  const completeAge=active&&turn?.verified&&turn.completedAt!==undefined?t-turn.completedAt:Infinity;
  const completion=completeAge>=0&&completeAge<.65?Math.sin(Math.PI*completeAge/.65)**2:0;
  // Verified completion gets one nod. Repeated acknowledgements do not replay it.
  c.head_pitch_deg=Math.min(12,c.head_pitch_deg+4*completion*(reduced?.2:1));
  const frame=turn?.speechFrame;
  const energy=active&&controller.speechMode==='audio'&&state==='speaking'&&frame&&t-frame.at<=.15?frame.energy:0;
  const motionEnergy=active&&controller.speechMode==='audio'&&state==='speaking'&&frame&&t-frame.at<=.15?frame.motionEnergy:0;
  let dots=[0,0,0];
  if(motionEnergy>0) {
    const variation=sampleSpeechVariation(deriveSpeechVariation(turn.token.id,{reducedMotion:reduced}),frame.position,motionEnergy);
    const offsets={head_pitch_deg:variation.headPitchDeg,head_roll_deg:variation.headRollDeg,body_pitch_deg:variation.bodyPitchDeg,gaze_y:variation.gazeYOffset};
    // Match the controller's motion fade on start/resume. Activity dots still
    // follow audio immediately; retained stop motion is already in base pose.
    const motionWeight=controller.blend?.speechMotionFade?smooth((t-controller.blend.at)/.25):1;
    for(const [key,value] of Object.entries(offsets)) {
      const spec=controller.contract.controls[key];
      c[key]=Math.max(spec.min,Math.min(spec.max,c[key]+value*motionWeight));
    }
  }
  if(energy>.012)dots=[...sampleSpeechVariation(deriveSpeechVariation(turn.token.id,{reducedMotion:reduced}),frame.position,energy).dots];
  // Compute eye morphs after speech variation so gaze offsets reach the actual eye surfaces.
  // The original listening clip already supplies the small attentive tilt.
  const eyes={};
  for(const side of ['L','R']) {
    const weights=eyeWeights(c,side),open=1-c['blink_'+side];
    const available=open*(1-Math.min(1,c.eye_surprised+c.eye_sad+c.eye_worried));
    const listening=state==='listening'?1:0,focus=['thinking','running'].includes(state)?1:0;
    const smile=Math.max(joy,completion)*(1-listening)*(1-focus);
    eyes[side]={...weights,Listening:listening*available,Focus:focus*available,Smile:smile*available};
  }
  const task=state==='thinking'||state==='running';
  return {controls:c,eyes,dots,
    listeningGlow:state==='listening'?(reduced?.3:.35+.08*Math.sin(t*2*Math.PI/3.5)):0,
    taskMix:task&&!reduced?.5+.5*Math.sin(t*2*Math.PI/4):.5,
    taskGlow:task?.07:0,completionLight:completion*(reduced?.3:1),state};
}
