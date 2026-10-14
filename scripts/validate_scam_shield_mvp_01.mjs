// SITE-SCAM-SHIELD-MVP-01 (SCAM-PHISHING-REDESIGN-02 contract) — 사기·피싱 확인 is a
// workspace page (route #scam), not a dialog: the LOTBI menu stays, no dimmed
// backdrop, one scroll owner. Static source contract; the browser validators
// (validate_scam_shield_*.mjs) render it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const core = read('site-core.js');
const conversation = read('site-conversation.js');
const ui = read('site-scam-shield.js');
const css = read('site-scam-shield.css');

// Page, not dialog.
assert.doesNotMatch(html, /class="scam-dialog"|data-scam-dialog/u, 'the old popup dialog is gone from the page markup');
assert.doesNotMatch(ui, /showModal|<dialog|::backdrop/u, 'no modal dialog in the scam module');
assert.doesNotMatch(css, /::backdrop|position:\s*fixed/u, 'no backdrop, no fixed overlay in the scam styles');
assert.doesNotMatch(css, /overflow(?:-y)?:\s*(?:auto|scroll)/u, 'no inner scroll box: the workspace is the one scroll owner');
assert.match(conversation, /import \{mountScamShield\} from '\.\/site-scam-shield\.js\?v=aset-[0-9a-f]{12}';/u);
assert.match(conversation, /const openScamShieldPage = \(\) => \{[\s\S]*?closeMobileDrawer\(\);[\s\S]*?modalShell\('사기·피싱 확인'\)[\s\S]*?installSurfaceBehavior\(backdrop, panel, \{workspace: 'scam', route: 'scam', onClose: \(\) => mounted\?\.dispose\(\)\}\);[\s\S]*?mounted = mountScamShield\(content\);/u, 'opens as a workspace like 지역정보');
assert.match(conversation, /back\.textContent = '← 대화로 돌아가기'/u, '대화로 돌아가기 stays the top secondary action');
assert.match(conversation, /scam: \(\) => openScamShieldPage\(\),/u, '#scam reopens the page on reload and back/forward');
assert.match(conversation, /window\.addEventListener\('lotbi:scam-shield-open-request', \(\) => \{ void openScamShieldPage\(\); \}\);/u, 'login return and other features open it by event');
assert.match(conversation, /window\.addEventListener\('lotbi:scam-shield-close-request', \(\) => \{\s*if \(isScamShieldOpen\(\)\) leaveSiteRoute\('', \(\) => \{ if \(isScamShieldOpen\(\)\) closeSurface\(\); \}\);/u, 'in-page 대화로 돌아가기 leaves through the route owner');
assert.match(conversation, /\(workspace === 'scam' && entry\.hasAttribute\('data-scam-open'\)\)/u, 'the menu entry is marked current while the page is open');
assert.match(conversation, /const scamTrigger = target\?\.closest\('\[data-scam-open\]'\);/u);
assert.equal((html.match(/data-scam-open aria-label="사기·피싱 확인"/gu) || []).length, 2, 'desktop and mobile menu names');
assert.equal((html.match(/data-consumer-section="mall"[^>]*hidden/gu) || []).length, 2, '연결 서비스 stays hidden');

// Copy of the owner-approved design (시안 01 확정본).
for (const copy of [
  '롯비야, 이거 진짜야?',
  '의심되는 문자·이메일·주소·사진·파일을 보내 주세요. 의심 신호와 안전하게 확인하는 방법을 알려드려요.',
  '무엇을 확인할까요?',
  '문자·이메일', '인터넷 주소', '사진·파일',
  '사진·스크린샷 고르기', '문서·PDF 고르기', '카메라로 찍기',
  '이미 눌렀거나 개인정보를 입력했나요?', '아니요, 아직이에요', '네, 눌렀거나 입력했어요',
  '어느 기기에서 그랬나요?', '어디까지 했나요?',
  '링크나 파일을 열었어요', '개인정보 일부를 입력했어요', '비밀번호·OTP를 입력했어요', '앱·프로그램을 설치했어요', '접근성·원격제어 권한을 줬어요', '송금·결제가 발생했어요',
  '의심 신호 확인하기', '분석 결과는 참고용이며, 최종 확인은 공식 기관·서비스에서 해주세요.',
  '분석 결과는 참고용이에요. 최종 확인은 공식 기관·공식 서비스에서 직접 해 주세요. 의심 링크는 다시 열거나 답장하지 마세요.',
  '확인된 위험 신호 없음', '다만 안전하다는 보증은 아니에요.',
  '이미 눌렀다면 지금 해야 할 일', '분석 결과보다 먼저', '내용 분석 결과',
  '공식 신고·상담 창구', '송금 피해', '보이스피싱·스미싱 통합 신고·상담', '즉시 출동이 필요한 긴급 상황', '사이버 보안·스미싱 상담', '사이버범죄 온라인 신고',
  '이 기기 말고 다른 안전한 전화기나 PC로 연락하세요',
  '이번 달 심층분석 사용량을 모두 사용했어요', '사기·피싱 확인은 로그인 후 사용할 수 있어요',
]) assert.ok(ui.includes(copy), copy);
assert.doesNotMatch(ui, /'위험 신호 없음'/u, 'the level is always named 확인된 위험 신호 없음');
assert.doesNotMatch(ui, /C안|바로 입력형|진위확인/u, 'design-only labels and the old menu name are absent');

// Inputs.
assert.match(ui, /maxlength: String\(maxTextLength\)/u);
assert.match(ui, /const maxTextLength = 20000;/u);
assert.match(ui, /photoInput\.accept = 'image\/\*';/u);
assert.match(ui, /cameraInput\.accept = 'image\/jpeg,image\/png,image\/webp';\s*cameraInput\.setAttribute\('capture', 'environment'\);/u);
assert.doesNotMatch(ui, /photoInput\.setAttribute\('capture'/u, 'the photo picker never forces the camera');
assert.match(ui, /documentInput\.accept = '\.txt,text\/plain,\.html,\.htm,text\/html,application\/pdf';/u);
assert.match(ui, /data-scam-pick': 'camera'\}, on: \{click: open\('camera'\)\}, hidden: true\}/u, 'desktop starts fail-closed until a camera is found');
assert.match(ui, /isMobileDevice\(\)/u);
assert.match(ui, /device\?\.kind === 'videoinput'/u);
assert.match(ui, /if \(isMobileDevice\(\)\) \{ camera\.hidden = false; return; \}/u, 'phones always show the camera action');
assert.match(ui, /function inputValid\(\)/u);
assert.match(ui, /inputRefs\.submit\.disabled = !valid;/u);
assert.match(ui, /if \(disposed \|\| id !== request\) return;/u, 'late responses cannot replace a newer input');
assert.match(ui, /data\.set\('incident_level', String\(state\.stage \|\| 1\)\);\s*data\.set\('device', state\.device\);/u, 'incident fields are sent only with 네');
assert.match(ui, /검사 대상/u);
assert.match(ui, /검사 시각/u);
assert.match(ui, /발신자·사건 진위까지 확인했다는 뜻은 아니에요/u);
assert.match(ui, /현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요/u);
assert.match(ui, /파일은 10MB 이하만 확인할 수 있어요/u);
assert.match(ui, /PLAN_USAGE_LIMIT_REACHED/u);
assert.match(ui, /basicProtection/u);
assert.doesNotMatch(ui, /안전합니다|안전해요/u);

// Safety rules of the 확정본.
assert.doesNotMatch(ui, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/u, 'every text is set with textContent');
assert.doesNotMatch(ui, /window\.open\(|<iframe|createElement\('iframe'\)|createElement\('object'\)|createElement\('embed'\)/u, 'a chosen file is never opened');
assert.match(ui, /const previewImageTypes = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\);/u, 'only a JPEG/PNG/WEBP photo gets a thumbnail');
assert.match(ui, /문서·HTML은 열거나 미리 보지 않고 이름·형식·크기만 보여 줘요\./u);
assert.doesNotMatch(ui, /보관(?:\s*기간|해요|합니다|돼요|됩니다)|보존|삭제됩니다|삭제돼요|저장하지 않|저장돼요|저장됩니다/u, 'no storage/retention/deletion copy until that policy is set');
assert.match(ui, /if \(context\.url\) kv\.push\(\['검사한 주소', context\.url\]\);/u, 'the checked address is shown as text');
assert.match(ui, /const href = scamOfficialUrl\(/u, 'official buttons only through the allowlist');
assert.match(ui, /const CALM_LINES = new Set\(\[/u, 'calm lines never contradict an incident');
assert.match(ui, /if \(incident\) \{\s*nodes\.push\(incidentCard\(/u, 'an incident comes before the analysis');

assert.match(core, /\/v2\/scam-shield\/cases/u);
assert.match(core, /untrusted_file_execution !== false/u);
assert.match(core, /public_file_upload_to_third_party !== false/u);
assert.match(core, /response\.status === 202/u, 'a pending duplicate is not reported as a broken response');
assert.match(conversation, /analyzeScamShield\(sessionToken, detail\.formData\)/u);
assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
assert.match(css, /@media \(max-width: 760px\)/u);
assert.match(css, /\.scam-page\.sp-root \.sp-dock \{\s*position: sticky; bottom: 0;/u, 'the phone submit button stays in reach without covering the page');

console.log('SITE-SCAM-SHIELD-MVP-01 PASS');
