// SITE-PET-FAMILY-WEB-01 — 반려동물 유료 게이트.
//
// 판정과 스위치를 분리합니다. 지금은 스위치가 꺼진 채로 배포됩니다.
//
// 왜 꺼두는가: 결제가 아직 TEST 환경이라 아무도 유료 회원이 될 수 없습니다.
// 지금 차단을 켜면 대표 계정을 포함해 전원이 막힙니다. 대표 계정은
// plan: FREE / entitled: false 이고, INTERNAL_UNLIMITED 예외는 AI 대화 한도만
// 풀어줄 뿐 결제 등급을 올리지 않습니다.
//
// 켜는 방법: PET_GATE_ENFORCED 를 true 로 바꾸는 것 하나면 됩니다. 판정
// 로직은 건드리지 않습니다.
export const PET_GATE_ENFORCED = false;

// 등록 자체는 어떤 상태에서도 막지 않습니다. 대표 지시: "등록은 되게".
// 게이트는 등록 이후의 '활성화'에만 적용됩니다.
export const PET_REGISTRATION_ALWAYS_ALLOWED = true;

// 테스트용 강제 상태. 차단이 꺼져 있는 동안에도 게이트 화면을 확인할 수
// 있어야 해서 둡니다. 본인 화면만 바뀌며, 권한을 얻는 방향으로는 쓸 수
// 없습니다 — 잠그는 쪽으로만 동작합니다.
const GATE_TEST_PARAM = 'petGate';

function testOverride(search) {
  try {
    const value = new URLSearchParams(search || '').get(GATE_TEST_PARAM);
    if (value === 'locked') return 'locked';
    if (value === 'entitled') return 'entitled';
  } catch {
    // 잘못된 쿼리 문자열은 무시합니다.
  }
  return '';
}

// Core 의 구독 상태가 단일 출처입니다. 화면에서 따로 판단하지 않습니다.
//
// 조회가 실패하면 여는 쪽으로 넘어갑니다. 구독 조회가 잠깐 안 된다고 이미
// 결제한 사용자의 기능이 꺼지면 안 됩니다. 막는 쪽으로 fail 하면 장애가
// 그대로 과금 사고가 됩니다.
export function petFeatureState(subscription, {search = '', enforced = PET_GATE_ENFORCED} = {}) {
  const override = testOverride(search);
  const hasReading = Boolean(subscription) && typeof subscription.entitled === 'boolean';
  const entitled = override === 'locked'
    ? false
    : override === 'entitled'
      ? true
      : (hasReading ? subscription.entitled === true : true);
  const enforcing = enforced || override !== '';
  return Object.freeze({
    entitled,
    enforced: enforcing,
    // 이것만이 무언가를 실제로 비활성화하는 상태입니다.
    locked: enforcing && !entitled,
    // 구독을 못 읽어서 열어준 것인지 구분합니다. 보고·디버깅용입니다.
    reason: override ? 'TEST_OVERRIDE' : (hasReading ? 'SUBSCRIPTION' : 'SUBSCRIPTION_UNAVAILABLE'),
    plan: subscription && typeof subscription.plan === 'string' ? subscription.plan : '',
  });
}

// 등록 직후 안내. 문구는 현재 상태에 맞아야 합니다 — 차단이 꺼져 있는데
// "유료 회원만 쓸 수 있습니다" 라고 하면 거짓말이 됩니다.
export function petGateNotice(state) {
  if (state.locked) {
    return Object.freeze({
      title: '등록됐습니다',
      body: '반려동물 기능은 유료 회원에게 활성화됩니다. 등록한 정보와 사진은 그대로 보관되며, 유료로 전환하면 바로 사용할 수 있습니다.',
      action: '요금제 보기',
    });
  }
  return Object.freeze({
    title: '등록됐습니다',
    body: '반려동물 기능은 앞으로 유료 회원 전용으로 전환될 예정입니다. 지금은 모든 회원이 사용할 수 있고, 등록한 정보와 사진은 그대로 보관됩니다.',
    action: '확인',
  });
}

// 사이드바 비활성 표시. 눌렀을 때 아무 일도 안 일어나면 고장으로 보이므로,
// 왜 비활성인지와 어떻게 풀리는지를 함께 말합니다.
export function petNavLockLabel(state) {
  if (!state.locked) return '';
  return '유료 회원 전용';
}

export function petNavLockHint(state) {
  if (!state.locked) return '';
  return '반려동물 기능은 유료 회원에게 활성화됩니다. 등록한 정보는 그대로 있습니다.';
}
