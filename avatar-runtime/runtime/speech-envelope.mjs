// PCM-derived speech emphasis. No phonemes, visemes, mouth geometry or text timing.
export function buildSpeechEnvelope(buffer) {
  if(!buffer || !Number.isFinite(buffer.duration) || buffer.duration<=0 || buffer.duration>45 || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate<8000 || buffer.sampleRate>192000 || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels<1 || buffer.numberOfChannels>2) throw new RangeError('Unsupported speech buffer (maximum 45s, mono/stereo)');
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  const length=channels[0].length;
  if(!length || channels.some(c=>c.length!==length) || Math.abs(length/buffer.sampleRate-buffer.duration)>1/buffer.sampleRate) throw new RangeError('Invalid PCM length');
  const hop=Math.max(1,Math.round(buffer.sampleRate*.02)),step=hop/buffer.sampleRate;
  const levels=[],rms=[];let previous=0;
  for(let start=0;start<length;start+=hop) {
    const end=Math.min(length,start+hop);let squares=0;
    for(const channel of channels) for(let i=start;i<end;i++) {const v=channel[i];if(!Number.isFinite(v))throw new TypeError('Non-finite PCM');squares+=v*v;}
    // Average channel energy; out-of-phase stereo must not cancel the envelope.
    const value=Math.sqrt(squares/((end-start)*channels.length));rms.push(value);
    const target=value<.003?0:Math.max(0,Math.min(1,(20*Math.log10(value)+48)/32));
    const tau=target>previous?.025:.075;
    previous+=(target-previous)*(1-Math.exp(-step/tau));levels.push(previous);
  }
  levels.push(0);rms.push(0);
  return Object.freeze({step,duration:buffer.duration,levels:Object.freeze(levels),rms:Object.freeze(rms)});
}
export function sampleSpeechEnvelope(envelope,position) {
  if(!Number.isFinite(position)||position<0)throw new RangeError('Invalid speech position');
  if(position>=envelope.duration)return 0;
  const f=position/envelope.step,i=Math.floor(f),w=f-i;
  return (envelope.levels[i]??0)*(1-w)+(envelope.levels[i+1]??0)*w;
}

// Articulated motion should not react to a plosive as quickly as a light does.
// Integrate a 90ms one-pole response to the linearly changing PCM envelope.
// This is causal presentation easing, never an audio/subtitle clock adjustment.
export function easeSpeechMotionEnergy(previous,energy,at) {
  if(!previous)return energy; // start/resume already has a pose crossfade
  const dt=at-previous.at;
  if(dt<=0)return previous.motionEnergy??previous.energy;
  const tau=.09,decay=Math.exp(-dt/tau),slope=(energy-previous.energy)/dt;
  return Math.max(0,Math.min(1,energy-slope*tau+((previous.motionEnergy??previous.energy)-previous.energy+slope*tau)*decay));
}
export function speechEmphasis(position,energy,reducedMotion=false) {
  if(!Number.isFinite(position)||position<0||!Number.isFinite(energy)||energy<0||energy>1)throw new RangeError('Invalid speech frame');
  const motion=reducedMotion?.2:1,phase=position*Math.PI*2;
  return {display_glow:energy*.85*(reducedMotion?.25:1),gaze_y:.16*energy,
    head_pitch_deg:2.5*Math.sin(phase*1.1)*energy*motion,
    head_roll_deg:1.2*Math.sin(phase*.37)*energy*motion,
    body_pitch_deg:.8*Math.sin(phase*.6)*energy*motion};
}

// getOutputTimestamp is in the performance.now clock domain (milliseconds).
// Fallback is an estimate, never a claim about physical speaker timing.
export function outputClock(context,performanceSeconds) {
  const current=context.currentTime;
  if(!Number.isFinite(current)||current<0||!Number.isFinite(performanceSeconds))throw new RangeError('Invalid audio clock');
  let timestamp;
  try{timestamp=context.getOutputTimestamp?.();}catch{}
  if(timestamp && Number.isFinite(timestamp.contextTime) && timestamp.contextTime>=0 && Number.isFinite(timestamp.performanceTime) && timestamp.performanceTime>0 && Math.abs(performanceSeconds-timestamp.performanceTime/1000)<.5) {
    return {time:Math.max(0,Math.min(current,timestamp.contextTime+Math.max(0,performanceSeconds-timestamp.performanceTime/1000))),mode:'output-timestamp'};
  }
  const latency=Number.isFinite(context.outputLatency)?context.outputLatency:Number.isFinite(context.baseLatency)?context.baseLatency:0;
  return {time:Math.max(0,current-Math.max(0,latency)),mode:'latency-estimate'};
}
