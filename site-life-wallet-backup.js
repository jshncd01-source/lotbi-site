import {CORE_ORIGIN} from './site-core.js?v=aset-823fb9fb63c8';

// LIFE-WALLET-ENCRYPTED-BACKUP-01 — the wallet's sealed backup kept on LOTBI Core, so a new
// device or browser can bring the wallet back (like KakaoTalk's backup restore). The wallet
// is sealed in this browser with a key from the owner's backup password (the same format as
// the encrypted backup file: PBKDF2-HMAC-SHA-256, 600,000 rounds, AES-256-GCM, fresh salt and
// nonce); Core receives and returns only that envelope and never the password, the key or
// any item. Describing the backup works for every signed-in session; keeping, fetching and
// deleting it need a FULL session (Core says SESSION_ASSURANCE_INSUFFICIENT otherwise).

export const SERVER_BACKUP_MAX_BYTES = 32 * 1024 * 1024;
export const SERVER_BACKUP_PASSWORD_MIN = 10;
export const SERVER_BACKUP_FORGET_NOTICE = '백업 비밀번호를 잊으면 LOTBI도 백업을 열거나 복구할 수 없습니다.';

const MESSAGES = Object.freeze({
  SESSION_ASSURANCE_INSUFFICIENT: '서버 백업은 보안을 위해 이메일·비밀번호 또는 패스키로 로그인한 상태에서만 이용할 수 있습니다. 그 방법으로 다시 로그인한 뒤 이용해 주세요.',
  SESSION_REQUIRED: '로그인이 필요합니다. 다시 로그인해 주세요.',
  SESSION_INVALID: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  BACKUP_NOT_FOUND: '서버에 저장된 백업이 없습니다.',
  BACKUP_TOO_LARGE: '자료가 많아 서버 백업 용량(32MB)을 넘습니다. ⚙ 설정의 암호화 백업 파일을 이용해 주세요.',
  BACKUP_DOWNLOAD_LIMITED: '오늘 백업을 불러온 횟수가 많습니다. 내일 다시 시도해 주세요.',
  BACKUP_RATE_LIMITED: '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  BACKUP_ENVELOPE_INVALID: '백업 형식이 올바르지 않아 서버에 저장하지 못했습니다.',
});

export class WalletServerBackupError extends Error {
  constructor(code, status = 0) {
    super(MESSAGES[code] || '서버 백업을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    this.name = 'WalletServerBackupError';
    this.code = code;
    this.status = status;
  }
}

function characterClasses(password) {
  return [/[A-Za-z가-힣]/u, /[0-9]/u, /[^A-Za-z0-9가-힣]/u].filter(pattern => pattern.test(password)).length;
}

// A backup kept on a server can be attacked offline if the server is ever breached, so its
// password is held to more than the file backup's 8 characters: 10 or more, at least two of
// letters, digits and symbols, and not a run of one or a few repeated characters.
export function validateServerBackupPassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < SERVER_BACKUP_PASSWORD_MIN || password.length > 128) {
    throw new Error(`백업 비밀번호는 ${SERVER_BACKUP_PASSWORD_MIN}자 이상 128자 이하로 입력해 주세요.`);
  }
  if (characterClasses(password) < 2) throw new Error('백업 비밀번호에는 문자·숫자·기호 중 두 가지 이상을 섞어 주세요.');
  if (new Set(password).size < 5) throw new Error('같은 글자를 반복한 비밀번호는 쓸 수 없습니다. 더 다양한 글자를 섞어 주세요.');
  if (password !== confirmation) throw new Error('두 백업 비밀번호가 일치하지 않습니다.');
  return password;
}

// 약함 / 보통 / 강함, for the meter under the password field.
export function backupPasswordStrength(password) {
  const value = typeof password === 'string' ? password : '';
  const classes = characterClasses(value); const distinct = new Set(value).size;
  if (value.length < SERVER_BACKUP_PASSWORD_MIN || classes < 2 || distinct < 5) return 'weak';
  return value.length >= 14 && classes >= 3 && distinct >= 8 ? 'strong' : 'fair';
}

export function createWalletServerBackup({sessionToken, fetchImpl = globalThis.fetch, maxBytes = SERVER_BACKUP_MAX_BYTES} = {}) {
  const url = path => `${CORE_ORIGIN}/v2/life-wallet/backup${path}`;
  const request = async (path, {method = 'GET', body} = {}) => {
    let response;
    try {
      response = await fetchImpl(url(path), {
        method, mode: 'cors', credentials: 'omit', cache: 'no-store',
        headers: {Authorization: `Bearer ${sessionToken}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
        ...(body === undefined ? {} : {body}),
      });
    } catch {
      throw new WalletServerBackupError('NETWORK');
    }
    if (!response.ok) {
      let codeValue = '';
      try { codeValue = (await response.json())?.detail?.code || ''; } catch { /* no body */ }
      throw new WalletServerBackupError(codeValue || `HTTP_${response.status}`, response.status);
    }
    return response;
  };
  return Object.freeze({
    // {created_at, size_bytes, format, format_version, kdf} or null.
    async describe() { return (await (await request('')).json()).backup || null; },
    // The sealed envelope from vault.exportBackup: only ciphertext and its parameters leave.
    async keep(sealed) {
      if (typeof sealed !== 'string' || new TextEncoder().encode(sealed).length > maxBytes) throw new WalletServerBackupError('BACKUP_TOO_LARGE');
      return (await (await request('', {method: 'PUT', body: sealed})).json()).backup;
    },
    async fetchSealed() { return (await request('/content')).text(); },
    async remove() { await request('', {method: 'DELETE'}); },
  });
}
