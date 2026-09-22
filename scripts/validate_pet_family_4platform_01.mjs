import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const core = fs.readFileSync('site-core.js', 'utf8');
const conversation = fs.readFileSync('site-conversation.js', 'utf8');
const css = fs.readFileSync('site-pet-family.css', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect((index.match(/data-pet-family-open/g) || []).length === 2, 'Desktop and mobile Pet entry buttons are required');
expect(index.includes('site-pet-family.css'), 'Pet stylesheet must be linked');
expect(conversation.includes("['NOSE_FRONT', '1. 코 정면']"), 'Nose front slot missing');
expect(conversation.includes("['NOSE_LEFT', '2. 코 약간 왼쪽']"), 'Nose left slot missing');
expect(conversation.includes("['NOSE_RIGHT', '3. 코 약간 오른쪽']"), 'Nose right slot missing');
expect(conversation.includes("['DISTINCTIVE', '10. 특징이 가장 잘 보이는 사진']"), 'Distinctive slot missing');
expect(conversation.includes('공개 자동 매칭과 보호자 자동 알림은 아직 활성화되지 않았습니다.'), 'Unreleased matching notice missing');
expect(conversation.includes("const requestId = newPetRequestId('site.pet.create')"), 'Pet create request ID must be retry-stable per form');
expect(conversation.includes("const requestId = newPetRequestId('site.pet.sos')"), 'SOS request ID must be retry-stable per form');
expect(conversation.includes("const requestId = newPetRequestId('site.pet.found')"), 'Found request ID must be retry-stable per form');
expect(core.includes("'/v2/pets'"), 'Pet Registry route missing');
expect(core.includes("'/nickname'"), 'Pet nickname route missing');
expect(core.includes("'/photos/'"), 'Pet photo route missing');
expect(core.includes("'/v2/pets/sos'"), 'Pet SOS route missing');
expect(core.includes("'/v2/pets/found'"), 'Found Pet route missing');
expect(core.includes("'X-Request-ID'"), 'Pet request idempotency header missing');
expect(css.includes('@media (max-width: 700px)'), 'Mobile Pet responsive contract missing');
expect(!conversation.includes('OWNER_ALERT_ENABLED=true'), 'Owner alert must remain disabled');
expect(!conversation.includes('PUBLIC_MATCHING_ENABLED=true'), 'Public matching must remain disabled');
expect(!conversation.includes('100% 일치합니다'), 'Pet matching certainty claim is forbidden');

console.log('PET FAMILY 4-platform static contracts: GREEN');
