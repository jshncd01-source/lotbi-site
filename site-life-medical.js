// LIFE-PUBLIC-DATA-01 / NIGHT MEDICAL — 병원·약국·응급실 카드 상태 줄과 119 안내.
//
// Core(국립중앙의료원 데이터)가 준 값만 그대로 옮긴다:
//  - 진료·운영 여부는 "등록 시간상"으로만 말한다. 등록 시간이 없으면 없다고 쓴다.
//  - 응급실 병상은 Core 가 FRESH 로 표시한 실시간 보고만 숫자로 보여 준다. 오래된
//    보고나 없는 보고는 숫자 없이 그 사실만 쓴다. "수용 가능"이라고 말하지 않는다.
//  - 119 전화 버튼은 Core 가 응급 증상 메시지라고 표시한 답변(CALL_119)에만
//    붙는다. 안내 문장은 Core 답변 첫 문장에 있으니 버튼 하나만 둔다
//    (LIFE-MEDICAL-AUTO-SEARCH-01: 단순 응급실 검색에는 큰 119 박스 없음).
//  - 카드에는 등록 운영시간이 실제와 다를 수 있다는 짧은 한 줄을 둔다.

// Card lines: plain strings plus a state for styling/tests. Never invents a
// state Core did not send.
export function medicalStatusLines(place, {partial = false} = {}) {
  const lines = [];
  const status = place?.medicalStatus;
  if (status) {
    const verb = status.kind === 'PHARMACY' ? '운영' : '진료';
    if (status.openState === 'OPEN') lines.push({state: 'OPEN', text: `등록 시간상 ${verb} 중 · ${status.hoursLabel}`});
    else if (status.openState === 'CLOSED') lines.push({state: 'CLOSED', text: `등록 시간상 ${verb} 종료 · ${status.hoursLabel}`});
    else if (status.hoursLabel) lines.push({state: status.openState, text: status.hoursLabel});
    // The one limit that matters before going: registered hours are not a
    // promise. Said once per card, short, instead of in the chat answer.
    const limits = [`실제 ${verb} 여부는 전화로 확인`];
    if (status.holidayUnverified) limits.push('공휴일 미반영');
    if (partial) limits.push('일부 기관만 확인');
    lines.push({state: 'CONFIRM', text: limits.join(' · ')});
  }
  const emergency = place?.emergencyStatus;
  if (emergency) {
    if (emergency.realtimeState === 'FRESH') {
      const er = emergency.beds.find(item => item.label === '응급실');
      const when = emergency.updatedAtLabel ? ` · ${emergency.updatedAtLabel} 보고` : '';
      if (er) {
        lines.push({
          state: 'REALTIME_FRESH',
          text: er.available > 0 ? `응급실 가용 병상 ${er.available}${when}` : `응급실 가용 병상 없음(보고값 ${er.available})${when}`,
        });
      } else {
        lines.push({state: 'REALTIME_FRESH', text: `실시간 병상 보고 있음${when}`});
      }
    } else if (emergency.realtimeState === 'STALE') {
      lines.push({state: 'REALTIME_STALE', text: `실시간 병상 정보 오래됨${emergency.updatedAtLabel ? `(${emergency.updatedAtLabel})` : ''}`});
    } else {
      lines.push({state: 'REALTIME_NONE', text: '실시간 병상 정보 없음'});
    }
    if (emergency.messages[0]) lines.push({state: 'NOTICE', text: `병원 공지: ${emergency.messages[0]}`});
    lines.push({state: 'CONFIRM', text: '수용 여부는 출발 전 전화로 확인'});
  }
  return lines;
}

// The answer's first sentence already says to call 119; this is only the
// one-tap call, small, next to it - no second sentence, no box.
export function createEmergencyCallNotice(doc = globalThis.document) {
  const notice = doc.createElement('div');
  notice.className = 'conversation-emergency-call';
  const call = doc.createElement('a');
  call.className = 'conversation-emergency-call-link';
  call.href = 'tel:119';
  call.textContent = '119 전화';
  call.setAttribute('aria-label', '119에 전화하기');
  notice.append(call);
  return notice;
}
