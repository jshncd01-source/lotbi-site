import assert from 'node:assert/strict';
import {themeTokenValue} from './lib/theme-token-value.mjs';
assert.equal(themeTokenValue('--lotbi-ink: #ABCDEF; --lotbi-alias: var(--lotbi-ink);', '--lotbi-alias'), '#abcdef');
assert.throws(() => themeTokenValue('--lotbi-a: var(--lotbi-b); --lotbi-b: var(--lotbi-a);', '--lotbi-a'), /cyclic/);
assert.throws(() => themeTokenValue('--lotbi-a: var(--lotbi-missing);', '--lotbi-a'), /missing/);
assert.throws(() => themeTokenValue('--lotbi-a: rgb(0,0,0);', '--lotbi-a'), /unsupported/);
console.log('SEMANTIC THEME TOKEN RESOLUTION: PASS (alias, cycle, missing, unsupported)');
