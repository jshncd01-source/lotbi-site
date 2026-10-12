import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const conversation = readFileSync('site-conversation.js', 'utf8');
const css = readFileSync('site-conversation.css', 'utf8');

assert.match(conversation, /phone\.href = phoneHref/u);
assert.match(conversation, /navigate\.href = buildNaverMapsWebSearchUrl\(place\)/u);
assert.match(conversation, /phone\.dataset\.action = 'phone'/u);
assert.match(conversation, /navigate\.dataset\.action = 'naver-map'/u);
assert.match(css, /\.lotbi-place-card-actions \{[\s\S]*?display: flex;[\s\S]*?width: 100%;[\s\S]*?justify-content: flex-end;/u);
assert.match(css, /\.lotbi-place-card-actions \.lotbi-phone-action \{\s*margin-right: auto;/u);
assert.match(css, /\.lotbi-place-card-actions \.lotbi-naver-map-action \{\s*order: 10;/u);
assert.match(css, /\.lotbi-rich-card-icon-action \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/u);

console.log('SITE-PLACE-ACTION-EDGES-01 CONTRACT PASS');
