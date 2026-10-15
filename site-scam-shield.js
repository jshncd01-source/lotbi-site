// SCAM-PHISHING-REDESIGN-02 — 사기·피싱 확인 is a workspace page (route #scam),
// like 지역정보 · 분쟁·사고 도우미: site-conversation.js opens the page shell and
// calls mountScamShield(content). No dialog, no backdrop, one scroll owner (the
// workspace). Owner-approved design: 사기·피싱 확인 시안 01 확정본 (2026-10-14).
//
// Safety rules kept here on purpose:
// - every text from the user, a file name or Core is set with textContent;
//   nothing is parsed as HTML and no checked address becomes a link;
// - a chosen file is never opened or previewed except a photo thumbnail
//   (an object URL of the user's own image, JPEG/PNG/WEBP only);
// - official buttons open only exact pre-approved hosts (site-core.js);
// - no copy about storage, retention or deletion: that policy is not set.
// Requests still go through window events answered by site-conversation.js,
// which owns the session token.

import {scamOfficialUrl} from './site-core.js?v=aset-e30ee57ac068';

const allowedFileTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/html', 'application/xhtml+xml', 'application/pdf']);
const allowedFileExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'txt', 'html', 'htm']);
const previewImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxFileBytes = 10 * 1024 * 1024;
const maxTextLength = 20000;
const reopenStorageKey = 'lotbi.scam-shield.reopen.v1';
const reopenTtlMs = 15 * 60 * 1000;
const MOBILE_QUERY = '(max-width: 760px)';

const UNSUPPORTED_FILE = '현재는 사진, PDF, TXT, HTML 파일만 확인할 수 있어요.';
const FILE_TOO_LARGE = '파일은 10MB 이하만 확인할 수 있어요.';
const NO_GUARANTEE = '다만 안전하다는 보증은 아니에요.';
const SAFETY_SENTENCE = `확인한 범위에서 위험 신호는 찾지 못했어요. ${NO_GUARANTEE}`;
const DOUBLE_CHECK_FAILED = '2단계 확인을 끝내지 못했어요. 확인되지 않은 부분이 있으니 공식 연락처로 직접 확인하세요.';
// With an incident these two lines would contradict the incident card (owner
// rule: an incident always comes before the analysis), so they are not shown.
const CALM_LINES = new Set([
  '지금 당장 급하게 처리하실 일은 없어 보여요.',
  '오늘이 휴일이면 그대로 두셨다가 평일에 공식 홈페이지나 대표번호로 확인하세요.',
]);

const DEVICES = Object.freeze([
  {value: 'Galaxy', label: 'Android·Galaxy', icon: 'phone'},
  {value: 'iPhone', label: 'iPhone', icon: 'phone'},
  {value: 'Windows', label: 'Windows PC', icon: 'laptop'},
  {value: 'macOS', label: 'Mac', icon: 'laptop'},
]);
const STAGES = Object.freeze([
  {level: 1, label: '링크나 파일을 열었어요', icon: 'link'},
  {level: 2, label: '개인정보 일부를 입력했어요', icon: 'user'},
  {level: 3, label: '비밀번호·OTP를 입력했어요', icon: 'key'},
  {level: 4, label: '앱·프로그램을 설치했어요', icon: 'install'},
  {level: 5, label: '접근성·원격제어 권한을 줬어요', icon: 'remote'},
  {level: 6, label: '송금·결제가 발생했어요', icon: 'card'},
]);

// Official report/consult channels by purpose (owner-approved 2026-10-14).
const CONTACTS = Object.freeze({
  pay: {use: '송금 피해', main: '돈을 보낸 금융회사 고객센터', org: '즉시 지급정지를 요청하세요 · 번호는 그 금융회사 공식 앱·홈페이지에서 확인', icon: 'card', tel: '', url: ''},
  sos: {use: '보이스피싱·스미싱 통합 신고·상담', main: '1394', org: '전기통신금융사기 통합대응단(경찰청)', icon: 'call', tel: '1394', url: 'https://www.counterscam112.go.kr/'},
  emergency: {use: '즉시 출동이 필요한 긴급 상황', main: '112', org: '경찰청', icon: 'alert', tel: '112', url: ''},
  kisa: {use: '사이버 보안·스미싱 상담', main: '118', org: '한국인터넷진흥원(KISA) 보호나라', icon: 'shield', tel: '118', url: 'https://www.boho.or.kr/'},
  ecrm: {use: '사이버범죄 온라인 신고', main: '경찰청 ECRM', org: '경찰청 사이버범죄 신고시스템', icon: 'ext', tel: '', url: 'https://ecrm.police.go.kr/minwon/main'},
});
const TILES = Object.freeze({
  pay: {key: '지급정지', sub: '금융회사 고객센터'},
  sos: {key: '1394', sub: '신고·상담', tel: '1394'},
  emergency: {key: '112', sub: '긴급 출동', tel: '112'},
  kisa: {key: '118', sub: '보안 상담', tel: '118'},
});

const LEVELS = Object.freeze({
  CURRENTLY_NO_RISK_SIGNAL: {tone: 'ok', label: '확인된 위험 신호 없음', icon: 'okc', meter: 1},
  UNVERIFIED: {tone: 'warn', label: '확인 안 됨', icon: 'help', meter: 2},
  SUSPICIOUS: {tone: 'warn', label: '주의 필요', icon: 'alert', meter: 2},
  HIGH_RISK: {tone: 'bad', label: '위험 높음', icon: 'stop', meter: 3},
  CONFIRMED_MALICIOUS: {tone: 'bad', label: '위험 높음', icon: 'stop', meter: 3},
});

// One line-icon set (24 grid, 1.8 stroke), drawn with currentColor.
const ICONS = {
  shield: [['path', {d: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z'}], ['path', {d: 'M9 12l2 2 4-4'}]],
  msg: [['rect', {x: 3, y: 5, width: 18, height: 14, rx: 2}], ['path', {d: 'M3.5 7l8.5 6 8.5-6'}]],
  link: [['path', {d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'}], ['path', {d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'}]],
  files: [['rect', {x: 3, y: 6, width: 12, height: 15, rx: 2}], ['path', {d: 'M8 3h9a2 2 0 0 1 2 2v12'}], ['path', {d: 'M3 16l3.5-3.5L10 16'}]],
  image: [['rect', {x: 3, y: 4, width: 18, height: 16, rx: 2}], ['circle', {cx: 9, cy: 10, r: 1.8}], ['path', {d: 'M21 16l-5-5-9 9'}]],
  file: [['path', {d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'}], ['path', {d: 'M14 3v5h5'}], ['path', {d: 'M9 13h6M9 17h4'}]],
  camera: [['path', {d: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'}], ['circle', {cx: 12, cy: 13.5, r: 3.5}]],
  paste: [['rect', {x: 8, y: 3, width: 8, height: 4, rx: 1}], ['path', {d: 'M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2'}]],
  next: [['path', {d: 'M5 12h14M13 6l6 6-6 6'}]],
  chev: [['path', {d: 'M6 9l6 6 6-6'}]],
  check: [['path', {d: 'M5 12.5l4.5 4.5L19 7.5'}]],
  x: [['path', {d: 'M6 6l12 12M18 6L6 18'}]],
  stop: [['path', {d: 'M8 3h8l5 5v8l-5 5H8l-5-5V8z'}], ['path', {d: 'M12 8v5'}], ['path', {d: 'M12 16.5v.01'}]],
  alert: [['path', {d: 'M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z'}], ['path', {d: 'M12 10v4'}], ['path', {d: 'M12 17.5v.01'}]],
  help: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.4'}], ['path', {d: 'M12 17v.01'}]],
  info: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M12 11v5'}], ['path', {d: 'M12 7.8v.01'}]],
  okc: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M8 12.3l2.8 2.8L16.2 9.6'}]],
  clock: [['circle', {cx: 12, cy: 12, r: 9}], ['path', {d: 'M12 7v5l3 2'}]],
  refresh: [['path', {d: 'M20 12a8 8 0 1 1-2.3-5.7'}], ['path', {d: 'M20 4v5h-5'}]],
  wifioff: [['path', {d: 'M3 3l18 18'}], ['path', {d: 'M8.6 16.4a5 5 0 0 1 6.8 0'}], ['path', {d: 'M5 12.8a10 10 0 0 1 4.6-2.6'}], ['path', {d: 'M19 12.8a10 10 0 0 0-2.4-1.7'}], ['path', {d: 'M12 20h.01'}]],
  lock: [['rect', {x: 5, y: 11, width: 14, height: 10, rx: 2}], ['path', {d: 'M8 11V7a4 4 0 0 1 8 0v4'}]],
  phone: [['rect', {x: 6.5, y: 2.5, width: 11, height: 19, rx: 2.5}], ['path', {d: 'M11 18h2'}]],
  laptop: [['rect', {x: 4, y: 5, width: 16, height: 11, rx: 1.5}], ['path', {d: 'M2 19h20'}]],
  user: [['circle', {cx: 12, cy: 8, r: 4}], ['path', {d: 'M4 21a8 8 0 0 1 16 0'}]],
  key: [['circle', {cx: 8, cy: 15, r: 4}], ['path', {d: 'M11 12l9-9'}], ['path', {d: 'M16.5 6.5l3 3'}]],
  install: [['path', {d: 'M12 4v11M7 10l5 5 5-5'}], ['path', {d: 'M5 20h14'}]],
  remote: [['path', {d: 'M5 3l13 6.5-5.5 1.8L10.7 17z'}], ['path', {d: 'M13 13l6 6'}]],
  card: [['rect', {x: 3, y: 5.5, width: 18, height: 13, rx: 2}], ['path', {d: 'M3 10h18'}], ['path', {d: 'M7 15h3'}]],
  search: [['circle', {cx: 11, cy: 11, r: 7}], ['path', {d: 'M20 20l-3.5-3.5'}]],
  bank: [['path', {d: 'M3 21h18'}], ['path', {d: 'M5 21v-9M10 21v-9M14 21v-9M19 21v-9'}], ['path', {d: 'M2.5 9.5L12 4l9.5 5.5z'}]],
  ext: [['path', {d: 'M14 4h6v6'}], ['path', {d: 'M20 4l-9 9'}], ['path', {d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'}]],
  list: [['path', {d: 'M9 6h11M9 12h11M9 18h11'}], ['path', {d: 'M4.5 6h.01M4.5 12h.01M4.5 18h.01'}]],
  call: [['path', {d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'}]],
  edit: [['path', {d: 'M4 20h4L19 9l-4-4L4 16z'}], ['path', {d: 'M13 7l4 4'}]],
  chat: [['path', {d: 'M4 5h16v11H10l-5 4v-4H4z'}]],
};
const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, className = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `sp-ic${className ? ` ${className}` : ''}`);
  for (const [tag, attrs] of ICONS[name] || []) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    svg.append(node);
  }
  return svg;
}

// Tiny element builder: text is always textContent, never HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  const {className, text, attrs, on, hidden} = props;
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  if (on) for (const [type, handler] of Object.entries(on)) node.addEventListener(type, handler);
  if (hidden) node.hidden = true;
  for (const child of children.flat()) if (child) node.append(child);
  return node;
}

function fileIsSupported(file) {
  const type = typeof file?.type === 'string' ? file.type.toLowerCase() : '';
  const extension = typeof file?.name === 'string' && file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return (!type || allowedFileTypes.has(type)) && allowedFileExtensions.has(extension);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  // Rounded up, so a file just over 10MB never reads as 10.0MB.
  if (bytes >= 1024 * 1024) return `${(Math.ceil((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function fileKindLabel(file) {
  const extension = typeof file?.name === 'string' && file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '';
  if (String(file?.type || '').startsWith('image/')) return `${extension || '이미지'} 사진`;
  if (extension === 'PDF') return 'PDF 문서';
  if (extension === 'HTML' || extension === 'HTM') return 'HTML 문서';
  if (extension === 'TXT') return 'TXT 문서';
  return extension ? `${extension} 파일` : '파일';
}

function urlIsValid(value) {
  if (!value) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function isMobileDevice() {
  return globalThis.matchMedia?.('(pointer: coarse)')?.matches === true
    || /Android|iPhone|iPad|iPod|Mobile/i.test(globalThis.navigator?.userAgent || '');
}

function requestAnalysis(formData) {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent('lotbi:scam-shield-request', {detail: {formData, resolve, reject}}));
  });
}

function requestSessionAvailability() {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value === true);
    };
    const timeout = setTimeout(() => finish(false), 3000);
    try {
      window.dispatchEvent(new CustomEvent('lotbi:scam-shield-session-request', {detail: {resolve: finish}}));
    } catch {
      finish(false);
    }
  });
}

function shouldReopenAfterLogin() {
  try {
    const value = JSON.parse(sessionStorage.getItem(reopenStorageKey) || 'null');
    sessionStorage.removeItem(reopenStorageKey);
    return Boolean(value && Number.isFinite(value.startedAt) && Date.now() - value.startedAt <= reopenTtlMs);
  } catch {
    return false;
  }
}

function formatCheckedAt(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {dateStyle: 'medium', timeStyle: 'short'}).format(parsed);
}

const requestClose = () => window.dispatchEvent(new CustomEvent('lotbi:scam-shield-close-request'));

export function mountScamShield(root) {
  const mobileQuery = globalThis.matchMedia?.(MOBILE_QUERY);
  const isMobile = () => mobileQuery?.matches === true;
  const state = {
    phase: 'checking', tab: 'text', text: '', url: '', file: null, fileKind: '', fileError: '', fieldError: '',
    incident: '', device: '', stage: 0, result: null, context: null, failure: null, limitActions: [],
    moreDo: false, moreIncident: false, contactsOpen: false, open: {sig: true}, lastForm: null,
  };
  let disposed = false;
  let request = 0;
  let previewUrl = '';
  let inputRefs = null;

  root.classList.add('scam-page', 'sp-root');
  root.dataset.scamPage = '';
  const status = el('p', {className: 'sp-sr', attrs: {role: 'status', 'aria-live': 'polite', 'data-scam-status': ''}});
  const body = el('div', {className: 'sp-body'});
  root.replaceChildren(body, status);

  const announce = message => { status.textContent = message; };
  // A file dropped while this page is open is taken like a picked one and never
  // handed to the browser, which would open it (a dropped HTML file loads as a page).
  const carriesFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const dropTarget = event => state.phase === 'input' && event.target instanceof Node && root.contains(event.target);
  const onDragOver = event => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = dropTarget(event) ? 'copy' : 'none';
  };
  const onDrop = event => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file || !dropTarget(event)) return;
    state.tab = 'file';
    state.fieldError = '';
    chooseFile(file, String(file.type || '').toLowerCase().startsWith('image/') ? 'photo' : 'document');
  };
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);
  const scrollHost = () => root.closest('.consumer-workspace') || document.scrollingElement;
  const toTop = () => { try { scrollHost()?.scrollTo?.({top: 0, behavior: 'auto'}); } catch {} };
  const releasePreview = () => {
    if (previewUrl && typeof URL?.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  };

  // ---------- shared pieces ----------
  const intro = () => el('header', {className: 'sp-head'},
    el('span', {className: 'sp-head-ic'}, icon('shield', 'sp-ic-xl')),
    el('div', {},
      el('p', {className: 'sp-hero', text: '롯비야, 이거 진짜야?'}),
      el('p', {className: 'sp-lead', text: '의심되는 문자·이메일·주소·사진·파일을 보내 주세요. 의심 신호와 안전하게 확인하는 방법을 알려드려요.'})));
  const refNote = text => el('p', {className: 'sp-refnote', attrs: {role: 'note', 'data-scam-reference-note': ''}}, icon('info'), el('span', {text}));
  const button = (label, {kind = 'sec', iconName = '', onClick, extra = '', attrs = {}} = {}) => el('button', {
    className: `sp-btn sp-btn-${kind}${extra ? ` ${extra}` : ''}`,
    attrs: {type: 'button', ...attrs},
    on: onClick ? {click: onClick} : undefined,
  }, iconName ? icon(iconName, 'sp-ic-s') : null, el('span', {text: label}));
  const fact = (name, title, copy) => el('li', {className: 'sp-fact'}, el('span', {className: 'sp-fact-ic'}, icon(name)), el('span', {}, el('b', {text: title}), el('span', {text: copy})));
  const spec = (term, value) => el('div', {}, el('dt', {text: term}), el('dd', {text: value}));
  const facts = (withReference = true) => el('ul', {className: 'sp-facts'},
    fact('shield', '실행하지 않고 확인해요', '파일은 실행하지 않고, 링크는 내 기기에서 열지 않아요.'),
    fact('lock', '누르기 전엔 보내지 않아요', '‘의심 신호 확인하기’를 눌러야 전송돼요.'),
    withReference ? fact('info', '결과는 참고용이에요', '최종 확인은 공식 기관·서비스에서 해 주세요.') : null);
  const aside = () => el('aside', {className: 'sp-aside', attrs: {'aria-label': '확인 안내'}},
    el('section', {className: 'sp-card sp-pad-s'}, el('h3', {className: 'sp-aside-t', text: '안심하고 확인하세요'}), facts()),
    el('section', {className: 'sp-card sp-pad-s'}, el('h3', {className: 'sp-aside-t', text: '확인할 수 있는 것'}),
      el('dl', {className: 'sp-specs'},
        spec('문자·이메일', '20,000자까지'), spec('인터넷 주소', 'http·https 주소'), spec('사진·스크린샷', 'JPG·PNG·WEBP'),
        spec('문서', 'PDF·TXT·HTML'), spec('파일', '1개 · 10MB까지'))));
  const layout = (...main) => el('div', {className: 'sp-grid'}, el('div', {className: 'sp-col'}, ...main), aside());
  const safeList = (title, items) => el('div', {className: 'sp-safe-list'}, el('p', {className: 'sp-q', text: title}),
    el('ul', {}, ...items.map(text => el('li', {}, icon('shield', 'sp-ic-s'), el('span', {text})))));

  // ---------- phases ----------
  function render() {
    if (disposed) return;
    inputRefs = null;
    root.dataset.scamPhase = state.phase;
    const view = {checking: viewChecking, login: viewLogin, input: viewInput, loading: viewLoading, result: viewResult, failure: viewFailure, limit: viewLimit}[state.phase] || viewInput;
    body.replaceChildren(...view());
  }

  function viewChecking() {
    announce('로그인 상태를 확인하고 있어요.');
    return [intro(), layout(el('section', {className: 'sp-card sp-state'},
      el('span', {className: 'sp-spin', attrs: {'aria-hidden': 'true'}}),
      el('p', {className: 'sp-state-d', text: '로그인 상태를 확인하고 있어요.'})))];
  }

  function viewLogin() {
    const loginStatus = el('p', {className: 'sp-help sp-center', attrs: {role: 'status', 'data-scam-login-status': ''}});
    const login = button('로그인하고 확인하기', {kind: 'pri', iconName: 'user', attrs: {'data-scam-login': ''}, onClick: () => {
      try { sessionStorage.setItem(reopenStorageKey, JSON.stringify({startedAt: Date.now()})); } catch {}
      loginStatus.textContent = '공식 LOTBI 로그인 화면으로 이동합니다.';
      const detail = {
        resolve() {},
        reject(error) {
          try { sessionStorage.removeItem(reopenStorageKey); } catch {}
          loginStatus.textContent = error instanceof Error ? error.message : '로그인을 시작하지 못했습니다. 다시 시도해 주세요.';
        },
      };
      try { window.dispatchEvent(new CustomEvent('lotbi:scam-shield-login-request', {detail})); } catch (error) { detail.reject(error); }
    }});
    const leave = button('대화로 돌아가기', {iconName: 'chat', attrs: {'data-scam-login-cancel': ''}, onClick: requestClose});
    queueMicrotask(() => { if (login.isConnected) login.focus(); });
    announce('사기·피싱 확인은 로그인 후 사용할 수 있어요.');
    return [intro(), layout(el('section', {className: 'sp-card sp-state', attrs: {'data-scam-login-gate': ''}},
      el('span', {className: 'sp-state-ic sp-pri'}, icon('lock', 'sp-ic-xl')),
      el('h3', {className: 'sp-state-t', text: '사기·피싱 확인은 로그인 후 사용할 수 있어요'}),
      el('p', {className: 'sp-state-d', text: '확인할 자료를 안전하게 보호하기 위해 로그인이 필요합니다.'}),
      el('div', {className: 'sp-state-acts'}, login, leave),
      el('p', {className: 'sp-help sp-center', text: '로그인을 마치면 이 화면으로 다시 돌아와요.'}),
      loginStatus))];
  }

  function viewInput() {
    const refs = {};
    const tabs = [
      {id: 'text', label: '문자·이메일', icon: 'msg'},
      {id: 'url', label: '인터넷 주소', icon: 'link'},
      {id: 'file', label: '사진·파일', icon: 'files'},
    ];
    const tabList = el('div', {className: 'sp-tabs', attrs: {role: 'tablist', 'aria-label': '확인할 내용 종류'}});
    for (const tab of tabs) {
      const selected = state.tab === tab.id;
      tabList.append(el('button', {
        className: `sp-tab${selected ? ' is-on' : ''}`,
        attrs: {type: 'button', role: 'tab', 'aria-selected': String(selected), 'aria-controls': 'scam-input-panel', 'data-scam-tab': tab.id, tabindex: selected ? '0' : '-1'},
        on: {
          click: () => { if (state.tab === tab.id) return; state.tab = tab.id; state.fieldError = ''; render(); focusPanel(); },
          keydown: event => {
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const index = tabs.findIndex(item => item.id === state.tab);
            state.tab = tabs[(index + step + tabs.length) % tabs.length].id; state.fieldError = ''; render();
            root.querySelector('.sp-tab.is-on')?.focus();
          },
        },
      }, icon(tab.icon), el('span', {text: tab.label})));
    }
    const panel = el('div', {className: 'sp-panel', attrs: {id: 'scam-input-panel', role: 'tabpanel', 'data-scam-panel': state.tab}});
    if (state.tab === 'text') panel.append(...textPanel(refs));
    if (state.tab === 'url') panel.append(...urlPanel(refs));
    if (state.tab === 'file') panel.append(...filePanel(refs));
    const step1 = el('section', {className: 'sp-card sp-pad', attrs: {'aria-labelledby': 'scam-step1'}},
      el('div', {className: 'sp-step'}, el('span', {className: 'sp-step-n', text: '1', attrs: {'aria-hidden': 'true'}}), el('h3', {className: 'sp-step-t', text: '무엇을 확인할까요?', attrs: {id: 'scam-step1'}})),
      tabList, panel);

    const radio = (value, label) => el('button', {
      className: `sp-yn${state.incident === value ? ' is-on' : ''}`,
      attrs: {type: 'button', role: 'radio', 'aria-checked': String(state.incident === value), 'data-scam-incident': value},
      on: {click: () => {
        state.incident = value;
        if (value === 'no') { state.device = ''; state.stage = 0; }
        render();
        if (value === 'yes') root.querySelector('[data-scam-device-group] button')?.focus();
        else root.querySelector('[data-scam-incident="no"]')?.focus();
      }},
    }, el('span', {className: 'sp-radio', attrs: {'aria-hidden': 'true'}}), el('span', {text: label}));
    const step2 = el('section', {className: 'sp-card sp-pad sp-step2', attrs: {'aria-labelledby': 'scam-step2', 'data-scam-step2': ''}},
      el('div', {className: 'sp-row-sb'},
        el('div', {className: 'sp-step'}, el('span', {className: 'sp-step-n', text: '2', attrs: {'aria-hidden': 'true'}}), el('h3', {className: 'sp-step-t', text: '이미 눌렀거나 개인정보를 입력했나요?', attrs: {id: 'scam-step2'}})),
        el('span', {className: 'sp-opt', text: '선택'})),
      el('p', {className: 'sp-step-d', text: '알려 주시면 지금 해야 할 일을 기기에 맞춰 함께 알려드려요.'}),
      el('div', {className: 'sp-yns', attrs: {role: 'radiogroup', 'aria-labelledby': 'scam-step2'}}, radio('no', '아니요, 아직이에요'), radio('yes', '네, 눌렀거나 입력했어요')),
      state.incident === 'yes' ? followUp() : null);

    const submit = el('button', {className: 'sp-btn sp-btn-pri sp-big', attrs: {type: 'button', 'data-scam-submit': ''}, on: {click: () => void submitAnalysis()}},
      el('span', {text: '의심 신호 확인하기'}), icon('next'));
    const hint = el('p', {className: 'sp-help sp-center', attrs: {'data-scam-submit-hint': ''}});
    refs.submit = submit; refs.hint = hint;
    inputRefs = refs;
    queueMicrotask(updateSubmitState);
    const mobileFacts = el('section', {className: 'sp-card sp-pad-m sp-mobile-only', attrs: {'aria-label': '확인 안내'}}, facts(false));
    return [intro(), layout(step1, step2, mobileFacts, el('div', {className: 'sp-dock'}, submit, hint)),
      refNote('분석 결과는 참고용이며, 최종 확인은 공식 기관·서비스에서 해주세요.')];
  }

  function followUp() {
    const devices = el('div', {className: 'sp-chips', attrs: {role: 'radiogroup', 'aria-labelledby': 'scam-q1', 'data-scam-device-group': ''}});
    for (const device of DEVICES) {
      const on = state.device === device.value;
      devices.append(el('button', {className: `sp-chip${on ? ' is-on' : ''}`, attrs: {type: 'button', role: 'radio', 'aria-checked': String(on), 'data-scam-device': device.value},
        on: {click: () => { state.device = on ? '' : device.value; render(); root.querySelector(`[data-scam-device="${device.value}"]`)?.focus(); }}},
      icon(device.icon, 'sp-ic-s'), el('span', {text: device.label})));
    }
    const stages = el('div', {className: 'sp-stages', attrs: {role: 'radiogroup', 'aria-labelledby': 'scam-q2'}});
    for (const stage of STAGES) {
      const on = state.stage === stage.level;
      stages.append(el('button', {className: `sp-stage${on ? ' is-on' : ''}`, attrs: {type: 'button', role: 'radio', 'aria-checked': String(on), 'data-scam-stage': String(stage.level)},
        on: {click: () => { state.stage = stage.level; render(); root.querySelector(`[data-scam-stage="${stage.level}"]`)?.focus(); }}},
      icon(stage.icon), el('span', {text: stage.label})));
    }
    return el('div', {className: 'sp-follow', attrs: {'data-scam-follow': ''}},
      el('div', {}, el('p', {className: 'sp-q', attrs: {id: 'scam-q1'}}, el('span', {text: '어느 기기에서 그랬나요?'}), el('small', {text: '모르면 건너뛰어도 돼요.'})), devices),
      el('div', {}, el('p', {className: 'sp-q', attrs: {id: 'scam-q2'}}, el('span', {text: '어디까지 했나요?'}), el('small', {text: '가장 많이 진행한 단계 하나를 골라 주세요.'})), stages,
        state.stage ? null : el('p', {className: 'sp-help', text: '진행 단계를 고르면 더 정확히 안내해 드려요. 고르지 않으면 ‘링크나 파일을 열었어요’로 확인해요.'})));
  }

  function textPanel(refs) {
    const textarea = el('textarea', {className: 'sp-ta', attrs: {id: 'scam-text', maxlength: String(maxTextLength), placeholder: '받은 내용을 그대로 붙여넣어 주세요.', rows: '6', 'data-scam-text': ''}});
    textarea.value = state.text;
    const count = el('span', {className: 'sp-count'});
    const field = el('div', {className: 'sp-field'}, textarea,
      el('div', {className: 'sp-ta-foot'}, button('붙여넣기', {iconName: 'paste', extra: 'sp-btn-s', attrs: {'data-scam-paste': ''}, onClick: () => void paste()}), count));
    const message = el('p', {className: 'sp-msg', attrs: {'data-scam-field-message': ''}, hidden: true});
    const sync = () => {
      count.textContent = `${state.text.length.toLocaleString('ko-KR')} / 20,000자`;
      field.classList.toggle('is-focus', Boolean(state.text));
      updateSubmitState();
    };
    textarea.addEventListener('input', () => { state.text = textarea.value; state.fieldError = ''; message.hidden = true; sync(); });
    refs.message = message;
    queueMicrotask(() => { sync(); if (state.fieldError) showFieldMessage(state.fieldError); });
    async function paste() {
      try {
        const value = await globalThis.navigator?.clipboard?.readText?.();
        if (typeof value !== 'string') throw new Error('CLIPBOARD_UNAVAILABLE');
        textarea.value = value.slice(0, maxTextLength);
        textarea.dispatchEvent(new Event('input', {bubbles: true}));
        textarea.focus();
      } catch {
        showFieldMessage('브라우저에서 붙여넣기를 허용하지 않았어요. 입력란을 길게 눌러 붙여넣어 주세요.');
        textarea.focus();
      }
    }
    return [el('label', {className: 'sp-lbl', text: '받은 문자나 이메일 내용', attrs: {for: 'scam-text'}}), field, message,
      el('p', {className: 'sp-help'}, icon('lock', 'sp-ic-s'), el('span', {text: '주민등록번호·카드번호·비밀번호가 보이면 지우고 넣어 주세요.'}))];
  }

  function urlPanel(refs) {
    const input = el('input', {className: 'sp-url', attrs: {id: 'scam-url', type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://example.com', 'data-scam-url': ''}});
    input.value = state.url;
    const field = el('div', {className: 'sp-field sp-inp'}, icon('link'), input);
    const message = el('p', {className: 'sp-msg', attrs: {'data-scam-field-message': ''}, hidden: true});
    const help = el('p', {className: 'sp-help'}, icon('info', 'sp-ic-s'), el('span', {text: '문자나 메일 속 주소를 길게 눌러 복사한 뒤 붙여넣어 주세요. 주소는 내 기기에서 열지 않고 확인해요.'}));
    const sync = () => {
      const value = state.url.trim();
      const invalid = Boolean(value) && !urlIsValid(value);
      field.classList.toggle('is-warn', invalid);
      field.classList.toggle('is-focus', Boolean(value) && !invalid);
      input.setAttribute('aria-invalid', String(invalid));
      if (invalid) showFieldMessage('http:// 또는 https://로 시작하는 전체 주소를 넣어 주세요.');
      else if (!state.fieldError) message.hidden = true;
      help.hidden = invalid;
      updateSubmitState();
    };
    input.addEventListener('input', () => { state.url = input.value; state.fieldError = ''; sync(); });
    refs.message = message;
    queueMicrotask(() => { sync(); if (state.fieldError) showFieldMessage(state.fieldError); });
    return [el('label', {className: 'sp-lbl', text: '의심되는 인터넷 주소', attrs: {for: 'scam-url'}}), field, message, help];
  }

  function filePanel(refs) {
    // PHOTO-INPUT-NO-CAMCORDER-01 — 사진·스크린샷 is a photo picker (image/*, no
    // capture), 카메라로 찍기 opens the camera, 문서·PDF keeps document types.
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.dataset.scamFile = 'photo';
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file';
    cameraInput.accept = 'image/jpeg,image/png,image/webp';
    cameraInput.setAttribute('capture', 'environment');
    cameraInput.dataset.scamFile = 'camera';
    const documentInput = document.createElement('input');
    documentInput.type = 'file';
    documentInput.accept = '.txt,text/plain,.html,.htm,text/html,application/pdf';
    documentInput.dataset.scamFile = 'document';
    const pickers = {photo: photoInput, camera: cameraInput, document: documentInput};
    for (const [kind, input] of Object.entries(pickers)) {
      input.className = 'sp-file-input';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) chooseFile(file, kind);
      });
    }
    const open = kind => () => pickers[kind].click();
    const nodes = [...Object.values(pickers)];
    const message = el('p', {className: 'sp-msg', attrs: {'data-scam-field-message': ''}, hidden: true});
    refs.message = message;
    const file = state.file;
    if (!file) {
      const camera = el('button', {className: 'sp-pick', attrs: {type: 'button', 'data-scam-pick': 'camera'}, on: {click: open('camera')}, hidden: true}, icon('camera'), el('span', {text: '카메라로 찍기'}));
      void updateCameraVisibility(camera);
      nodes.push(el('div', {className: 'sp-drop'},
        el('span', {className: 'sp-drop-ic'}, icon('files', 'sp-ic-xl')),
        el('p', {className: 'sp-drop-t', text: '확인할 사진이나 파일을 골라 주세요'}),
        el('p', {className: 'sp-drop-d', text: '문자 화면을 찍은 사진이나 받은 첨부 파일을 그대로 올리면 돼요.'}),
        el('div', {className: 'sp-picks'},
          el('button', {className: 'sp-pick', attrs: {type: 'button', 'data-scam-pick': 'photo'}, on: {click: open('photo')}}, icon('image'), el('span', {text: '사진·스크린샷 고르기'})),
          el('button', {className: 'sp-pick', attrs: {type: 'button', 'data-scam-pick': 'document'}, on: {click: open('document')}}, icon('file'), el('span', {text: '문서·PDF 고르기'})),
          camera),
        el('div', {className: 'sp-spec'},
          el('span', {}, icon('image', 'sp-ic-s'), el('span', {text: '사진 JPG·PNG·WEBP'})),
          el('span', {}, icon('file', 'sp-ic-s'), el('span', {text: '문서 PDF·TXT·HTML'})),
          el('span', {text: '1개 · 10MB까지'}))));
      nodes.push(el('p', {className: 'sp-help sp-touch-only', attrs: {'data-scam-picker-hint': ''}}, icon('info', 'sp-ic-s'), el('span', {text: '고르는 창에 카메라가 함께 보이면 ‘파일’(iPhone은 ‘사진 보관함’)을 눌러 사진을 골라 주세요.'})));
      nodes.push(message);
      nodes.push(el('p', {className: 'sp-help'}, icon('lock', 'sp-ic-s'), el('span', {text: '‘의심 신호 확인하기’를 누르기 전에는 보내지 않아요. 파일은 실행하지 않고 확인해요.'})));
      return nodes;
    }
    const bad = Boolean(state.fileError);
    const isPhoto = previewImageTypes.has(String(file.type || '').toLowerCase());
    releasePreview();
    let thumb;
    if (isPhoto && !bad && typeof URL?.createObjectURL === 'function') {
      previewUrl = URL.createObjectURL(file);
      thumb = el('img', {className: 'sp-thumb', attrs: {src: previewUrl, alt: '선택한 사진 미리보기', 'data-scam-preview': ''}});
    } else {
      thumb = el('span', {className: `sp-docic${bad ? ' is-warn' : ''}`}, icon('file', 'sp-ic-l'));
    }
    const pickerKind = state.fileKind && pickers[state.fileKind] ? state.fileKind : 'photo';
    nodes.push(el('div', {className: `sp-filecard${bad ? ' is-warn' : ''}`, attrs: {'data-scam-file-card': ''}},
      thumb,
      el('div', {className: 'sp-grow'}, el('p', {className: 'sp-fname', text: file.name, attrs: {'data-scam-file-name': ''}}), el('p', {className: 'sp-fmeta', text: `${fileKindLabel(file)} · ${formatBytes(file.size)}`})),
      el('div', {className: 'sp-fileacts'},
        button(bad ? '다른 파일 고르기' : '다시 고르기', {iconName: 'refresh', extra: 'sp-btn-s', attrs: {'data-scam-reselect': ''}, onClick: open(pickerKind)}),
        // Back to the three pickers, so a photo can be swapped for a document.
        button('지우기', {iconName: 'x', extra: 'sp-btn-s', attrs: {'data-scam-remove': '', 'aria-label': '선택한 파일 지우기'}, onClick: clearFile}))));
    if (bad) {
      nodes.push(message);
      queueMicrotask(() => showFieldMessage(state.fileError));
      return nodes;
    }
    nodes.push(el('p', {className: 'sp-ask'}, icon('okc'), el('span', {text: isPhoto ? '선택한 사진을 LOTBI가 확인할까요?' : '선택한 문서를 LOTBI가 확인할까요?'})));
    if (!isPhoto) nodes.push(el('p', {className: 'sp-help', attrs: {'data-scam-doc-note': ''}}, icon('shield', 'sp-ic-s'), el('span', {text: '문서·HTML은 열거나 미리 보지 않고 이름·형식·크기만 보여 줘요.'})));
    nodes.push(message);
    return nodes;
  }

  function clearFile() {
    releasePreview();
    Object.assign(state, {file: null, fileKind: '', fileError: ''});
    render();
    focusPanel();
    announce('선택한 파일을 지웠어요. 다시 골라 주세요.');
  }

  function chooseFile(file, kind) {
    state.file = file;
    state.fileKind = kind;
    state.fileError = '';
    if (!fileIsSupported(file)) state.fileError = UNSUPPORTED_FILE;
    else if (file.size > maxFileBytes) state.fileError = `${FILE_TOO_LARGE} 지금 고른 파일은 ${formatBytes(file.size)}예요.`;
    else if (file.size <= 0) state.fileError = FILE_TOO_LARGE;
    render();
    announce(state.fileError || '새 파일을 선택했어요. 의심 신호 확인하기를 눌러 주세요.');
  }

  async function updateCameraVisibility(camera) {
    if (isMobileDevice()) { camera.hidden = false; return; }
    try {
      const devices = await globalThis.navigator?.mediaDevices?.enumerateDevices?.();
      camera.hidden = !(Array.isArray(devices) && devices.some(device => device?.kind === 'videoinput'));
    } catch {
      camera.hidden = true;
    }
  }

  function showFieldMessage(text) {
    const message = inputRefs?.message || root.querySelector('[data-scam-field-message]');
    if (!message) return;
    message.replaceChildren(icon('alert', 'sp-ic-s'), el('span', {text}));
    message.hidden = false;
  }

  function inputValid() {
    if (state.tab === 'text') return Boolean(state.text.trim());
    if (state.tab === 'url') return urlIsValid(state.url.trim());
    if (state.tab === 'file') return Boolean(state.file && !state.fileError);
    return false;
  }

  function updateSubmitState() {
    if (!inputRefs?.submit) return;
    const valid = inputValid();
    inputRefs.submit.disabled = !valid;
    let hint = '';
    if (!valid) {
      hint = '확인할 내용을 입력해 주세요.';
      if (state.tab === 'url' && state.url.trim()) hint = '주소 형식을 고치면 버튼이 켜져요.';
      if (state.tab === 'file') hint = state.file ? '다른 파일을 골라 주세요.' : '파일을 선택해 주세요.';
    }
    inputRefs.hint.textContent = hint;
    inputRefs.hint.hidden = !hint;
  }

  // Focus never scrolls the page: it opens at the top with 대화로 돌아가기 in
  // view. When the page itself just opened (not a tap inside it), a touch
  // screen keeps its keyboard down: nothing is focused there.
  function focusPanel({opened = false} = {}) {
    if (opened && globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches) return;
    queueMicrotask(() => (root.querySelector('#scam-text') || root.querySelector('#scam-url') || root.querySelector('[data-scam-pick="photo"]'))?.focus({preventScroll: true}));
  }

  function targetLabel() {
    if (state.tab === 'url') {
      const value = state.url.trim();
      return {kind: '인터넷 주소', icon: 'link', target: hostOf(value) || value.slice(0, 80) || '인터넷 주소', url: value};
    }
    if (state.tab === 'file') {
      const photo = String(state.file?.type || '').startsWith('image/');
      return {kind: photo ? '사진' : '문서', icon: photo ? 'image' : 'file', target: state.file?.name || (photo ? '사진' : '문서'), url: ''};
    }
    const value = state.text.replace(/\s+/g, ' ').trim();
    return {kind: '문자·이메일', icon: 'msg', target: value.length > 48 ? `${value.slice(0, 48)}…` : value || '문자·이메일', url: ''};
  }

  function buildForm() {
    const data = new FormData();
    if (state.tab === 'text') data.set('text', state.text.trim());
    if (state.tab === 'url') data.set('url', state.url.trim());
    if (state.tab === 'file' && state.file) data.set('file', state.file);
    if (state.incident === 'yes') {
      data.set('incident_level', String(state.stage || 1));
      data.set('device', state.device);
    }
    return data;
  }

  async function submitAnalysis(reuse = false) {
    if (!reuse && !inputValid()) { updateSubmitState(); return; }
    const data = reuse && state.lastForm ? state.lastForm : buildForm();
    state.lastForm = data;
    if (!reuse) state.context = {...targetLabel(), incident: state.incident === 'yes', device: state.device, stage: state.stage || (state.incident === 'yes' ? 1 : 0)};
    const id = ++request;
    state.phase = 'loading';
    render(); toTop();
    try {
      const payload = await requestAnalysis(data);
      if (disposed || id !== request) return;
      state.result = payload;
      Object.assign(state, {moreDo: false, moreIncident: false, contactsOpen: false, open: {sig: true}, phase: 'result'});
      render(); toTop();
      announce(payload?.riskLevel === 'UNVERIFIED' ? '진짜라고 확인되지 않았어요. 아래 내용을 꼭 확인해 주세요.' : '분석 결과가 나왔습니다.');
    } catch (error) {
      if (disposed || id !== request) return;
      handleFailure(error);
    }
  }

  function handleFailure(error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    const message = error instanceof Error && error.message ? error.message : '사기·피싱 확인을 완료하지 못했습니다.';
    if (code === 'PLAN_USAGE_LIMIT_REACHED' && error?.basicProtection?.available === true) {
      state.limitActions = [...(error.basicProtection.nextSafeAction || [])];
      state.phase = 'limit'; render(); toTop();
      announce('기본 안전수칙은 계속 볼 수 있어요.');
      return;
    }
    if (code === 'SCAM_SHIELD_SESSION_REQUIRED' || error?.status === 401 || error?.status === 403) {
      state.phase = 'login'; render(); toTop();
      return;
    }
    if (/^SCAM_(ARTIFACT|IMAGE|TEXT|URL|OCR_HINT)_/.test(code) || code === 'SCAM_INPUT_REQUIRED') {
      state.phase = 'input';
      if (state.tab === 'file') state.fileError = message; else state.fieldError = message;
      render(); toTop();
      announce(message);
      return;
    }
    state.failure = {network: code === 'SCAM_SHIELD_NETWORK_ERROR', message};
    state.phase = 'failure'; render(); toTop();
    announce(message);
  }

  function viewLoading() {
    const context = state.context || targetLabel();
    announce('파일을 실행하지 않고 안전하게 확인하고 있어요.');
    return [intro(), layout(el('section', {className: 'sp-card sp-state', attrs: {'aria-busy': 'true', 'data-scam-loading': ''}},
      el('span', {className: 'sp-spin', attrs: {'aria-hidden': 'true'}}),
      el('h3', {className: 'sp-state-t', text: '확인하고 있어요'}),
      el('p', {className: 'sp-state-d', text: '파일을 실행하지 않고 안전하게 확인하고 있어요. 두 번 확인한 뒤 결과를 알려드려요.'}),
      el('div', {className: 'sp-bar', attrs: {'aria-hidden': 'true'}}, el('i')),
      el('p', {className: 'sp-keep'}, icon(context.icon, 'sp-ic-s'), el('span', {text: `${context.kind} · ${context.target}`})),
      el('p', {className: 'sp-help sp-center', text: '결과가 나올 때까지 이 화면에 머물러 주세요.'})))];
  }

  function viewFailure() {
    const failure = state.failure || {network: false, message: '사기·피싱 확인을 완료하지 못했습니다.'};
    const retry = button('다시 시도', {kind: 'pri', iconName: 'refresh', attrs: {'data-scam-retry': ''}, onClick: () => void submitAnalysis(true)});
    const edit = button('내용 고치기', {iconName: 'edit', attrs: {'data-scam-edit': ''}, onClick: () => { state.phase = 'input'; render(); toTop(); focusPanel(); }});
    queueMicrotask(() => { if (retry.isConnected) retry.focus(); });
    return [intro(), layout(el('section', {className: 'sp-card sp-state', attrs: {role: 'alert', 'data-scam-failure': failure.network ? 'network' : 'analysis'}},
      el('span', {className: 'sp-state-ic'}, icon(failure.network ? 'wifioff' : 'refresh', 'sp-ic-xl')),
      el('h3', {className: 'sp-state-t', text: failure.network ? '인터넷 연결을 확인해 주세요' : '확인을 끝내지 못했어요'}),
      el('p', {className: 'sp-state-d', text: failure.network ? '사기·피싱 확인 서버에 접속하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.' : failure.message}),
      el('p', {className: 'sp-keep'}, icon('okc', 'sp-ic-s'), el('span', {text: '입력한 내용은 그대로 남아 있어요'})),
      safeList('그전까지 지켜 주세요', ['확인하지 못한 자료는 안전하다고 볼 수 없어요.', '링크를 열거나 답장하지 마세요.']),
      el('div', {className: 'sp-state-acts'}, retry, edit)))];
  }

  function viewLimit() {
    const link = el('a', {className: 'sp-btn sp-btn-sec', attrs: {href: 'https://account.lotbiai.com/account', 'data-scam-usage-link': ''}}, icon('ext', 'sp-ic-s'), el('span', {text: '구독 및 사용량 보기'}));
    return [intro(), layout(el('section', {className: 'sp-card sp-state', attrs: {'data-scam-limit': ''}},
      el('span', {className: 'sp-state-ic sp-warn'}, icon('alert', 'sp-ic-xl')),
      el('h3', {className: 'sp-state-t', text: '이번 달 심층분석 사용량을 모두 사용했어요'}),
      el('p', {className: 'sp-state-d', text: '분석하지 못한 자료는 안전하다고 볼 수 없어요. 아래 기본 안전수칙을 먼저 지켜 주세요.'}),
      state.limitActions.length ? safeList('지금 하실 일', state.limitActions) : null,
      el('div', {className: 'sp-state-acts'}, link)))];
  }

  // ---------- result ----------
  function viewResult() {
    const payload = state.result || {};
    const context = state.context || targetLabel();
    const level = LEVELS[payload.riskLevel] || LEVELS.UNVERIFIED;
    const mobile = isMobile();
    const incident = Boolean(context.incident);
    const stage = STAGES.find(item => item.level === context.stage) || STAGES[0];
    const remote = incident && (stage.level === 4 || stage.level === 5);
    const money = incident && stage.level === 6;
    const danger = level.tone === 'bad';
    const showContacts = incident || danger;
    const nodes = [el('div', {className: 'sp-rbar'},
      el('h3', {className: 'sp-rtitle', text: '확인 결과'}),
      mobile ? null : button('다른 내용 확인하기', {iconName: 'refresh', extra: 'sp-btn-s', onClick: reset}))];
    if (incident) {
      nodes.push(incidentCard(payload, context, stage, {remote, money, mobile}));
      nodes.push(contactsCard({remote, money, danger, mobile}));
      nodes.push(el('p', {className: 'sp-sect-label'}, icon('list', 'sp-ic-s'), el('b', {text: '내용 분석 결과'}), el('span', {text: '이미 일이 생겼다면 위 안내가 먼저예요.'})));
    }
    const verdict = verdictCard(payload, level, {incident, mobile, contactsNext: !incident && showContacts});
    nodes.push(verdict.card);
    if (!incident && showContacts) nodes.push(contactsCard({remote, money, danger, mobile}));
    if (verdict.notCard) nodes.push(verdict.notCard);
    nodes.push(sections(payload, context, {showContacts}));
    nodes.push(refNote('분석 결과는 참고용이에요. 최종 확인은 공식 기관·공식 서비스에서 직접 해 주세요. 의심 링크는 다시 열거나 답장하지 마세요.'));
    nodes.push(el('div', {className: 'sp-endacts'},
      button('다른 내용 확인하기', {kind: 'pri', iconName: 'refresh', attrs: {'data-scam-reset': ''}, onClick: reset}),
      button('대화로 돌아가기', {iconName: 'chat', onClick: requestClose})));
    return [el('div', {className: 'sp-result', attrs: {'data-scam-result': '', 'data-risk-level': payload.riskLevel || ''}}, ...nodes)];
  }

  function incidentCard(payload, context, stage, {remote, money, mobile}) {
    const actions = Array.isArray(payload.incidentTriage?.actions) ? payload.incidentTriage.actions.filter(item => typeof item === 'string' && item) : [];
    // On a phone the first screen must also reach the 지급정지·신고 buttons:
    // with the other-device warning or the 가장 먼저 line two steps show first.
    const keep = mobile ? (remote || money ? 2 : 3) : actions.length;
    const collapsed = mobile && !state.moreIncident && actions.length > keep;
    const shown = collapsed ? actions.slice(0, keep) : actions;
    const device = DEVICES.find(item => item.value === context.device);
    const deviceLabel = device ? device.label : '기기 선택 안 함';
    const meta = mobile
      ? el('p', {className: 'sp-inc-meta', text: `${deviceLabel} · ${stage.label}`})
      : el('div', {className: 'sp-tags'},
        el('span', {className: 'sp-tag'}, icon(device?.icon || 'phone', 'sp-ic-s'), el('span', {text: deviceLabel})),
        el('span', {className: 'sp-tag'}, icon(stage.icon, 'sp-ic-s'), el('span', {text: stage.label})));
    const payStop = (payload.doNow || []).find(item => typeof item === 'string' && item.includes('지급정지'));
    return el('section', {className: 'sp-card sp-inc', attrs: {'aria-labelledby': 'scam-inc-h', 'data-scam-incident-card': ''}},
      el('div', {className: 'sp-inc-h'}, icon('alert'), el('h3', {text: '이미 눌렀다면 지금 해야 할 일', attrs: {id: 'scam-inc-h'}}), el('span', {className: 'sp-inc-first', text: '분석 결과보다 먼저'})),
      el('div', {className: 'sp-inc-b'},
        meta,
        remote ? el('div', {className: 'sp-otherdev', attrs: {role: 'alert', 'data-scam-other-device': ''}},
          el('span', {className: 'sp-otherdev-ic'}, icon('laptop', 'sp-ic-l')),
          el('div', {}, el('b', {text: '이 기기 말고 다른 안전한 전화기나 PC로 연락하세요'}),
            el('p', {text: mobile
              ? '의심 앱이 설치됐거나 원격제어 중일 수 있어요. 기관 연락·비밀번호 변경·공식 사이트 접속은 다른 기기에서 해 주세요.'
              : '의심 앱이 설치됐거나 원격제어 중일 수 있어요. 공식기관 연락, 비밀번호 변경, 공식 사이트 접속은 감염이 의심되지 않는 다른 기기에서 해 주세요.'}))) : null,
        money && payStop ? el('p', {className: 'sp-firstcall', attrs: {'data-scam-first-call': ''}}, el('span', {className: 'sp-firstcall-k', text: '가장 먼저'}), el('span', {text: payStop})) : null,
        shown.length ? el('ol', {className: 'sp-steps'}, ...shown.map((text, index) => el('li', {}, el('span', {className: 'sp-num', text: String(index + 1), attrs: {'aria-hidden': 'true'}}), el('span', {text})))) : null,
        mobile && actions.length > keep
          ? el('button', {className: 'sp-more', attrs: {type: 'button', 'aria-expanded': String(state.moreIncident)}, on: {click: () => { state.moreIncident = !state.moreIncident; render(); }}},
            el('span', {text: state.moreIncident ? '접기' : `${actions.length - keep}개 더 보기`}), icon('chev', 'sp-ic-s'))
          : null));
  }

  function contactsCard({remote, money, danger, mobile}) {
    let order = ['sos', 'pay', 'emergency', 'kisa', 'ecrm'];
    if (money || danger) order = ['pay', 'sos', 'emergency', 'kisa', 'ecrm'];
    if (remote) order = ['sos', 'kisa', 'emergency', 'pay', 'ecrm'];
    const card = el('section', {className: 'sp-card sp-ctc', attrs: {'aria-labelledby': 'scam-ctc-h', 'data-scam-contacts': ''}},
      // On a phone each button names its use, and the other-device warning sits
      // just above in the incident card, so the heading stands alone there.
      el('div', {className: 'sp-ctc-h'}, el('h3', {text: '공식 신고·상담 창구', attrs: {id: 'scam-ctc-h'}}),
        mobile ? null : el('p', {text: remote ? '감염이 의심되는 이 기기 말고 다른 안전한 전화기나 PC로 연락하세요.' : '용도에 맞는 곳에 연락하세요. 연결 버튼은 미리 확인한 공식 주소만 열어요.'})));
    if (mobile) {
      const tileKeys = remote ? ['sos', 'kisa', 'emergency'] : (money || danger) ? ['pay', 'sos', 'emergency'] : ['sos', 'pay', 'emergency'];
      card.append(el('div', {className: 'sp-ctiles'}, ...tileKeys.map((key, index) => {
        const tile = TILES[key];
        const children = [el('span', {className: 'sp-ctile-k', text: tile.key}), el('span', {className: 'sp-ctile-u', text: remote ? '다른 전화기로' : tile.sub})];
        const className = `sp-ctile${index === 0 ? ' is-hot' : ''}`;
        if (remote) return el('span', {className, attrs: {'data-scam-tile': key}}, ...children);
        if (tile.tel) return el('a', {className, attrs: {href: `tel:${tile.tel}`, 'data-scam-tile': key}}, ...children);
        return el('button', {className, attrs: {type: 'button', 'data-scam-tile': key, 'aria-expanded': String(state.contactsOpen)}, on: {click: () => { state.contactsOpen = true; render(); }}}, ...children);
      })));
    }
    const list = el('ul', {className: 'sp-ctc-list', hidden: mobile && !state.contactsOpen});
    for (const key of order) {
      const contact = CONTACTS[key];
      const href = scamOfficialUrl(contact.url);
      const actions = el('div', {className: 'sp-ctc-act'});
      if (remote) {
        actions.append(el('span', {className: 'sp-ctc-txt', text: contact.tel ? `다른 전화기로 ${contact.tel}` : href ? '다른 기기에서 주소 직접 입력' : '다른 기기로 연락'}));
      } else {
        if (mobile && contact.tel) actions.append(el('a', {className: 'sp-btn sp-btn-sec sp-btn-s', attrs: {href: `tel:${contact.tel}`}}, icon('call', 'sp-ic-s'), el('span', {text: '전화'})));
        if (href && (!mobile || !contact.tel)) actions.append(el('a', {className: 'sp-btn sp-btn-sec sp-btn-s', attrs: {href, target: '_blank', rel: 'noopener noreferrer'}}, el('span', {text: hostOf(href)}), icon('ext', 'sp-ic-s')));
        if (!mobile && contact.tel && !href) actions.append(el('span', {className: 'sp-ctc-txt', text: `전화 ${contact.tel}`}));
      }
      list.append(el('li', {className: 'sp-ctc-row', attrs: {'data-scam-contact': key}},
        el('span', {className: 'sp-ctc-ic'}, icon(contact.icon)),
        el('div', {className: 'sp-grow'},
          el('p', {className: 'sp-ctc-use', text: contact.use}),
          el('p', {className: 'sp-ctc-main', text: contact.main}),
          el('p', {className: 'sp-ctc-org', text: href ? `${contact.org} · ${hostOf(href)}` : contact.org})),
        actions));
    }
    card.append(list);
    if (mobile) {
      card.append(el('button', {className: 'sp-more', attrs: {type: 'button', 'aria-expanded': String(state.contactsOpen)}, on: {click: () => { state.contactsOpen = !state.contactsOpen; render(); }}},
        el('span', {text: state.contactsOpen ? '접기' : '창구 5곳 자세히 보기 (118·ECRM 포함)'}), icon('chev', 'sp-ic-s')));
    }
    return card;
  }

  function verdictCard(payload, level, {incident, mobile, contactsNext}) {
    const headline = payload.riskLevel === 'UNVERIFIED' ? '지금 정보만으로는 진짜라고 확인할 수 없어요.'
      : (payload.riskLevel === 'HIGH_RISK' || payload.riskLevel === 'CONFIRMED_MALICIOUS') ? '이건 열지 마세요.'
        : payload.riskLevel === 'SUSPICIOUS' ? '조심하세요.' : (payload.headline || '확인한 범위에서는 이상한 점을 찾지 못했어요.');
    let summary = typeof payload.summary === 'string' ? payload.summary : '';
    if (level.tone === 'ok' && !summary.includes('보증')) summary = summary ? `${summary} ${NO_GUARANTEE}` : SAFETY_SENTENCE;
    const doNow = (payload.doNow || []).filter(item => typeof item === 'string' && item && !(incident && CALM_LINES.has(item)));
    // On a phone the 지급정지·신고 buttons follow this list, so it starts shorter.
    const limit = mobile ? (contactsNext ? 2 : 3) : 4;
    const shown = state.moreDo ? doNow : doNow.slice(0, limit);
    const tone = level.tone;
    const doBox = el('div', {className: `sp-box sp-box-${tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'n'}`, attrs: {'data-scam-do-now': ''}},
      el('h4', {className: 'sp-box-h'}, icon('check'), el('span', {text: '지금 하실 일'})),
      el('ol', {className: 'sp-steps'}, ...shown.map((text, index) => el('li', {}, el('span', {className: 'sp-num', text: String(index + 1), attrs: {'aria-hidden': 'true'}}), el('span', {text})))),
      doNow.length > limit ? el('button', {className: 'sp-more', attrs: {type: 'button', 'aria-expanded': String(state.moreDo)}, on: {click: () => { state.moreDo = !state.moreDo; render(); }}},
        el('span', {text: state.moreDo ? '접기' : `${doNow.length - limit}개 더 보기`}), icon('chev', 'sp-ic-s')) : null);
    const doNot = Array.isArray(payload.doNot) ? payload.doNot.filter(item => typeof item === 'string' && item) : [];
    const notBox = doNot.length ? el(mobile ? 'section' : 'div', {className: `sp-box${tone === 'ok' ? ' sp-box-n' : ''}${mobile ? ' sp-card sp-notcard' : ''}`, attrs: {'data-scam-do-not': ''}},
      el('h4', {className: 'sp-box-h'}, icon('x'), el('span', {text: '하지 마세요'})),
      el('ul', {className: 'sp-steps sp-nots'}, ...doNot.map(text => el('li', {}, icon('x', 'sp-ic-s'), el('span', {text}))))) : null;
    const card = el('section', {className: `sp-card sp-verdict sp-t-${tone}`, attrs: {'aria-labelledby': 'scam-vh', 'data-scam-verdict': ''}},
      el('div', {className: 'sp-vtop'},
        el('span', {className: 'sp-vic'}, icon(level.icon, 'sp-ic-xl')),
        el('div', {className: 'sp-grow'},
          el('span', {className: 'sp-lv', attrs: {'data-scam-level': ''}}, icon(level.icon, 'sp-ic-s'), el('span', {text: level.label})),
          el('h3', {className: 'sp-vh', text: headline, attrs: {id: 'scam-vh'}}),
          summary ? el('p', {className: 'sp-vs', text: summary, attrs: {'data-scam-summary': ''}}) : null)),
      payload.doubleCheck?.status === 'FAILED' ? el('p', {className: 'sp-msg', attrs: {'data-scam-double-check-failed': ''}}, icon('alert', 'sp-ic-s'), el('span', {text: DOUBLE_CHECK_FAILED})) : null,
      el('div', {className: 'sp-meter', attrs: {role: 'img', 'aria-label': `위험 수준 ${level.label}`}},
        el('div', {className: `sp-m-ok${level.meter === 1 ? ' is-on' : ''}`}, el('i'), el('span', {text: '확인된 위험 신호 없음'})),
        el('div', {className: `sp-m-warn${level.meter === 2 ? ' is-on' : ''}`}, el('i'), el('span', {text: '주의·확인 필요'})),
        el('div', {className: `sp-m-bad${level.meter === 3 ? ' is-on' : ''}`}, el('i'), el('span', {text: '위험 높음'}))),
      el('div', {className: 'sp-dd'}, doBox, mobile ? null : notBox));
    return {card, notCard: mobile ? notBox : null};
  }

  function sections(payload, context, {showContacts}) {
    const check = payload.doubleCheck || null;
    const confirmed = check && check.status !== 'FAILED' && Array.isArray(check.signals)
      ? [...new Set(check.signals.filter(item => item.severity !== 'INFO' && item.confirmedBy !== 'FIRST_ONLY' && item.label).map(item => item.label))]
      : [];
    const officialSources = Array.isArray(payload.officialSources) ? payload.officialSources : [];
    const selfChecks = Array.isArray(check?.selfChecks) ? check.selfChecks : [];
    const unverified = Array.isArray(payload.unverifiedItems) ? payload.unverifiedItems : [];
    const checkedAt = formatCheckedAt(payload.checkedAt);
    const rows = [];
    // An older Core answer has no second check: say what the first analysis found
    // and never claim a re-check that did not happen.
    rows.push(section('sig', '발견된 위험 신호', check ? '2단계 확인에서 다시 확인한 신호예요' : '분석에서 찾은 근거예요', 'alert', confirmed.length, body => {
      if (confirmed.length) body.append(el('div', {className: 'sp-sig'}, ...confirmed.map(label => el('span', {className: 'sp-sigc'}, icon('alert', 'sp-ic-s'), el('span', {text: label})))));
      else if (check) body.append(el('p', {className: 'sp-lead2', text: check.status === 'FAILED' ? '2단계 확인을 끝내지 못해 다시 확인한 위험 신호가 없어요.' : '다시 확인한 위험 신호는 없어요.'}));
      else if (!payload.reasons?.length) body.append(el('p', {className: 'sp-lead2', text: '찾은 위험 신호가 없어요.'}));
      if (payload.reasons?.length) body.append(bullets(payload.reasons));
    }));
    rows.push(section('off', '공식 근거', '공식 주소 목록·기관 안내와 비교했어요', 'bank', officialSources.length, body => {
      if (check?.officialMessage) body.append(el('p', {className: 'sp-lead2', text: check.officialMessage}));
      if (officialSources.length) body.append(sourceList(officialSources));
      if (!check?.officialMessage && !officialSources.length) body.append(el('p', {className: 'sp-lead2', text: '비교할 공식 근거가 없었어요.'}));
    }));
    rows.push(section('unv', '아직 확인되지 않은 내용', '이 부분은 직접 확인이 필요해요', 'help', unverified.length, body => {
      if (unverified.length) body.append(bullets(unverified));
      else body.append(el('p', {className: 'sp-lead2', text: '이번 검사에서 추가로 남은 기술 항목은 없어요. 발신자·사건 진위까지 확인했다는 뜻은 아니에요.'}));
    }));
    rows.push(section('tech', '상세 분석', '기술 정보 · 필요할 때만 보세요', 'list', 0, body => {
      const kv = [];
      if (check) kv.push(['2단계 확인', check.status === 'FAILED' ? '끝내지 못함' : '완료']);
      if (check?.scamTypes?.length) kv.push(['의심 유형', `${check.scamTypes.join(' · ')} — 추정`]);
      if (kv.length) body.append(keyValues(kv));
      const technical = [...(payload.confirmedFacts || []), ...(payload.evidence || []).map(item => [item.title, item.technicalDetail].filter(Boolean).join(': '))].filter(Boolean);
      if (technical.length) body.append(el('div', {className: 'sp-mono'}, ...technical.map(text => el('div', {text}))));
      if (!kv.length && !technical.length) body.append(el('p', {className: 'sp-lead2', text: '표시할 기술 정보가 없어요.'}));
    }));
    rows.push(section('info', '검사 대상과 검사 시각', [context.kind, checkedAt].filter(Boolean).join(' · '), 'clock', 0, body => {
      const kv = [['검사 대상', `${context.kind} · ${context.target}`]];
      if (context.url) kv.push(['검사한 주소', context.url]);
      if (checkedAt) kv.push(['검사 시각', checkedAt]);
      kv.push(['검사 방식', '파일·문서는 실행하지 않고, 링크는 내 기기에서 열지 않고 확인했어요']);
      body.append(keyValues(kv));
      if (context.url) body.append(note('검사한 주소는 글자로만 보여 주고 링크로 만들지 않아요.'));
    }));
    rows.push(section('self', '추가 확인 방법', '번호·계좌를 직접 조회할 수 있는 공식 서비스', 'search', selfChecks.length, body => {
      if (check?.lookupMessage) body.append(el('p', {className: 'sp-lead2', text: check.lookupMessage}));
      if (selfChecks.length) body.append(sourceList(selfChecks));
      if (!check?.lookupMessage && !selfChecks.length) body.append(el('p', {className: 'sp-lead2', text: '문자 속 번호 말고, 공식 홈페이지나 이미 알고 있는 번호로 직접 확인하세요.'}));
    }));
    if (!showContacts) {
      rows.push(section('rep', '이미 눌렀거나 피해가 생겼다면', '용도별 공식 신고·상담 창구', 'call', 0, body => {
        body.append(el('p', {className: 'sp-lead2', text: '‘이미 눌렀거나 개인정보를 입력했어요’를 고르고 다시 확인하면 기기에 맞는 점검 순서를 맨 위에 보여 드려요.'}));
        body.append(bullets(['송금 피해: 돈을 보낸 금융회사 고객센터에 즉시 지급정지 요청', '보이스피싱·스미싱 통합 신고·상담: 1394 (www.counterscam112.go.kr)', '즉시 출동이 필요한 긴급 상황: 112', '사이버 보안·스미싱 상담: 118 (www.boho.or.kr)', '사이버범죄 온라인 신고: 경찰청 ECRM (ecrm.police.go.kr)']));
        body.append(button('사고 정보 넣고 다시 확인하기', {iconName: 'edit', extra: 'sp-btn-s', attrs: {'data-scam-add-incident': ''}, onClick: () => {
          state.incident = 'yes'; state.phase = 'input'; render();
          queueMicrotask(() => { root.querySelector('[data-scam-step2]')?.scrollIntoView?.({block: 'start'}); root.querySelector('[data-scam-device-group] button')?.focus(); });
        }}));
      }));
    }
    const stats = payload.policeStatistics;
    if (stats) {
      rows.push(section('stats', `참고: 경찰청 ${stats.category} 보이스피싱 통계`, '위험 판단에는 쓰지 않은 배경 자료예요', 'info', 0, body => {
        const parts = [];
        if (stats.cases !== null) parts.push(`발생 ${stats.cases.toLocaleString('ko-KR')}건`);
        if (stats.damage100mKrw !== null) parts.push(`피해액 ${stats.damage100mKrw.toLocaleString('ko-KR')}억원`);
        if (stats.arrested !== null) parts.push(`검거 ${stats.arrested.toLocaleString('ko-KR')}명`);
        body.append(el('p', {className: 'sp-lead2', text: `${stats.baseYear}년 전국 ${stats.category}: ${parts.join(' · ')}`}));
        if (stats.note) body.append(note(stats.note));
        const href = scamOfficialUrl(stats.sourceUrl);
        if (href) body.append(el('a', {className: 'sp-srclink', attrs: {href, target: '_blank', rel: 'noopener noreferrer'}}, el('span', {text: `출처: ${stats.agency} ${stats.title} · ${hostOf(href)}`}), icon('ext', 'sp-ic-s')));
        else if (stats.agency || stats.title) body.append(note(`출처: ${[stats.agency, stats.title].filter(Boolean).join(' ')} (공공데이터포털)`));
      }));
    }
    return el('section', {className: 'sp-card sp-secs', attrs: {'aria-label': '자세히 보기', 'data-scam-sections': ''}}, ...rows);
  }

  function section(id, title, sub, iconName, count, fill) {
    const open = Boolean(state.open[id]);
    const bodyId = `scam-sec-${id}`;
    const head = el('button', {className: 'sp-sec-h', attrs: {type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId},
      on: {click: () => { state.open = {...state.open, [id]: !open}; render(); root.querySelector(`[data-scam-section="${id}"] .sp-sec-h`)?.focus(); }}},
    el('span', {className: 'sp-sec-ic'}, icon(iconName)),
    el('span', {className: 'sp-sec-t'}, el('span', {text: title}), sub ? el('small', {text: sub}) : null),
    count ? el('span', {className: 'sp-cnt', text: String(count)}) : null,
    icon('chev', 'sp-sec-chev'));
    const bodyNode = el('div', {className: 'sp-sec-b', attrs: {id: bodyId}, hidden: !open});
    if (open) fill(bodyNode);
    return el('div', {className: `sp-sec${open ? ' is-open' : ''}`, attrs: {'data-scam-section': id}}, head, bodyNode);
  }

  function bullets(items) { return el('ul', {className: 'sp-bul'}, ...items.map(text => el('li', {text}))); }
  function keyValues(rows) { return el('dl', {className: 'sp-kv'}, ...rows.flatMap(([term, value]) => [el('dt', {text: term}), el('dd', {text: value})])); }
  function note(text) { return el('p', {className: 'sp-note'}, icon('info', 'sp-ic-s'), el('span', {text})); }
  function sourceList(sources) {
    return el('div', {className: 'sp-srcs'}, ...sources.map(source => {
      const href = scamOfficialUrl(source.url);
      const meta = el('div', {className: 'sp-src-m'});
      if (source.checkedAt) meta.append(el('span', {text: `확인한 날 ${source.checkedAt}${source.stale ? ' · 오래된 자료' : ''}`}));
      if (href) meta.append(el('a', {attrs: {href, target: '_blank', rel: 'noopener noreferrer'}}, el('span', {text: `공식 페이지 열기 · ${hostOf(href)}`}), icon('ext', 'sp-ic-s')));
      return el('div', {className: 'sp-src'},
        el('b', {text: `${source.agency} · ${source.title}`}),
        source.statement ? el('p', {text: source.statement}) : null,
        source.relevance ? el('p', {className: 'sp-src-rel', text: source.relevance}) : null,
        meta.childNodes.length ? meta : null);
    }));
  }

  function reset() {
    request += 1;
    releasePreview();
    Object.assign(state, {phase: 'input', tab: 'text', text: '', url: '', file: null, fileKind: '', fileError: '', fieldError: '',
      incident: '', device: '', stage: 0, result: null, context: null, failure: null, moreDo: false, moreIncident: false, contactsOpen: false, open: {sig: true}, lastForm: null});
    render(); toTop(); focusPanel({opened: true});
    announce('확인할 내용을 입력해 주세요.');
  }

  const onMedia = () => { if (state.phase === 'result') render(); };
  mobileQuery?.addEventListener?.('change', onMedia);
  // The session can arrive while this page already shows the login gate (a
  // late bearer on the way back, a silent refresh): the open request then finds
  // the page open, so the gate itself steps on to the form.
  const onSession = event => {
    if (disposed || !(event instanceof CustomEvent) || event.detail?.authenticated !== true) return;
    if (state.phase !== 'login' && state.phase !== 'checking') return;
    state.phase = 'input';
    render();
    focusPanel({opened: true});
    announce('로그인했어요. 확인할 내용을 입력해 주세요.');
  };
  window.addEventListener('lotbi:site-session-state', onSession);

  render();
  void requestSessionAvailability().then(authenticated => {
    if (disposed) return;
    state.phase = authenticated ? 'input' : 'login';
    render();
    if (authenticated) { toTop(); focusPanel({opened: true}); announce('확인할 내용을 입력해 주세요.'); }
  });

  return {
    dispose() {
      disposed = true;
      request += 1;
      releasePreview();
      mobileQuery?.removeEventListener?.('change', onMedia);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('lotbi:site-session-state', onSession);
    },
  };
}

// After a login started here, the session arriving reopens the page.
window.addEventListener('lotbi:site-session-state', event => {
  if (event instanceof CustomEvent && event.detail?.authenticated === true && shouldReopenAfterLogin()) {
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('lotbi:scam-shield-open-request')));
  }
});
