export const THINKING_KINDS = Object.freeze({
  THINKING: 'THINKING',
  ANALYZING_IMAGE: 'ANALYZING_IMAGE',
  CHECKING_PLACE: 'CHECKING_PLACE',
  READING_SCHEDULE: 'READING_SCHEDULE',
  ORGANIZING: 'ORGANIZING',
});

const INITIAL_COPY = Object.freeze({
  [THINKING_KINDS.THINKING]: 'LOTBI가 생각 중이에요…',
  [THINKING_KINDS.ANALYZING_IMAGE]: '이미지를 보고 있어요…',
  [THINKING_KINDS.CHECKING_PLACE]: '장소를 확인하고 있어요…',
  [THINKING_KINDS.READING_SCHEDULE]: '일정을 읽고 있어요…',
  [THINKING_KINDS.ORGANIZING]: '답변을 정리하고 있어요…',
});

const LONG_WAIT_COPY = '조금 더 확인하고 있어요…';

export function thinkingCopy(kind, {longWait = false} = {}) {
  if (longWait) return LONG_WAIT_COPY;
  return INITIAL_COPY[kind] || INITIAL_COPY[THINKING_KINDS.THINKING];
}

export function selectThinkingKind({attachments = [], text = ''} = {}) {
  if (attachments.some(item => String(item?.mediaType || item?.mimeType || '').startsWith('image/'))) {
    return THINKING_KINDS.ANALYZING_IMAGE;
  }
  const prompt = String(text || '');
  if (/(일정|예약|캘린더|달력|스케줄)/u.test(prompt)) return THINKING_KINDS.READING_SCHEDULE;
  if (/(어디|장소|위치|길찾기|주소|지도)/u.test(prompt)) return THINKING_KINDS.CHECKING_PLACE;
  if (/(검색|찾아|비교|정리|확인)/u.test(prompt)) return THINKING_KINDS.ORGANIZING;
  return THINKING_KINDS.THINKING;
}

function defaultScheduler() {
  return {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: id => globalThis.clearTimeout(id),
  };
}

export function createThinkingPresentation({
  delayMs = 350,
  longWaitMs = 6000,
  timeoutMs = 55000,
  scheduler = defaultScheduler(),
  onVisible = () => {},
  onLongWait = () => {},
  onTimeout = () => {},
} = {}) {
  let generation = 0;
  let delayTimer;
  let longWaitTimer;
  let timeoutTimer;
  let visible = false;
  let longWait = false;
  let kind = THINKING_KINDS.THINKING;

  const snapshot = reason => Object.freeze({
    kind,
    visible,
    longWait,
    text: thinkingCopy(kind, {longWait}),
    reason,
  });

  const clearTimers = () => {
    if (delayTimer !== undefined) scheduler.clearTimeout(delayTimer);
    if (longWaitTimer !== undefined) scheduler.clearTimeout(longWaitTimer);
    if (timeoutTimer !== undefined) scheduler.clearTimeout(timeoutTimer);
    delayTimer = undefined;
    longWaitTimer = undefined;
    timeoutTimer = undefined;
  };

  const stop = reason => {
    generation += 1;
    clearTimers();
    visible = false;
    longWait = false;
    return snapshot(reason || 'stop');
  };

  const start = nextKind => {
    stop('restart');
    kind = INITIAL_COPY[nextKind] ? nextKind : THINKING_KINDS.THINKING;
    const currentGeneration = generation;
    delayTimer = scheduler.setTimeout(() => {
      if (currentGeneration !== generation) return;
      delayTimer = undefined;
      visible = true;
      onVisible(snapshot('delay'));
    }, Math.max(0, Number(delayMs) || 0));
    longWaitTimer = scheduler.setTimeout(() => {
      if (currentGeneration !== generation || !visible) return;
      longWaitTimer = undefined;
      longWait = true;
      onLongWait(snapshot('long-wait'));
    }, Math.max(Math.max(0, Number(delayMs) || 0), Number(longWaitMs) || 0));
    timeoutTimer = scheduler.setTimeout(() => {
      if (currentGeneration !== generation) return;
      timeoutTimer = undefined;
      if (delayTimer !== undefined) scheduler.clearTimeout(delayTimer);
      if (longWaitTimer !== undefined) scheduler.clearTimeout(longWaitTimer);
      delayTimer = undefined;
      longWaitTimer = undefined;
      visible = false;
      longWait = false;
      generation += 1;
      onTimeout(snapshot('timeout'));
    }, Math.max(Math.max(0, Number(delayMs) || 0), Number(timeoutMs) || 0));
    return snapshot('start');
  };

  return Object.freeze({
    start,
    stop,
    get visible() { return visible; },
    get kind() { return kind; },
    get text() { return thinkingCopy(kind, {longWait}); },
  });
}
