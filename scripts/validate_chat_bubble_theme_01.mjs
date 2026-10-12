import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyChatBubbleTheme, normalizeChatBubbleColor, readableChatTextColor} from '../site-chat-theme.js';

assert.equal(normalizeChatBubbleColor('#7B62BB'), '#7b62bb');
assert.equal(normalizeChatBubbleColor('red'), null);
assert.equal(readableChatTextColor('#000000'), '#ffffff');
assert.equal(readableChatTextColor('#ffffff'), '#111827');

const properties = new Map();
const root = {style: {
  setProperty(name, value) { properties.set(name, value); },
  removeProperty(name) { properties.delete(name); },
}};
assert.deepEqual(applyChatBubbleTheme('#ffffff', root), {color: '#ffffff', customized: true});
assert.equal(properties.get('--user-bubble'), '#ffffff');
assert.equal(properties.get('--user-bubble-foreground'), '#111827');
assert.deepEqual(applyChatBubbleTheme('broken', root), {color: '#1f2a44', customized: false});
assert.equal(properties.size, 0);

const core = readFileSync('site-core.js', 'utf8');
const conversation = readFileSync('site-conversation.js', 'utf8');
const css = readFileSync('site-conversation.css', 'utf8');
assert.match(core, /chatBubbleColor:[\s\S]*?user\.chat_bubble_color/u);
assert.match(conversation, /applyChatBubbleTheme\(identity\.chatBubbleColor\)/u);
assert.match(conversation, /applyChatBubbleTheme\(null\)/u);
assert.match(css, /background: var\(--user-bubble, var\(--brand-navy\)\)/u);
assert.match(css, /color: var\(--user-bubble-foreground, #fff\)/u);
assert.doesNotMatch(conversation, /localStorage[^\n]*chat.*bubble/iu);

console.log('SITE-CHAT-BUBBLE-THEME-01 CONTRACT PASS');
