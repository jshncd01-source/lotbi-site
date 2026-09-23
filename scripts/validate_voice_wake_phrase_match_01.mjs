// SITE-VOICE-WAKE-PHRASE-MATCH-01
//
// The wake phrase has to survive what the recogniser actually returns, and it
// has to stay quiet the rest of the time. Both halves are contracts: loosening
// the match until "보비야" wakes LOTBI is as much a regression as missing
// "롯비야" altogether, so the false-positive list below is not optional.
import assert from 'node:assert/strict';
import {parseWakeUtterance, stripWakePrefix, toJamo, LOTBI_WAKE_PHRASE} from '../site-voice-wake.js';

assert.equal(LOTBI_WAKE_PHRASE, '롯비야');
assert.equal(toJamo('롯비야'), 'ㄹㅗㅅㅂㅣㅇㅑ', 'jamo decomposition must split lead, vowel and tail');
assert.equal(toJamo('hello 123'), 'hello 123', 'non-Hangul must pass through untouched');

// Calls that must be recognised, with the command that has to survive the split.
const CALLS = [
  ['롯비야', ''],
  ['롯비야 내일 날씨 알려줘', '내일 날씨 알려줘'],
  ['롯비야, 내일 전주 비 오냐?', '내일 전주 비 오냐?'],
  // Measured on a real Android handset: the engine returned this for a clear
  // "롯비야". Exact matching is what this whole module exists to replace.
  ['소피아 루', ''],
  ['소피아 루 내일 날씨', '내일 날씨'],
  ['롯비아 오늘 일정', '오늘 일정'],
  ['롯피야 뭐해', '뭐해'],
  ['롣비야 안녕', '안녕'],
  ['롯비여 지금 몇시야', '지금 몇시야'],
  ['롯비이 배고파', '배고파'],
];
for (const [utterance, command] of CALLS) {
  const parsed = parseWakeUtterance(utterance);
  assert.ok(parsed.matched, `wake phrase must be recognised in ${JSON.stringify(utterance)}`);
  assert.equal(parsed.command, command, `command mis-split for ${JSON.stringify(utterance)}`);
}

// Ordinary speech that must never wake LOTBI. The entries beginning with ㄹ are
// the ones the edit-distance layer would reach if the onset check were dropped.
const NOT_CALLS = [
  '내일 날씨 알려줘', '오늘 저녁 뭐 먹지', '롯데월드 가는 길 알려줘',
  '소피아는 누구야', '로봇이야 사람이야', '커피 마시고 싶어',
  '비야 그쳐라', '이거 비싸다', '토마토 사줘', '노트북 추천해줘',
  '그래서 내가 말했잖아', '보비야 이리와',
  '라디오 켜줘', '리비아 어디야', '레시피 알려줘', '로그인 해줘',
  '라면 끓여줘', '러시아 뉴스',
];
for (const utterance of NOT_CALLS) {
  assert.equal(parseWakeUtterance(utterance).matched, false, `must not wake on ${JSON.stringify(utterance)}`);
}

// The wake phrase is only ever looked for at the head. Finding it mid-sentence
// would wake LOTBI out of ordinary conversation.
assert.equal(parseWakeUtterance('내일 날씨 롯비야').matched, false, 'wake phrase must only match at the head');

// Dictation keeps the question and loses the call.
assert.equal(stripWakePrefix('롯비야 내일 날씨'), '내일 날씨');
assert.equal(stripWakePrefix('소피아 루 내일 날씨'), '내일 날씨');
assert.equal(stripWakePrefix('내일 날씨'), '내일 날씨', 'text without a call must pass through unchanged');
assert.equal(stripWakePrefix('롯비야'), '', 'a bare call leaves no question behind');
// Never substitute anything for speech that was not heard.
assert.equal(stripWakePrefix(''), '');
assert.equal(stripWakePrefix(null), '');

console.log('SITE-VOICE-WAKE-PHRASE-MATCH-01 CONTRACT PASS');
