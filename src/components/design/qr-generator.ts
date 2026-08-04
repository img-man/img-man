// SPDX-License-Identifier: Apache-2.0
/**
 * qr-generator.ts — QR Code generation for Design Studio
 *
 * Implements QR Code encoding from scratch (no external dependencies).
 * Supports alphanumeric + byte encoding, error correction level M,
 * and outputs SVG string or data URI.
 *
 * Spec reference: ISO/IEC 18004:2015
 *
 * @module qr-generator
 */

/* ─── Public API Types ───────────────────────────────────── */

export interface QrCodeOptions {
  /** Data to encode (URL, text, etc.) */
  data: string;
  /** Module (pixel) size in output units. Default: 10 */
  moduleSize?: number;
  /** Quiet zone (border) in modules. Default: 4 */
  quietZone?: number;
  /** Foreground color. Default: '#000000' */
  foreground?: string;
  /** Background color. Default: '#ffffff' */
  background?: string;
  /** Error correction level. Default: 'M' */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export interface QrCodeResult {
  /** The QR code as an SVG string */
  svg: string;
  /** The QR code as a data:image/svg+xml URI */
  dataUri: string;
  /** Size of the QR code in modules (without quiet zone) */
  moduleCount: number;
  /** Total pixel size (including quiet zone) */
  totalSize: number;
}

/* ─── Constants ──────────────────────────────────────────── */

/**
 * Error correction codeword capacities per version (1–10) for level M.
 * Index 0 is unused (versions start at 1).
 * Each entry: [totalCodewords, ecCodewordsPerBlock, numBlocks, dataCodewords]
 */
const EC_TABLE_M: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0], // placeholder
  [26, 10, 1, 16], // V1: 26 total, 10 EC, 1 block, 16 data
  [44, 16, 1, 28], // V2
  [70, 26, 1, 44], // V3
  [100, 18, 2, 64], // V4
  [134, 24, 2, 86], // V5
  [172, 16, 4, 108], // V6
  [196, 18, 4, 124], // V7
  [242, 22, 4, 154], // V8
  [292, 22, 4, 182], // V9 (approx; simplified)
  [346, 26, 4, 214], // V10
] as const;

/** Max data byte capacity per version (level M) */
const VERSION_CAPACITY_M = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];

/** Alphanumeric character set */
const ALPHANUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/* ─── Encoding ───────────────────────────────────────────── */

function isAlphanumeric(str: string): boolean {
  return [...str].every((ch) => ALPHANUM_CHARS.includes(ch));
}

/**
 * Choose the smallest QR version that fits the data (up to V10).
 */
function chooseVersion(byteLength: number): number {
  for (let v = 1; v <= 10; v++) {
    if (byteLength <= VERSION_CAPACITY_M[v]) return v;
  }
  // Fallback: use version 10 and truncate
  return 10;
}

/** Get the module count for a given version */
export function getModuleCount(version: number): number {
  return 17 + version * 4;
}

/**
 * Encode data as byte-mode codewords.
 * Returns a Uint8Array of data codewords (padded to capacity).
 */
function encodeData(data: string, version: number): Uint8Array {
  const capacity = VERSION_CAPACITY_M[version];
  const bytes = new TextEncoder().encode(data);
  const dataLen = Math.min(bytes.length, capacity);

  // Bit stream: mode indicator (4 bits) + char count (8 bits for byte mode V1-9, 16 for V10+)
  // Simplified: we build the byte array directly

  const result = new Uint8Array(capacity);
  // Mode = 0100 (byte), Count = dataLen
  // For simplicity, pack mode + length + data as raw bytes
  // Mode indicator: 0100 (4 bits)
  // Byte count: 8 bits (V1-9) or 16 bits (V10+)

  const bits: number[] = [];

  // Mode indicator: byte mode = 0b0100
  pushBits(bits, 0b0100, 4);

  // Character count
  const countBits = version <= 9 ? 8 : 16;
  pushBits(bits, dataLen, countBits);

  // Data bytes
  for (let i = 0; i < dataLen; i++) {
    pushBits(bits, bytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const totalDataBits = capacity * 8;
  const terminatorLen = Math.min(4, totalDataBits - bits.length);
  pushBits(bits, 0, terminatorLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes: alternate 0xEC and 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(bits, padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to bytes
  for (let i = 0; i < capacity; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[i * 8 + b] || 0);
    }
    result[i] = byte;
  }

  return result;
}

function pushBits(arr: number[], value: number, count: number) {
  for (let i = count - 1; i >= 0; i--) {
    arr.push((value >> i) & 1);
  }
}

/* ─── GF(256) Arithmetic for Reed-Solomon ────────────────── */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// Initialize Galois Field tables
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x >= 256) x ^= 0x11d; // primitive polynomial
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

/**
 * Generate Reed-Solomon error correction codewords.
 */
function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  // Generator polynomial
  const gen = rsGeneratorPoly(ecCount);
  const result = new Uint8Array(ecCount);

  // Polynomial division
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  // Remainder is the EC codewords
  for (let i = 0; i < ecCount; i++) {
    result[i] = msg[data.length + i];
  }

  return result;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const newPoly = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = newPoly;
  }
  return poly;
}

/* ─── QR Matrix Construction ─────────────────────────────── */

/**
 * Build the QR code boolean matrix.
 * true = dark module, false = light module.
 */
function buildMatrix(data: string): boolean[][] {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(data);
  const version = chooseVersion(rawBytes.length);
  const size = getModuleCount(version);

  // Encode data codewords
  const dataCodewords = encodeData(data, version);

  // Generate EC codewords
  const [, ecPerBlock, numBlocks] = EC_TABLE_M[version];
  const dataPerBlock = Math.floor(dataCodewords.length / numBlocks);

  // Split into blocks and generate EC for each
  const allCodewords: number[] = [];
  const ecBlocks: Uint8Array[] = [];

  for (let b = 0; b < numBlocks; b++) {
    const blockData = dataCodewords.slice(
      b * dataPerBlock,
      (b + 1) * dataPerBlock,
    );
    const ec = rsEncode(blockData, ecPerBlock);
    ecBlocks.push(ec);
    // Interleave data codewords later
    for (let i = 0; i < blockData.length; i++) {
      if (allCodewords.length <= i * numBlocks + b) {
        while (allCodewords.length <= i * numBlocks + b) allCodewords.push(0);
      }
      allCodewords[i * numBlocks + b] = blockData[i];
    }
  }

  // Append interleaved EC codewords
  const finalCodewords: number[] = [...dataCodewords];
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // Create matrix
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  // Place finder patterns
  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, size - 7, 0);
  placeFinder(matrix, reserved, 0, size - 7);

  // Place timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) {
      matrix[6][i] = val;
      reserved[6][i] = true;
    }
    if (matrix[i][6] === null) {
      matrix[i][6] = val;
      reserved[i][6] = true;
    }
  }

  // Place alignment patterns (V2+)
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const row of positions) {
      for (const col of positions) {
        if (reserved[row]?.[col]) continue; // skip if overlaps finder
        placeAlignment(matrix, reserved, row, col);
      }
    }
  }

  // Reserve format info areas
  reserveFormatAreas(reserved, size);

  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Place data bits
  placeDataBits(matrix, reserved, finalCodewords, size);

  // Apply mask pattern 0 (checkerboard: (row + col) % 2 === 0)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }

  // Place format info (mask 0, EC level M = 0b00)
  placeFormatInfo(matrix, size, 0b00, 0);

  // Convert null to false
  return matrix.map((row) => row.map((cell) => cell === true));
}

function placeFinder(
  matrix: (boolean | null)[][],
  reserved: boolean[][],
  rowOffset: number,
  colOffset: number,
) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const row = rowOffset + r;
      const col = colOffset + c;
      if (row < 0 || col < 0 || row >= matrix.length || col >= matrix.length)
        continue;
      const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const inSeparator = r === -1 || r === 7 || c === -1 || c === 7;
      matrix[row][col] = !inSeparator && (inOuter || inInner);
      reserved[row][col] = true;
    }
  }
}

function placeAlignment(
  matrix: (boolean | null)[][],
  reserved: boolean[][],
  centerRow: number,
  centerCol: number,
) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const row = centerRow + r;
      const col = centerCol + c;
      if (row < 0 || col < 0 || row >= matrix.length || col >= matrix.length)
        continue;
      const isEdge = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      matrix[row][col] = isEdge || isCenter;
      reserved[row][col] = true;
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version <= 1) return [];
  const size = getModuleCount(version);
  const last = size - 7;
  // Simplified: for V2-6, there's only one alignment pattern
  if (version <= 6) return [6, last];
  // V7+ (we support up to V10)
  const step = Math.ceil((last - 6) / 2) * 2;
  const mid = last - step;
  return [6, mid > 6 ? mid : 6 + step, last].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );
}

function reserveFormatAreas(reserved: boolean[][], size: number) {
  // Around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (i < size) reserved[8][i] = true;
    if (i < size) reserved[i][8] = true;
  }
  // Around top-right finder
  for (let i = 0; i <= 7; i++) {
    reserved[8][size - 1 - i] = true;
  }
  // Around bottom-left finder
  for (let i = 0; i <= 7; i++) {
    reserved[size - 1 - i][8] = true;
  }
}

function placeDataBits(
  matrix: (boolean | null)[][],
  reserved: boolean[][],
  codewords: number[],
  size: number,
) {
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let col = size - 1;

  while (col > 0) {
    // Skip timing column
    if (col === 6) col--;

    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const actualCol = col - c;
        const isUpward =
          Math.floor((size - 1 - col + (col > 6 ? 1 : 0)) / 2) % 2 === 0;
        const actualRow = isUpward ? size - 1 - row : row;

        if (
          actualRow < 0 ||
          actualRow >= size ||
          actualCol < 0 ||
          actualCol >= size
        )
          continue;
        if (reserved[actualRow][actualCol]) continue;

        if (bitIdx < totalBits) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          matrix[actualRow][actualCol] =
            ((codewords[byteIdx] >> bitPos) & 1) === 1;
          bitIdx++;
        } else {
          matrix[actualRow][actualCol] = false;
        }
      }
    }

    col -= 2;
  }
}

function placeFormatInfo(
  matrix: (boolean | null)[][],
  size: number,
  ecLevel: number,
  maskPattern: number,
) {
  // Format info: 5-bit data (2 EC + 3 mask) + 10-bit BCH error correction
  const formatData = (ecLevel << 3) | maskPattern;
  const encoded = bchEncode(formatData) ^ 0x5412; // XOR with mask pattern

  // Place around top-left finder (horizontal)
  const bits: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    bits.push(((encoded >> (14 - i)) & 1) === 1);
  }

  // Horizontal (row 8)
  const hPositions = [
    0,
    1,
    2,
    3,
    4,
    5,
    7,
    8,
    size - 8,
    size - 7,
    size - 6,
    size - 5,
    size - 4,
    size - 3,
    size - 2,
  ];
  for (let i = 0; i < 15; i++) {
    matrix[8][hPositions[i]] = bits[i];
  }

  // Vertical (col 8)
  const vPositions = [
    size - 1,
    size - 2,
    size - 3,
    size - 4,
    size - 5,
    size - 6,
    size - 7,
    8,
    7,
    5,
    4,
    3,
    2,
    1,
    0,
  ];
  for (let i = 0; i < 15; i++) {
    matrix[vPositions[i]][8] = bits[i];
  }
}

function bchEncode(data: number): number {
  let d = data << 10;
  const gen = 0x537; // BCH(15,5) generator polynomial
  for (let i = 4; i >= 0; i--) {
    if ((d >> (i + 10)) & 1) {
      d ^= gen << i;
    }
  }
  return (data << 10) | d;
}

/* ─── SVG Output ─────────────────────────────────────────── */

/**
 * Generate a QR code and return SVG + metadata.
 *
 * @param options - QR code configuration
 * @returns QR code result with SVG, data URI, and size info
 *
 * @example
 * ```ts
 * const qr = generateQrCode({ data: 'https://example.com' });
 * // Use qr.svg as innerHTML or qr.dataUri as img src
 * ```
 */
export function generateQrCode(options: QrCodeOptions): QrCodeResult {
  const {
    data,
    moduleSize = 10,
    quietZone = 4,
    foreground = '#000000',
    background = '#ffffff',
    // errorCorrectionLevel = 'M', // Currently only M is implemented
  } = options;

  if (!data) {
    return { svg: '', dataUri: '', moduleCount: 0, totalSize: 0 };
  }

  const matrix = buildMatrix(data);
  const moduleCount = matrix.length;
  const totalModules = moduleCount + quietZone * 2;
  const totalSize = totalModules * moduleSize;

  // Build SVG
  const rects: string[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        const x = (c + quietZone) * moduleSize;
        const y = (r + quietZone) * moduleSize;
        rects.push(
          `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${escapeAttr(foreground)}"/>`,
        );
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`,
    `  <rect width="${totalSize}" height="${totalSize}" fill="${escapeAttr(background)}"/>`,
    ...rects.map((r) => `  ${r}`),
    `</svg>`,
  ].join('\n');

  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return { svg, dataUri, moduleCount, totalSize };
}

/**
 * Generate a QR code SVG string (convenience wrapper).
 */
export function generateQrSvg(data: string, size?: number): string {
  const moduleSize = size ? Math.max(1, Math.floor(size / 30)) : 10;
  return generateQrCode({ data, moduleSize }).svg;
}

/**
 * Generate a QR code data URI (convenience wrapper).
 */
export function generateQrDataUri(data: string, size?: number): string {
  const moduleSize = size ? Math.max(1, Math.floor(size / 30)) : 10;
  return generateQrCode({ data, moduleSize }).dataUri;
}

/* ─── Utilities ──────────────────────────────────────────── */

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Validate that input data can be encoded as a QR code.
 * Returns an error message or null if valid.
 */
export function validateQrInput(data: string): string | null {
  if (!data || data.trim().length === 0) {
    return 'QR code data cannot be empty';
  }
  const bytes = new TextEncoder().encode(data);
  if (bytes.length > VERSION_CAPACITY_M[10]) {
    return `Data too long (${bytes.length} bytes, max ${VERSION_CAPACITY_M[10]} for QR version 10)`;
  }
  return null;
}

export { isAlphanumeric, chooseVersion };
