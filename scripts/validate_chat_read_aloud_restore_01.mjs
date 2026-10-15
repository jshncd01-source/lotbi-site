// CHAT-READ-ALOUD-RESTORE-P0 — what the 읽어주기 button reads, without a browser.
//
// The button lives in site-message-read-aloud.js. This checks the two pure
// steps between an answer and the speech engine: speechTextFromAnswer (Markdown
// marks, code, addresses and pictographs out; each line its own sentence) and
// splitForSpeech (≤180-character pieces, in order, every word exactly once).
// The real-browser behaviour — one answer at a time, stop, no network — is
// validate_chat_read_aloud_restore_browser_01.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {speechTextFromAnswer, splitForSpeech} from '../site-message-read-aloud.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'site-message-read-aloud.js'), 'utf8');

// Older iOS Safari cannot parse a lookbehind; one such pattern would take the
// whole chat module down with it.
assert.doesNotMatch(source, /\(\?<[=!]/, 'no lookbehind regex in the read-aloud module');

const normalize = value => String(value).replace(/\s+/g, ' ').trim();

// --- speechTextFromAnswer ---------------------------------------------------
{
  const answer = [
    '## 전주 한옥마을 안내 🏯',
    '',
    '**전주 한옥마을**은 *사계절* 내내 붐비는 곳이에요.',
    '- 경기전: 조선 태조 어진을 모신 곳',
    '- 전동성당 → 한옥마을 입구에서 걸어서 5분',
    '1. 주차는 공영주차장을 이용하세요',
    '> 주말에는 일찍 가시는 게 좋아요',
    '',
    '| 항목 | 요금 |',
    '| --- | --- |',
    '| 경기전 | 3,000원 |',
    '',
    '```js',
    'const ticket = await buy("경기전");',
    '```',
    '',
    '자세한 내용은 [전주시 관광](https://tour.jeonju.go.kr/index.9) 또는 https://www.jeonju.go.kr 에서 확인하세요.',
    '`예약 번호`는 063-281-2114 입니다.',
    '---',
  ].join('\n');
  const spoken = speechTextFromAnswer(answer);
  for (const mark of ['**', '##', '```', '`', '|', '→', '🏯', 'http', 'www.', '](', '> ']) {
    assert.ok(!spoken.includes(mark), `"${mark}" must not reach the voice: ${spoken}`);
  }
  assert.ok(!spoken.includes('const ticket'), 'code is not read aloud');
  assert.ok(spoken.includes('코드는 화면에서 확인해 주세요.'), 'a code block is replaced by one short sentence');
  assert.ok(spoken.includes('전주시 관광'), 'a Markdown link keeps its words');
  assert.ok(spoken.includes('링크'), 'a bare address becomes the word 링크');
  assert.ok(spoken.includes('전주 한옥마을 안내.'), 'a heading ends as its own sentence');
  assert.ok(spoken.includes('경기전: 조선 태조 어진을 모신 곳.'), 'a list item ends as its own sentence');
  assert.ok(spoken.includes('1. 주차는 공영주차장을 이용하세요.'), 'a numbered item keeps its number');
  assert.ok(spoken.includes('경기전, 3,000원.'), 'a table row is read as its cells');
  assert.ok(!spoken.includes('---'), 'separator rows and rules carry no words');
  assert.ok(spoken.includes('063-281-2114'), 'phone numbers reach the voice unchanged');
}
assert.equal(speechTextFromAnswer(''), '');
assert.equal(speechTextFromAnswer('```\nonly code\n```'), '코드는 화면에서 확인해 주세요.');

// --- splitForSpeech ---------------------------------------------------------
{
  const chunks = splitForSpeech('안녕하세요. 오늘은 맑아요!');
  assert.deepEqual(chunks, ['안녕하세요. 오늘은 맑아요!'], 'a short answer is one piece');
  assert.deepEqual(splitForSpeech(''), []);
  assert.deepEqual(splitForSpeech('   '), []);
}

// A long answer (>3,000 characters): every piece ≤180, in order, and joined
// back it is exactly the text — nothing dropped, nothing read twice.
{
  const paragraphs = [];
  for (let index = 1; paragraphs.join('\n').length < 3600; index += 1) {
    paragraphs.push(`### ${index}번째 안내`);
    paragraphs.push(`${index}번째 문단입니다. 전주 덕진공원의 연꽃은 7월에 가장 아름답고, 산책로는 약 1.2km 이며 휠체어로도 다닐 수 있어요. 주차는 ${index}시간까지 무료입니다!`);
    paragraphs.push(`- 운영 시간: 오전 9시부터 오후 6시까지 (${index}회차)`);
    paragraphs.push(`- 문의: 063-281-${String(2000 + index)} 또는 https://example.com/${index}`);
  }
  // One sentence far longer than a piece, with no full stop at all.
  paragraphs.push('마지막으로 '.concat('아주 긴 문장이 끝없이 이어지는 경우에도 단어 중간에서 끊지 않고 '.repeat(8), '끝납니다'));
  const answer = paragraphs.join('\n');
  assert.ok(answer.length >= 3000, `fixture must be a 3,000+ character answer (got ${answer.length})`);
  const spoken = speechTextFromAnswer(answer);
  const chunks = splitForSpeech(spoken);
  assert.ok(chunks.length >= 20, `a long answer is read in many pieces (got ${chunks.length})`);
  for (const chunk of chunks) {
    assert.ok(chunk.length > 0 && chunk.length <= 180, `piece too long or empty: ${chunk.length}`);
    assert.equal(chunk, chunk.trim());
  }
  assert.equal(chunks.join(' '), normalize(spoken), 'the pieces joined back must be the whole text, in order, once');
  // Each numbered paragraph appears exactly once across all pieces.
  const joined = chunks.join(' ');
  for (let index = 1; index <= 10; index += 1) {
    assert.equal(` ${joined}`.split(` ${index}번째 문단입니다.`).length - 1, 1, `paragraph ${index} must be read exactly once`);
  }
  // The over-long sentence is broken at spaces, never inside a word.
  const words = new Set(normalize(spoken).split(' '));
  for (const chunk of chunks) for (const word of chunk.split(' ')) assert.ok(words.has(word), `"${word}" is a broken word`);
  console.log(`long answer: ${answer.length} chars → ${spoken.length} spoken chars → ${chunks.length} pieces (max ${Math.max(...chunks.map(c => c.length))})`);
}

console.log('CHAT-READ-ALOUD-RESTORE-P0 TEXT CONTRACT PASS');
