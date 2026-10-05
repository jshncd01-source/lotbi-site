// SAFECARE-WEB-UI-REDESIGN-01 — copy and progress rules shared by the person
// and pet SafeCare screens.
//
// Nothing here talks to Core. These are the screen's own words for states Core
// already decides: the review state of a found report, how many photos a found
// report still needs, and the renewal state of a registered subject's photos.
// LOTBI never asserts a match, so no sentence below says "찾았습니다",
// "일치합니다" or "100%", and "no reliable match" only exists once Core has
// finished analysing and says so.

export const FOUND_REPORT_MIN_PHOTOS = 5;
export const FOUND_REPORT_MAX_PHOTOS = 10;
export const NO_RELIABLE_MATCH_LABEL = '확인 가능한 일치 대상 없음';

// Core review_state -> what the reporter sees. DRAFT is the reporter's own
// unfinished report; every other state exists only after the final submit.
const REVIEW_STATE_COPY = Object.freeze({
  DRAFT: Object.freeze({label: '작성 중', tone: 'draft', detail: '서로 다른 방향의 사진 5장부터 최종 제출할 수 있습니다.'}),
  QUEUED: Object.freeze({label: '분석 대기', tone: 'progress', detail: '제보가 접수되었습니다. 실종 상태로 등록된 대상과 비교를 준비하고 있습니다.'}),
  ANALYZING: Object.freeze({label: '분석 중', tone: 'progress', detail: '제보 사진을 실종 상태로 등록된 대상과 자세히 비교하고 있습니다.'}),
  ADMIN_REVIEW: Object.freeze({label: '관리자 검토 중', tone: 'progress', detail: '비교 후보가 있어 관리자가 검토하고 있습니다. 검토와 보호자 확인 전에는 결과를 확정하지 않습니다.'}),
  NO_RELIABLE_MATCH: Object.freeze({label: NO_RELIABLE_MATCH_LABEL, tone: 'neutral', detail: '분석을 마쳤지만 현재 실종 상태로 등록된 대상 중 확인 가능한 일치 대상이 없습니다.'}),
  INSUFFICIENT_QUALITY: Object.freeze({label: '사진 보완 필요', tone: 'warning', detail: '비교에 쓸 수 있는 사진이 부족합니다. 다른 방향의 선명한 사진이 더 필요합니다.'}),
  CLOSED: Object.freeze({label: '검토 종료', tone: 'neutral', detail: '제보 검토가 종료되었습니다.'}),
});

const UNKNOWN_REVIEW_STATE = Object.freeze({label: '확인 중', tone: 'progress', detail: '제보 상태를 확인하고 있습니다.'});

export function foundReviewStateCopy(state) {
  return REVIEW_STATE_COPY[state] || UNKNOWN_REVIEW_STATE;
}

// Only a report Core has finished analysing can read as "no reliable match".
export function isNoReliableMatchState(state) {
  return state === 'NO_RELIABLE_MATCH';
}

// The found-report photo rule as the screen shows it: writing may start with
// one photo, the final submit opens at five and adding stops at ten.
export function foundPhotoProgress(count) {
  const value = Number.isInteger(count) && count > 0 ? Math.min(count, FOUND_REPORT_MAX_PHOTOS) : 0;
  const needed = Math.max(0, FOUND_REPORT_MIN_PHOTOS - value);
  const canSubmit = value >= FOUND_REPORT_MIN_PHOTOS;
  const canAdd = value < FOUND_REPORT_MAX_PHOTOS;
  let message;
  if (value === 0) message = '발견한 대상의 사진 1장부터 작성을 시작할 수 있습니다.';
  else if (!canSubmit) message = `현재 ${value}/${FOUND_REPORT_MIN_PHOTOS}장 · 최종 제출하려면 사진 ${needed}장이 더 필요합니다.`;
  else if (canAdd) message = `현재 ${value}/${FOUND_REPORT_MAX_PHOTOS}장 · 최종 제출할 수 있습니다. 최대 ${FOUND_REPORT_MAX_PHOTOS}장까지 추가할 수 있습니다.`;
  else message = `현재 ${value}/${FOUND_REPORT_MAX_PHOTOS}장 · 최대 장수를 모두 채웠습니다.`;
  return Object.freeze({count: value, needed, canSubmit, canAdd, message});
}

// Registered-subject identity photos: exactly ten.
export const IDENTITY_PHOTO_TOTAL = 10;

export function identityPhotoProgress(count) {
  const value = Number.isInteger(count) && count > 0 ? Math.min(count, IDENTITY_PHOTO_TOTAL) : 0;
  return Object.freeze({
    count: value,
    remaining: IDENTITY_PHOTO_TOTAL - value,
    complete: value === IDENTITY_PHOTO_TOTAL,
    label: `등록 완료 ${value} / ${IDENTITY_PHOTO_TOTAL}`,
    remainingLabel: value === IDENTITY_PHOTO_TOTAL ? '10장을 모두 등록했습니다' : `남은 사진 ${IDENTITY_PHOTO_TOTAL - value}장`,
  });
}

// Core's identity_photo_state for a registered subject -> card badge. The day
// counts and dates come from Core; the screen never computes a renewal date.
export function renewalBadge({state, daysRemaining} = {}) {
  if (state === 'EXPIRED') return Object.freeze({label: '사진 갱신 필요', tone: 'danger'});
  if (state === 'EXPIRING') {
    return Object.freeze({
      label: Number.isInteger(daysRemaining) ? `갱신 예정 · ${daysRemaining}일 남음` : '갱신 예정',
      tone: 'warning',
    });
  }
  if (state === 'BIRTH_INFO_REQUIRED') return Object.freeze({label: '출생정보 필요', tone: 'warning'});
  if (state === 'CURRENT') return Object.freeze({label: '정상', tone: 'ok'});
  return Object.freeze({label: '사진 등록 필요', tone: 'neutral'});
}

export function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}.${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')}`;
}

export function formatMoment(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${formatDate(value)} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

// datetime-local works in naive local time; Core takes an instant.
export function localNowValue(now = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function isoFromLocal(value) {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

// Birth year/month come from selects, so "8" and "08" can never disagree:
// whatever the control holds is normalized to the integer Core stores.
export function normalizeBirthYear(value, now = new Date()) {
  const year = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(year) && year >= 1900 && year <= now.getFullYear() ? year : null;
}

export function normalizeBirthMonth(value) {
  const month = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function birthYearOptions(now = new Date(), earliest = 1900) {
  const years = [];
  for (let year = now.getFullYear(); year >= earliest; year -= 1) years.push(year);
  return years;
}
