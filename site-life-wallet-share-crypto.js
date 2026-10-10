// LIFE-WALLET-SHARE-01 — sealing one Life Wallet item for one recipient. LOTBI Core relays
// the ciphertext only (app/life_wallet_share.py); it never sees a private key, a content key
// or the item, so neither the server nor a LOTBI operator can open it.
//
//   recipient key  ECDH P-256. The public point (65 bytes, uncompressed, base64url) is
//                  registered with Core; the private key stays on the recipient's device,
//                  kept in the wallet encrypted with the wallet's master key.
//   per item       a one-off ECDH P-256 key → shared secret (32 bytes)
//                  → HKDF-SHA-256 (salt: 16 random bytes, info: the AAD) → AES-256-GCM key
//                  → AES-256-GCM (nonce: 12 random bytes, the AAD) over the item as JSON
//   AAD            "LOTBI_LIFE_WALLET_SHARE_V1|<request id>|<item ref>|<key id>|<binding>",
//                  binding = Core's hash naming the request and both accounts.
// Core's tests (tests/test_life_wallet_share_transfer_01.py) use the same construction.
export const SHARE_TRANSFER_ALGORITHM = 'ECDH-P256-HKDF-SHA256-A256GCM';
const AAD_LABEL = 'LOTBI_LIFE_WALLET_SHARE_V1';
const ITEM_FORMAT = 'LOTBI_LIFE_WALLET_SHARE_ITEM';
const CURVE = {name: 'ECDH', namedCurve: 'P-256'};

function subtle() {
  const host = globalThis.crypto;
  if (!host?.subtle || typeof host.getRandomValues !== 'function') throw new Error('이 브라우저에서는 안전한 공유 암호화를 사용할 수 없습니다.');
  return host.subtle;
}

const utf8 = value => new TextEncoder().encode(value);

export function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function base64UrlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) throw new Error('암호화 데이터 형식이 올바르지 않습니다.');
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function shareAad({requestId, ref, keyId, binding}) {
  for (const part of [requestId, ref, keyId, binding]) {
    if (typeof part !== 'string' || !part || part.includes('|')) throw new Error('공유 정보가 올바르지 않습니다.');
  }
  return `${AAD_LABEL}|${requestId}|${ref}|${keyId}|${binding}`;
}

async function contentKey(privateKey, peerPublicKey, salt, aad, usage) {
  const peer = await subtle().importKey('raw', base64UrlToBytes(peerPublicKey), CURVE, false, []);
  const secret = await subtle().deriveBits({name: 'ECDH', public: peer}, privateKey, 256);
  const material = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({name: 'HKDF', hash: 'SHA-256', salt, info: utf8(aad)}, material, {name: 'AES-GCM', length: 256}, false, [usage]);
}

// The recipient's key pair: the public point to register, the private key (PKCS#8) to keep
// encrypted in the wallet. The caller wipes the PKCS#8 bytes once they are sealed.
export async function generateShareKeyPair() {
  const pair = await subtle().generateKey(CURVE, true, ['deriveBits']);
  const publicKey = bytesToBase64Url(new Uint8Array(await subtle().exportKey('raw', pair.publicKey)));
  const privateKeyPkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  return {publicKey, privateKeyPkcs8};
}

export function importSharePrivateKey(pkcs8) {
  return subtle().importKey('pkcs8', pkcs8, CURVE, false, ['deriveBits']);
}

// What travels: the item itself (its pictures and memo), never the wallet around it.
export function shareItemPayload(card) {
  return {format: ITEM_FORMAT, version: 1, item: {
    name: String(card.name || ''), kind: String(card.kind || 'document'), note: String(card.note || ''),
    frontDataUrl: card.frontDataUrl, backDataUrl: card.backDataUrl || '', ...(card.shape ? {shape: card.shape} : {}),
  }};
}

export async function sealWalletShareItem({recipientPublicKey, keyId, requestId, ref, binding, card}) {
  const aad = shareAad({requestId, ref, keyId, binding});
  const ephemeral = await subtle().generateKey(CURVE, true, ['deriveBits']);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await contentKey(ephemeral.privateKey, recipientPublicKey, salt, aad, 'encrypt');
  const ciphertext = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv: nonce, additionalData: utf8(aad), tagLength: 128}, key, utf8(JSON.stringify(shareItemPayload(card)))));
  return {
    key_id: keyId, algorithm: SHARE_TRANSFER_ALGORITHM,
    ephemeral_public_key: bytesToBase64Url(new Uint8Array(await subtle().exportKey('raw', ephemeral.publicKey))),
    salt: bytesToBase64Url(salt), nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(ciphertext),
    size: ciphertext.length,
  };
}

// Opens what Core hands the recipient (GET …/payload) with the recipient's private key.
export async function openWalletShareItem(privateKey, sealed) {
  if (sealed?.algorithm !== SHARE_TRANSFER_ALGORITHM) throw new Error('지원하지 않는 공유 암호화 형식입니다.');
  const aad = shareAad({requestId: sealed.request_id, ref: sealed.item_ref, keyId: sealed.key_id, binding: sealed.binding});
  const key = await contentKey(privateKey, sealed.ephemeral_public_key, base64UrlToBytes(sealed.salt), aad, 'decrypt');
  let plain;
  try {
    plain = await subtle().decrypt({name: 'AES-GCM', iv: base64UrlToBytes(sealed.nonce), additionalData: utf8(aad), tagLength: 128}, key, base64UrlToBytes(sealed.ciphertext));
  } catch { throw Object.assign(new Error('이 기기에서 열 수 없는 자료입니다.'), {code: 'SHARE_ITEM_UNOPENABLE'}); }
  const payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(plain));
  if (payload?.format !== ITEM_FORMAT || payload?.version !== 1 || !payload.item || typeof payload.item !== 'object') throw new Error('공유 자료 형식이 올바르지 않습니다.');
  return payload.item;
}

// 보안 확인 번호: 12 digits from the SHA-256 of a public key, computed on each device from the
// key itself. When the sharer's screen and the recipient's screen show the same number, the
// item is sealed for the recipient's own device and for no one else.
export async function shareSafetyCode(publicKey) {
  const digest = new Uint8Array(await subtle().digest('SHA-256', base64UrlToBytes(publicKey)));
  let value = 0n;
  for (const byte of digest.subarray(0, 6)) value = (value << 8n) | BigInt(byte);
  const digits = (value % 1_000_000_000_000n).toString().padStart(12, '0');
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
}
