import './site-conversation-storage.js';

export function deterministicReply(text, now = new Date()) {
  const normalized = String(text || '').trim().toLowerCase().replace(/[!?.,~ㅎㅎㅋ]+$/gu, '').replace(/\s+/gu, ' ');
  const exact = normalized.replace(/\s/gu, '');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '기기 시간대';
  if (/^(안녕|안녕하세요|안뇽|하이|hello|hi)$/u.test(exact)) return '안녕하세요! 저는 LOTBI예요. 무엇을 도와드릴까요?';
  if (/^(반가워|반가워요|반갑습니다|만나서반가워|만나서반가워요)$/u.test(exact)) return '저도 반가워요! 오늘 필요한 일을 편하게 말씀해 주세요.';
  if (/^(고마워|고마워요|고맙습니다|감사합니다|감사해)$/u.test(exact)) return '도움이 되어 기뻐요. 더 필요한 것이 있으면 말씀해 주세요.';
  if (/^(도움말|도와줘|뭘할수있어|무엇을할수있어|사용법)$/u.test(exact)) return '질문 답변과 쇼핑·예약·이동 같은 요청 정리를 도와드릴 수 있어요. 필요한 일을 한 문장으로 말씀해 주세요.';
  if (/^(지금)?(몇시|몇시야|몇시예요|현재시간|지금시간)$/u.test(exact)) {
    const value = new Intl.DateTimeFormat('ko-KR', {hour: 'numeric', minute: '2-digit', second: '2-digit'}).format(now);
    return `현재 시간은 ${value}입니다. (${timeZone})`;
  }
  if (/^(오늘)?(날짜|며칠|몇일|오늘날짜|오늘며칠)$/u.test(exact)) {
    const value = new Intl.DateTimeFormat('ko-KR', {year: 'numeric', month: 'long', day: 'numeric'}).format(now);
    return `오늘은 ${value}입니다. (${timeZone})`;
  }
  if (/^(오늘)?(요일|무슨요일|무슨요일이야|오늘요일)$/u.test(exact)) {
    const value = new Intl.DateTimeFormat('ko-KR', {weekday: 'long'}).format(now);
    return `오늘은 ${value}입니다. (${timeZone})`;
  }
  return undefined;
}
