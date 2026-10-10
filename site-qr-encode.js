// A small QR Code encoder that runs in the page (ISO/IEC 18004): byte mode, error correction
// level M, versions 1-20, the eight masks scored with the standard penalty rules. It exists so
// a QR made from something private (a Wi-Fi password, LIFE-WALLET-WIFI-CARD-01) is drawn on the
// device and never sent anywhere to be drawn. scripts/fixtures/wifi-qr-reference.json holds
// matrices from Python `qrcode` that validate_life_wallet_wifi_card_01 compares module by module.

// Error correction level M, versions 1-20: [EC codewords per block, [blocks, data codewords]...].
const M_BLOCKS = [
  null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]],
  [30, [1, 50], [4, 51]], [22, [6, 36], [2, 37]], [22, [8, 37], [1, 38]], [24, [4, 40], [5, 41]], [24, [5, 41], [5, 42]],
  [28, [7, 45], [3, 46]], [28, [10, 46], [1, 47]], [26, [9, 43], [4, 44]], [26, [3, 44], [11, 45]], [26, [3, 41], [13, 42]],
];
const ALIGNMENT = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
  [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];
export const QR_MAX_VERSION = 20;
const EC_LEVEL_M_BITS = 0; // format information: L=01, M=00, Q=11, H=10

function dataCodewords(version) {
  const [, ...groups] = M_BLOCKS[version];
  return groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);
}

function capacityBits(version) { return dataCodewords(version) * 8; }

function countBits(version) { return version <= 9 ? 8 : 16; }

// Galois field GF(256) with the QR polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let value = 1;
  for (let i = 0; i < 255; i += 1) { EXP[i] = value; LOG[value] = i; value <<= 1; if (value & 0x100) value ^= 0x11d; }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();
const multiply = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) { next[j] ^= poly[j]; next[j + 1] ^= multiply(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}

function remainder(data, degree) {
  const gen = generator(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift(); result.push(0);
    for (let i = 0; i < degree; i += 1) result[i] ^= multiply(gen[i + 1], factor);
  }
  return result;
}

function encodeData(bytes, version) {
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const byte of bytes) push(byte, 8);
  const capacity = capacityBits(version);
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  for (let pad = 0; codewords.length < capacity / 8; pad += 1) codewords.push(pad % 2 ? 0x11 : 0xec);
  return codewords;
}

function interleave(codewords, version) {
  const [ecPerBlock, ...groups] = M_BLOCKS[version];
  const blocks = [];
  let offset = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i += 1) {
      const data = codewords.slice(offset, offset + size); offset += size;
      blocks.push({data, ec: remainder(data, ecPerBlock)});
    }
  }
  const out = [];
  const longest = Math.max(...blocks.map(block => block.data.length));
  for (let i = 0; i < longest; i += 1) for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  for (let i = 0; i < ecPerBlock; i += 1) for (const block of blocks) out.push(block.ec[i]);
  return out;
}

function bchFormat(mask) {
  const data = (EC_LEVEL_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersion(version) {
  let rem = version;
  for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  r => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function baseMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({length: size}, () => new Array(size).fill(false));
  const reserved = Array.from({length: size}, () => new Array(size).fill(false));
  const set = (r, c, dark) => { modules[r][c] = dark; reserved[r][c] = true; };
  const finder = (top, left) => {
    for (let dr = -1; dr <= 7; dr += 1) for (let dc = -1; dc <= 7; dc += 1) {
      const r = top + dr; const c = left + dc;
      if (r < 0 || c < 0 || r >= size || c >= size) continue;
      const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
      set(r, c, ring !== 2 && ring !== 4);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const centers = ALIGNMENT[version];
  for (const r of centers) for (const c of centers) {
    if ((r === 6 && c === 6) || (r === 6 && c === centers.at(-1)) || (r === centers.at(-1) && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  // Format areas (filled per mask) and the dark module.
  for (let i = 0; i < 9; i += 1) { reserved[8][i] = true; reserved[i][8] = true; }
  for (let i = 0; i < 8; i += 1) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
  set(size - 8, 8, true);
  if (version >= 7) {
    const bits = bchVersion(version);
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      set(b, a, dark); set(a, b, dark);
    }
  }
  return {size, modules, reserved};
}

function placeData(base, codewords, remainderBits) {
  const {size, modules, reserved} = base;
  const bits = [];
  for (const byte of codewords) for (let i = 7; i >= 0; i -= 1) bits.push((byte >>> i) & 1);
  for (let i = 0; i < remainderBits; i += 1) bits.push(0);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (reserved[r][c]) continue;
        modules[r][c] = index < bits.length ? bits[index] === 1 : false;
        index += 1;
      }
    }
  }
}

function applyFormat(matrix, mask) {
  const {size, modules} = matrix;
  const bits = bchFormat(mask);
  const bit = i => ((bits >>> i) & 1) === 1;
  // modules[row][column]. First copy around the top-left finder, second split between the
  // top-right (row 8) and bottom-left (column 8) finders.
  for (let i = 0; i <= 5; i += 1) modules[i][8] = bit(i);
  modules[7][8] = bit(6); modules[8][8] = bit(7); modules[8][7] = bit(8);
  for (let i = 9; i < 15; i += 1) modules[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = bit(i);
  modules[size - 8][8] = true;
}

function penalty(modules) {
  const size = modules.length;
  let score = 0;
  const runs = line => {
    let total = 0; let run = 1;
    for (let i = 1; i <= line.length; i += 1) {
      if (i < line.length && line[i] === line[i - 1]) { run += 1; continue; }
      if (run >= 5) total += 3 + (run - 5);
      run = 1;
    }
    return total;
  };
  const pattern = [true, false, true, true, true, false, true];
  const finderLike = line => {
    let total = 0;
    for (let i = 0; i + 7 <= line.length; i += 1) {
      if (!pattern.every((dark, k) => line[i + k] === dark)) continue;
      const before = i >= 4 && line.slice(i - 4, i).every(dark => !dark);
      const after = i + 11 <= line.length && line.slice(i + 7, i + 11).every(dark => !dark);
      if (before) total += 40;
      if (after) total += 40;
    }
    return total;
  };
  const columns = Array.from({length: size}, (_, c) => modules.map(row => row[c]));
  for (const line of [...modules, ...columns]) score += runs(line) + finderLike(line);
  for (let r = 0; r < size - 1; r += 1) for (let c = 0; c < size - 1; c += 1) {
    const v = modules[r][c];
    if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
  }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

function remainderBits(version) {
  if (version === 1 || (version >= 7 && version <= 13)) return 0;
  if (version <= 6) return 7;
  return 3;
}

/**
 * Encode text (UTF-8) or bytes. Returns {version, mask, size, modules: boolean[][]}.
 * `version` and `mask` may be fixed (the reference test does); otherwise the smallest version
 * that fits and the mask with the lowest penalty are chosen.
 */
export function encodeQr(input, {version: fixedVersion = 0, mask: fixedMask = -1} = {}) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : Uint8Array.from(input);
  let version = fixedVersion;
  if (!version) {
    for (let v = 1; v <= QR_MAX_VERSION; v += 1) {
      if (4 + countBits(v) + bytes.length * 8 <= capacityBits(v)) { version = v; break; }
    }
  }
  if (!version || version > QR_MAX_VERSION || 4 + countBits(version) + bytes.length * 8 > capacityBits(version)) {
    throw Object.assign(new Error('QR코드에 담기에는 내용이 너무 깁니다.'), {code: 'QR_TOO_LONG'});
  }
  const codewords = interleave(encodeData(bytes, version), version);
  const candidates = fixedMask >= 0 ? [fixedMask] : [0, 1, 2, 3, 4, 5, 6, 7];
  let best = null;
  for (const mask of candidates) {
    const matrix = baseMatrix(version);
    placeData(matrix, codewords, remainderBits(version));
    for (let r = 0; r < matrix.size; r += 1) for (let c = 0; c < matrix.size; c += 1) {
      if (!matrix.reserved[r][c] && MASKS[mask](r, c)) matrix.modules[r][c] = !matrix.modules[r][c];
    }
    applyFormat(matrix, mask);
    const score = candidates.length === 1 ? 0 : penalty(matrix.modules);
    if (!best || score < best.score) best = {score, version, mask, size: matrix.size, modules: matrix.modules};
  }
  return Object.freeze({version: best.version, mask: best.mask, size: best.size, modules: best.modules});
}

/** SVG path data for the dark modules (one unit per module, `border` quiet modules around). */
export function qrPathData(matrix, border = 4) {
  const parts = [];
  matrix.modules.forEach((row, r) => row.forEach((dark, c) => { if (dark) parts.push(`M${c + border} ${r + border}h1v1h-1z`); }));
  return parts.join('');
}

/** An <svg> element (built with DOM calls, no markup strings) for the matrix. */
export function qrSvgElement(matrix, {border = 4, label = 'QR코드', doc = globalThis.document} = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const side = matrix.size + border * 2;
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${side} ${side}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const back = doc.createElementNS(ns, 'rect');
  back.setAttribute('width', String(side)); back.setAttribute('height', String(side)); back.setAttribute('fill', '#ffffff');
  const path = doc.createElementNS(ns, 'path');
  path.setAttribute('d', qrPathData(matrix, border)); path.setAttribute('fill', '#000000');
  svg.append(back, path);
  return svg;
}
