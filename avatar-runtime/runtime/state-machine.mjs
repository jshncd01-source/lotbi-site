export const AVATAR_LIFECYCLE_STATES = Object.freeze([
  'idle','listening','thinking','ready','speaking','paused','suspended'
]);

export const AVATAR_LIFECYCLE_EVENTS = Object.freeze([
  'turn-begin','listening-start','listening-end','response-wait','response-accepted',
  'audio-start','audio-pause','audio-resume','audio-end','completion-verified',
  'cancel','timeout','background-on','background-off'
]);

const EVENTS = new Set(AVATAR_LIFECYCLE_EVENTS);

export class AvatarStateMachine {
  constructor() {
    this.sequence=0;
    this.state='idle';
    this.background=false;
    this.turnActive=false;
    this.accepted=false;
    this.hasSpeech=false;
    this.audioStarted=false;
    this.paused=false;
    this.verified=false;
  }

  #requireTurn() {
    if(!this.turnActive) throw new Error('Lifecycle event requires an active turn');
  }

  #resetTurn() {
    this.turnActive=false;
    this.accepted=false;
    this.hasSpeech=false;
    this.audioStarted=false;
    this.paused=false;
    this.verified=false;
  }

  #move(next) {
    this.state=next;
    this.sequence++;
    return this.snapshot();
  }

  dispatch(event, detail={}) {
    if(typeof event!=='string' || !EVENTS.has(event)) throw new Error('Unknown lifecycle event');
    if(!detail || typeof detail!=='object' || Array.isArray(detail)) throw new TypeError('Lifecycle detail must be an object');

    if(event==='background-on') {
      this.background=true;this.#resetTurn();return this.#move('suspended');
    }
    if(event==='background-off') {
      if(!this.background) throw new Error('Avatar is not suspended');
      this.background=false;this.#resetTurn();return this.#move('idle');
    }
    if(event==='cancel' || event==='timeout') {
      this.#resetTurn();return this.#move(this.background?'suspended':'idle');
    }
    if(this.background) throw new Error('Avatar lifecycle is suspended');

    if(event==='turn-begin') {
      // A new host turn supersedes the previous turn, matching AvatarController.beginTurn.
      // Per-turn authority never carries across that boundary.
      this.#resetTurn();
      this.turnActive=true;
      return this.#move('idle');
    }
    this.#requireTurn();
    switch(event) {
      case 'listening-start':
        if(['speaking','paused'].includes(this.state)) throw new Error('Cannot listen while audio is active');
        return this.#move('listening');
      case 'listening-end':
        if(this.state!=='listening') throw new Error('Listening is not active');
        return this.#move('idle');
      case 'response-wait':
        if(['speaking','paused'].includes(this.state)) throw new Error('Cannot wait for a response while audio is active');
        return this.#move('thinking');
      case 'response-accepted':
        if(this.accepted) throw new Error('Response already accepted');
        if(['speaking','paused'].includes(this.state)) throw new Error('Cannot accept a response while audio is active');
        if(Object.keys(detail).some(k=>k!=='hasSpeech') || typeof detail.hasSpeech!=='boolean') throw new TypeError('response-accepted requires hasSpeech');
        this.accepted=true;this.hasSpeech=detail.hasSpeech;
        return this.#move(detail.hasSpeech?'ready':'idle');
      case 'audio-start':
        if(!this.accepted || !this.hasSpeech || this.audioStarted) throw new Error('Audio start requires unplayed accepted speech');
        this.audioStarted=true;this.paused=false;return this.#move('speaking');
      case 'audio-pause':
        if(this.state!=='speaking') throw new Error('Audio is not active');
        this.paused=true;return this.#move('paused');
      case 'audio-resume':
        if(this.state!=='paused' || !this.audioStarted || !this.paused) throw new Error('Audio is not paused');
        this.paused=false;return this.#move('speaking');
      case 'audio-end':
        if(this.state!=='speaking') throw new Error('Audio is not active');
        this.paused=false;return this.#move('idle');
      case 'completion-verified':
        this.verified=true;return this.#move(this.state);
      default:
        throw new Error('Unknown lifecycle event');
    }
  }

  snapshot() {
    return Object.freeze({
      sequence:this.sequence,state:this.state,background:this.background,
      turnActive:this.turnActive,accepted:this.accepted,hasSpeech:this.hasSpeech,
      audioStarted:this.audioStarted,paused:this.paused,verified:this.verified
    });
  }
}
