// SITE-PROFILE-HANDLE-TO-ACCOUNT-01
//
// 대표: 프로필 화면에서 공개 아이디를 빼라.
//
// 계정 전역 식별자를 두 화면에서 고칠 수 있으면 두 곳이 같은 값을 두고 다툽니다.
// 주인은 계정 페이지이고, 이 화면은 표시 이름과 사진만 다룹니다.
//
// 숨긴 것이 아니라 돌려보낸 것이라는 점이 이 게이트의 핵심입니다. 값에 닿을 길이
// 사라지면 그건 제거가 아니라 접근 차단입니다. 프로필 메뉴의 '설정'이 계정
// 페이지로 직행하므로 길은 한 단계 위에 그대로 있고, 아래에서 그것을 잠급니다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const conversation = fs.readFileSync(path.join(ROOT, 'site-conversation.js'), 'utf8');

const profile = conversation.slice(
  conversation.indexOf('const openProfile = () => {'),
  conversation.indexOf('const openPersonalTheme = () => {'),
);
assert.ok(profile.length > 200, 'the profile modal must remain locatable');

// ── 1. 이 화면은 더 이상 계정 전역 식별자를 고치지 않는다 ─────────────────
// 주석은 떼고 봅니다. 여기서 막으려는 것은 코드가 그 값에 손대는 일이지, 왜
// 뺐는지 설명하는 문장이 아닙니다. 설명까지 금지하면 다음 사람이 이유를 모른 채
// 되돌립니다.
const profileCode = profile.replace(/^[ \t]*\/\/.*$/gm, '');
assert.ok(!profileCode.includes('publicHandle'), '프로필 화면은 계정 전역 식별자를 읽지도 쓰지도 않아야 합니다');
assert.ok(!/handle/i.test(profileCode), '핸들 입력·라벨·도움말이 모두 사라져야 합니다');
// 저장 요청에 실리는 필드는 표시 이름 하나뿐. 실을 수 없으면 덮어쓸 수도 없다.
assert.ok(
  profile.includes('updateCurrentSiteProfile(sessionToken, {displayName: name.value})'),
  '프로필 저장은 표시 이름만 보내야 합니다 — 그래야 계정 쪽 값을 덮어쓸 길이 없습니다',
);
// 화면에 붙는 노드 목록에서도 빠져야 한다.
assert.ok(
  profile.includes('content.append(preview, photoPicker, error, nameLabel, emailField, save)'),
  '핸들 필드가 화면 구성에서 빠져야 합니다',
);

// ── 2. 지운 것이 아니라 돌려보낸 것 ───────────────────────────────────────
// 값의 주인에게 가는 길은 반드시 남아야 합니다. #250 이 프로필 모달 안의 관리
// 버튼을 없앴으므로, 이제 그 길은 프로필 메뉴의 '설정'입니다.
assert.ok(
  conversation.includes("const ACCOUNT_MANAGE_URL = 'https://account.lotbiai.com/account'"),
  '계정 페이지 주소가 남아 있어야 합니다',
);
assert.ok(
  conversation.includes('const openSettings = () => { window.location.assign(ACCOUNT_MANAGE_URL); };'),
  "'설정'이 계정 페이지로 직행해야 합니다 — 핸들을 고치러 갈 유일한 길입니다",
);
const menu = conversation.slice(
  conversation.indexOf('const openProfileMenu = trigger =>'),
  conversation.indexOf('const openProfileMenu = trigger =>') + 4000,
);
assert.ok(menu.includes("['설정', openSettings]"), "프로필 메뉴에 '설정'이 남아 있어야 합니다");

// ── 3. canonical 핸들 표시는 그대로 ───────────────────────────────────────
// 옮긴 것은 편집기뿐입니다. 계정 행과 프로필 요약이 보여주는 canonical 값은
// validate_identity_profile_hotfix_02 / validate_conversation_sidebar_ux_01 의
// 계약이라 그대로 살아 있어야 합니다.
assert.ok(conversation.includes('serverIdentity?.publicHandle'), 'canonical 핸들 표시는 그대로여야 합니다');
assert.ok(
  conversation.includes("handle.className = 'profile-popover-summary-handle'"),
  '프로필 요약의 @핸들 표시는 그대로여야 합니다',
);

console.log('SITE-PROFILE-HANDLE-TO-ACCOUNT-01 OK — 편집기는 계정 페이지로, 표시는 그대로');
