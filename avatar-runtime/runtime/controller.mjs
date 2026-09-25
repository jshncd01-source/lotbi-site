import {sampleClip,zero,smooth,validateControls} from './animation.mjs?v=aset-6381989b8794';
import {speechEmphasis,easeSpeechMotionEnergy} from './speech-envelope.mjs?v=aset-6381989b8794';
import {AvatarStateMachine} from './state-machine.mjs?v=aset-6381989b8794';
import {deriveSpeechVariation,sampleSpeechVariation} from './speech-variation.mjs?v=aset-6381989b8794';

const SPEECH_MOTION_KEYS=['head_pitch_deg','head_roll_deg','body_pitch_deg','gaze_y'];

const FIELDS=['schema_version','request_id','speech','emotion','intensity','gesture'];
const EMOTIONS=['neutral','happy','sad','crying','surprised','worried','excited'];
const GESTURES=['none','nod','wave','laugh','celebrate'];
export function validateExpression(p) {
  if(!p || typeof p!=='object' || Array.isArray(p) || Object.keys(p).length!==FIELDS.length || !FIELDS.every(k=>Object.hasOwn(p,k))) throw new TypeError('Invalid expression fields');
  if(p.schema_version!=='0.1.0-draft' || typeof p.request_id!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(p.request_id) || typeof p.speech!=='string' || [...p.speech].length>1000 || !EMOTIONS.includes(p.emotion) || !GESTURES.includes(p.gesture) || typeof p.intensity!=='number' || !Number.isFinite(p.intensity) || p.intensity<0 || p.intensity>1) throw new TypeError('Invalid expression value');
}

export class AvatarController {
  constructor(clips,contract,{reducedMotion=false,speechMode='clip'}={}) {
    if(!['clip','audio'].includes(speechMode))throw new TypeError('Unknown speech mode');
    this.speechMode=speechMode;
    this.clips=clips; this.contract=contract; this.reducedMotion=!!reducedMotion;
    this.state='idle'; this.lastTime=0; this.stateAt=0; this.session=0;
    this.serial=0; this.turn=null; this.seen=new Set(); this.events=[];
    this.blend=null; this.background=false; this.lifecycle=new AvatarStateMachine();
  }
  #clock(t) { if(!Number.isFinite(t)||t<this.lastTime) throw new RangeError('Use monotonic seconds'); this.lastTime=t; }
  #active(token) {
    if(this.turn && this.lastTime-this.turn.started>=60) {this.lifecycle.dispatch('timeout');this.#stop('turn-timeout');this.blend={at:this.lastTime,from:this.lastBaseOutput??zero(this.contract)};}
    if(!this.turn || token!==this.turn.token) throw new Error('Stale or foreign turn');
  }
  #transition(t,mutation) {
    const output=this.sample(t),from={...this.lastBaseOutput};
    if(this.speechMode==='audio'&&this.state==='speaking') {
      // Capture motion only. Audio energy/glow must never survive a stop.
      const frame=this.turn?.speechFrame;
      const energy=!this.background&&frame&&t-frame.at<=.15?frame.motionEnergy:0;
      const weight=this.blend?.speechMotionFade?smooth((t-this.blend.at)/.25):1;
      let extra={};
      if(energy>0) {
        const v=sampleSpeechVariation(deriveSpeechVariation(this.turn.token.id,{reducedMotion:this.reducedMotion}),frame.position,energy);
        extra={head_pitch_deg:v.headPitchDeg,head_roll_deg:v.headRollDeg,body_pitch_deg:v.bodyPitchDeg,gaze_y:v.gazeYOffset};
      }
      for(const key of SPEECH_MOTION_KEYS) {
        const range=this.contract.controls[key];
        from[key]=Math.max(range.min,Math.min(range.max,output[key]+(extra[key]??0)*weight));
      }
    }
    mutation();
    this.blend={at:t,from,speechMotionFade:this.speechMode==='audio'&&this.state==='speaking'};
  }
  #stop(reason) {
    if(this.turn) this.events.push({type:'stop-audio',reason,token:this.turn.token});
    this.turn=null; this.state='idle'; this.stateAt=this.lastTime;
  }
  beginTurn(id,t) {
    this.#clock(t);
    if(this.background || typeof id!=='string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(id) || this.seen.has(id) || this.seen.size>=4096) throw new Error('Invalid, duplicate, suspended or exhausted turn');
    this.#transition(t,()=>{
      this.lifecycle.dispatch('turn-begin');
      this.#stop('new-turn');
      const token=Object.freeze({session:this.session,serial:++this.serial,id});
      this.turn={token,started:t,accepted:false,verified:false,expression:null,gesture:null};
      this.seen.add(id);
    });
    return this.turn.token;
  }
  accept(token,p,t) {
    this.#clock(t); this.#active(token);
    if(this.turn.accepted) throw new Error('Duplicate expression');
    try { validateExpression(p); if(p.request_id!==token.id) throw new Error('Turn mismatch'); }
    catch(error) { this.cancel(t,'invalid-expression'); throw error; }
    let suppressed=false;
    this.#transition(t,()=>{
      this.lifecycle.dispatch('response-accepted',{hasSpeech:!!p.speech});
      this.turn.accepted=true; this.turn.expression={...p}; this.turn.emotionAt=t;
      let gesture=p.gesture;
      if(gesture==='celebrate' && !this.turn.verified) {gesture='none';suppressed=true;this.events.push({type:'gesture-suppressed',reason:'unverified-completion',token});}
      this.turn.gesture=gesture==='none'||p.intensity===0?null:{name:gesture,at:t};
      if(this.speechMode==='audio'&&p.speech&&this.turn.gesture){this.turn.queuedGesture=this.turn.gesture.name;this.turn.gesture=null;}
      // Receiving text does not start audio or a speaking animation.
      if(this.state==='thinking'||this.state==='running') {this.state='idle';this.stateAt=t;}
    });
    return {accepted:true,gestureSuppressed:suppressed};
  }
  verifiedCompletion(token,t) { this.#clock(t);this.#active(token);this.lifecycle.dispatch('completion-verified');if(!this.turn.verified)this.turn.completedAt=t;this.turn.verified=true; }
  hostEvent(token,type,t) {
    this.#clock(t);this.#active(token);
    const states={'listening-start':'listening','listening-end':'idle','response-wait':'running','audio-start':'speaking','audio-end':'idle','audio-pause':'idle','audio-resume':'speaking'};
    if(!Object.hasOwn(states,type)) throw new Error('Unknown host event');
    const next=states[type];
    if(type==='audio-start' && (!this.turn.accepted || !this.turn.expression.speech || this.turn.audioStarted)) throw new Error('Audio start requires unplayed accepted speech');
    if(type==='audio-end' && this.state!=='speaking') throw new Error('Audio is not active');
    if(type==='audio-pause'&&this.state!=='speaking')throw new Error('Audio is not active');
    if(type==='audio-resume'&&(!this.turn.audioStarted||!this.turn.paused))throw new Error('Audio is not paused');
    if(type==='listening-end' && this.state!=='listening') throw new Error('Listening is not active');
    this.#transition(t,()=>{
      this.lifecycle.dispatch(type);
      if(this.state==='speaking' && next!=='speaking') this.events.push({type:'stop-audio',reason:type,token});
      this.state=next;this.stateAt=t;
      if(type==='audio-start') {
        this.turn.audioStarted=true;
        if(this.turn.queuedGesture){this.turn.gesture={name:this.turn.queuedGesture,at:t};this.turn.queuedGesture=null;}
      }
      if(type==='audio-pause'){this.turn.paused=true;this.turn.pauseAt=t;this.turn.speechFrame=null;}
      if(type==='audio-resume') {
        if(this.turn.gesture)this.turn.gesture.at+=t-this.turn.pauseAt;
        this.turn.paused=false;this.turn.pauseAt=null;
      }
      if(type==='audio-end') this.turn.emotionEnd=t;
    });
  }
  cancel(t,reason='cancel') {this.#clock(t);this.#transition(t,()=>{this.lifecycle.dispatch('cancel');this.#stop(reason);});}
  setBackground(value,t) {this.#clock(t);this.#transition(t,()=>{const hidden=!!value;if(hidden)this.lifecycle.dispatch('background-on');else if(this.background)this.lifecycle.dispatch('background-off');else this.lifecycle.dispatch('cancel');this.#stop('background-change');this.background=hidden;});}
  setReducedMotion(value,t) {this.#clock(t);this.#transition(t,()=>{this.reducedMotion=!!value;});}
  resetSession(t) {this.cancel(t,'session-reset');this.session++;this.seen.clear();}
  drainEvents() {return this.events.splice(0);}
  lifecycleSnapshot() {return this.lifecycle.snapshot();}
  setSpeechFrame(token,frame,t) {
    this.#clock(t);this.#active(token);
    if(this.speechMode!=='audio'||this.state!=='speaking'||!frame||Object.keys(frame).length!==2||!Object.hasOwn(frame,'position')||!Object.hasOwn(frame,'energy')||!Number.isFinite(frame.position)||frame.position<0||frame.position>45||!Number.isFinite(frame.energy)||frame.energy<0||frame.energy>1)throw new TypeError('Invalid or inactive speech frame');
    const previous=this.turn.speechFrame;
    const motionEnergy=easeSpeechMotionEnergy(previous&&t-previous.at<=.15?previous:null,frame.energy,t);
    this.turn.speechFrame={position:frame.position,energy:frame.energy,motionEnergy,at:t};
  }
  sample(t) {
    this.#clock(t);
    if(this.turn && t-this.turn.started>=60) {
      // Do not evaluate the expired turn again. Fade from the last observed pose.
      const from=this.lastBaseOutput??zero(this.contract);this.lifecycle.dispatch('timeout');this.#stop('turn-timeout');this.blend={at:t,from};
    }
    const c=zero(this.contract);
    if(!this.background) {
      const duration=this.clips.clips[this.state].duration;
      if(!(this.speechMode==='audio'&&this.state==='speaking'))Object.assign(c,sampleClip(this.clips,this.contract,this.state,(t-this.stateAt)%duration,1,this.reducedMotion));
      const turn=this.turn;
      if(turn?.expression) {
        const p=turn.expression;
        const end=turn.emotionEnd??(this.speechMode==='audio'&&(this.state==='speaking'||turn.paused)?Infinity:turn.emotionAt+12);
        const weight=p.intensity*(1-smooth((t-end)/.3));
        const map={sad:'eye_sad',crying:'eye_sad',surprised:'eye_surprised',worried:'eye_worried'};
        if(map[p.emotion]) c[map[p.emotion]]=weight;
        const motion=this.reducedMotion?.2:1;
        if(p.emotion==='crying') {c.tear_L=weight;c.tear_R=weight;c.head_pitch_deg+=5*weight*motion;}
        if(p.emotion==='happy') c.head_roll_deg+=2*weight*motion;
        if(p.emotion==='excited'&&!this.reducedMotion) {c.body_roll_deg+=1.5*Math.sin(t*5)*weight;c.hover_m+=.002*(1+Math.sin(t*5))*weight;}
        if(turn.gesture) {
          const g=turn.gesture, age=(turn.paused?turn.pauseAt:t)-g.at;
          if(age<=this.clips.clips[g.name].duration) {
            const v=sampleClip(this.clips,this.contract,g.name,age,p.intensity,this.reducedMotion);
            for(const k of Object.keys(c)) c[k]+=v[k];
          } else turn.gesture=null;
        }
      }
      // Deterministic, sparse natural blink; no camera or sensor inference.
      const phase=t%4.3;
      const blink=phase>3.8&&phase<4.06?Math.sin(Math.PI*(phase-3.8)/.26)**2:0;
      c.blink_L=Math.max(c.blink_L,blink);c.blink_R=Math.max(c.blink_R,blink);
      // Saturate composed, already validated layers at physical rig limits.
      // Invalid external requests are rejected, never fixed by this clamp.
      for(const [k,spec] of Object.entries(this.contract.controls)) c[k]=Math.max(spec.min,Math.min(spec.max,c[k]));
      const sum=c.eye_surprised+c.eye_sad+c.eye_worried;
      if(sum>1) for(const k of ['eye_surprised','eye_sad','eye_worried']) c[k]/=sum;
    }
    if(this.blend) {
      const w=smooth((t-this.blend.at)/.25);
      for(const k of Object.keys(c)) c[k]=this.blend.from[k]*(1-w)+c[k]*w;
      if(w===1) this.blend=null;
    }
    this.lastBaseOutput={...c};
    // Speech is applied AFTER the pose crossfade. Pausing/cancelling cannot
    // leave a ghost of the previous speech glow in a 250ms pose transition.
    const frame=this.turn?.speechFrame;
    if(this.speechMode==='audio'&&this.state==='speaking'&&frame&&t-frame.at<=.15) {
      const emphasis=speechEmphasis(frame.position,frame.motionEnergy,this.reducedMotion);
      emphasis.display_glow=frame.energy*.85*(this.reducedMotion?.25:1);
      const motionWeight=this.blend?.speechMotionFade?smooth((t-this.blend.at)/.25):1;
      for(const [k,v] of Object.entries(emphasis))c[k]+=v*(k==='display_glow'?1:motionWeight);
      for(const [k,s] of Object.entries(this.contract.controls))c[k]=Math.max(s.min,Math.min(s.max,c[k]));
    }
    validateControls(c,this.contract);this.lastOutput={...c};return c;
  }
}
