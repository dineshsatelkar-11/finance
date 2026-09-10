/**
 * Minimal offline QR (byte mode) → SVG data URL.
 * No network / external API. Good enough for UPI pay URIs (~80–120 chars).
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number) {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenerator(ecLen: number) {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number) {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < gen.length - 1; i++) {
      res[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return res;
}

function pickVersion(dataLen: number) {
  const cap = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let v = 1; v <= 10; v++) {
    if (dataLen + 2 <= cap[v]) return v;
  }
  return 10;
}

const ECC_M: Record<number, number> = {
  1: 10, 2: 16, 3: 26, 4: 36, 5: 48, 6: 64, 7: 72, 8: 88, 9: 110, 10: 130,
};

const TOTAL_CW: Record<number, number> = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346,
};

function encodeBytes(text: string, version: number) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const total = TOTAL_CW[version];
  const ecLen = ECC_M[version];
  const dataCw = total - ecLen;
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const maxBits = dataCw * 8;
  const term = Math.min(4, maxBits - bits.length);
  put(0, term);
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    data.push(b);
  }
  const pad = [0xec, 0x11];
  let pi = 0;
  while (data.length < dataCw) {
    data.push(pad[pi % 2]);
    pi++;
  }
  const ec = rsEncode(data.slice(0, dataCw), ecLen);
  return data.slice(0, dataCw).concat(ec);
}

function moduleCount(version: number) {
  return 21 + (version - 1) * 4;
}

function makeMatrix(version: number, codewords: number[]) {
  const n = moduleCount(version);
  const mat: (boolean | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const on =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        mat[rr][cc] = on;
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    if (mat[6][i] === null) mat[6][i] = i % 2 === 0;
    if (mat[i][6] === null) mat[i][6] = i % 2 === 0;
  }
  mat[n - 8][8] = true;

  for (let i = 0; i < 9; i++) {
    if (mat[8][i] === null) mat[8][i] = false;
    if (mat[i][8] === null) mat[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (mat[8][n - 1 - i] === null) mat[8][n - 1 - i] = false;
    if (mat[n - 1 - i][8] === null) mat[n - 1 - i][8] = false;
  }

  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }
  let bi = 0;
  let directionUp = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const row = directionUp ? n - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        if (mat[row][c] !== null) continue;
        const bit = bi < bits.length ? bits[bi++] === 1 : false;
        mat[row][c] = (row + c) % 2 === 0 ? !bit : bit;
      }
    }
    directionUp = !directionUp;
  }

  const formatBits = 0b101010000010010;
  const formatPositions1: [number, number][] = [];
  for (let i = 0; i < 6; i++) formatPositions1.push([i, 8]);
  formatPositions1.push([7, 8], [8, 8], [8, 7]);
  for (let i = 5; i >= 0; i--) formatPositions1.push([8, i]);
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    const [r, c] = formatPositions1[i];
    mat[r][c] = bit;
  }
  for (let i = 0; i < 8; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    mat[8][n - 1 - i] = bit;
  }
  for (let i = 0; i < 7; i++) {
    const bit = ((formatBits >> (6 - i)) & 1) === 1;
    mat[n - 7 + i][8] = bit;
  }

  return mat.map((row) => row.map((v) => !!v));
}

/** Returns an SVG data URL for the QR payload (offline). */
export function qrSvgDataUrl(text: string, sizePx = 240): string {
  const raw = String(text || "").slice(0, 200);
  const version = pickVersion(new TextEncoder().encode(raw).length);
  const codewords = encodeBytes(raw, version);
  const mat = makeMatrix(version, codewords);
  const n = mat.length;
  const quiet = 2;
  const dim = n + quiet * 2;
  let rects = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (mat[r][c]) {
        rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/>` +
    `<g fill="#000">${rects}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
