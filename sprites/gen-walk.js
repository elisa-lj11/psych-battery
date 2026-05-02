/**
 * Piskel-equivalent sprite generator.
 * Creates a 4-frame walk-cycle PNG spritesheet (64×24px) for the go_outside
 * activity. Run with:  node sprites/gen-walk.js
 * Outputs:
 *   sprites/walk-outside.png   — the raw spritesheet
 *   sprites/walk-outside.b64   — base64 data URI line, paste into CSS
 *
 * Pixel palette (one char per pixel):
 *   .  transparent
 *   H  hair / head-top  (#3a2c1a)
 *   F  face / skin      (#e8b88a)
 *   S  shirt            (#4ade80  = --px-good green)
 *   P  pants            (#2244cc)
 *   K  shoes            (#332211)
 *   A  arm              (#4ade80)
 *
 * Spritestrip layout: [F0 | F1 | F2 | F3]  each 16×24, strip 64×24
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ─── Palette ──────────────────────────────────────────────────────────────────
const PAL = {
  ".": [0, 0, 0, 0],
  H: [58, 44, 26, 255],
  F: [232, 184, 138, 255],
  S: [74, 222, 128, 255],
  P: [34, 68, 180, 255],
  K: [51, 34, 17, 255],
  A: [74, 222, 128, 255],
};

// ─── 4 frames, each 16 wide × 24 tall ─────────────────────────────────────────
// Walk cycle: neutral → left-step → neutral(shifted) → right-step
const FRAMES = [
  // Frame 0 — neutral: arms slightly down, feet level
  [
    "....HHHH........",
    "...HHHHHH.......",
    "...HFFFFF H.....",
    "...HFFFFFH......",
    "....HFFFH.......",
    "....SSSS........",
    "...SSSSSS.......",
    "...SSSSSS.......",
    "...ASSSSA.......",
    "...ASSSSA.......",
    "....SSSS........",
    ".....PP.........",
    ".....PP.........",
    "....PPPP........",
    "....PP.PP.......",
    "....PP.PP.......",
    "....PP.PP.......",
    "....PP.PP.......",
    "....PP.PP.......",
    "...PPP.PPP......",
    "...KKK.KKK......",
    "..KKKK.KKKK.....",
    "................",
    "................",
  ],
  // Frame 1 — left foot forward, right foot back, left arm back, right arm fwd
  [
    "....HHHH........",
    "...HHHHHH.......",
    "...HFFFFFH......",
    "...HFFFFFH......",
    "....HFFFH.......",
    "....SSSS........",
    "...SSSSSS.......",
    "...SSSSSS.......",
    "..ASSSSSA.......",
    "..ASSSSSA.......",
    "....SSSS........",
    ".....PP.........",
    "....PP.PP.......",
    "...PP...PP......",
    "..PP.....PP.....",
    ".PP......PP.....",
    "PP.......PP.....",
    ".PP.......PP....",
    "..PP.......PP...",
    "...KK.......KK..",
    "..KKK.......KKK.",
    ".KKKK.......KKKK",
    "................",
    "................",
  ],
  // Frame 2 — neutral (head bobs 1px down vs frame 0)
  [
    "................",
    "....HHHH........",
    "...HHHHHH.......",
    "...HFFFFFH......",
    "...HFFFFFH......",
    "....HFFFH.......",
    "....SSSS........",
    "...SSSSSS.......",
    "...ASSSSA.......",
    "...ASSSSA.......",
    "....SSSS........",
    ".....PP.........",
    ".....PP.........",
    "....PPPP........",
    "....PP.PP.......",
    "....PP.PP.......",
    "....PP.PP.......",
    "....PP.PP.......",
    "...PPP.PPP......",
    "..PPPP.PPPP.....",
    "...KKK.KKK......",
    "..KKKK.KKKK.....",
    "................",
    "................",
  ],
  // Frame 3 — right foot forward, left foot back (mirror of frame 1)
  [
    "....HHHH........",
    "...HHHHHH.......",
    "...HFFFFFH......",
    "...HFFFFFH......",
    "....HFFFH.......",
    "....SSSS........",
    "...SSSSSS.......",
    "...SSSSSS.......",
    "...SSSSSAA......",
    "...SSSSSAA......",
    "....SSSS........",
    ".....PP.........",
    "....PP.PP.......",
    "...PP...PP......",
    "..PP.....PP.....",
    ".PP......PP.....",
    "PP.......PP.....",
    ".PP.......PP....",
    "..PP.......PP...",
    "...KK.......KK..",
    "..KKK.......KKK.",
    ".KKKK.......KKKK",
    "................",
    "................",
  ],
];

const FW = 16;
const FH = 24;
const NF = 4;
const W = FW * NF; // 64
const H = FH; // 24

// ─── Build raw RGBA pixel buffer ───────────────────────────────────────────────
const rgba = new Uint8Array(W * H * 4);
for (let f = 0; f < NF; f++) {
  const frame = FRAMES[f];
  for (let row = 0; row < FH; row++) {
    const rowStr = frame[row] || "";
    for (let col = 0; col < FW; col++) {
      const ch = rowStr[col] || ".";
      const color = PAL[ch] || PAL["."];
      const idx = (row * W + (f * FW + col)) * 4;
      rgba[idx + 0] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }
}

// ─── Minimal PNG encoder (pure Node.js, no deps) ──────────────────────────────
function encodePNG(width, height, rgbaData) {
  function crc32(buf) {
    let crc = -1;
    for (const b of buf) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.concat([typeBytes, data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw image data (filter byte 0 = None per scanline)
  const raw = Buffer.alloc((1 + width * 4) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = rgbaData[src];
      raw[dst + 1] = rgbaData[src + 1];
      raw[dst + 2] = rgbaData[src + 2];
      raw[dst + 3] = rgbaData[src + 3];
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = encodePNG(W, H, rgba);
const outPng = path.join(__dirname, "walk-outside.png");
fs.writeFileSync(outPng, png);
console.log(`wrote ${outPng}  (${png.length} bytes, ${W}×${H})`);

const b64 = `data:image/png;base64,${png.toString("base64")}`;
const outB64 = path.join(__dirname, "walk-outside.b64");
fs.writeFileSync(outB64, b64);
console.log(`wrote ${outB64}  (${b64.length} chars)`);
console.log("\n--- paste into CSS: ---");
console.log(`--sprite-walk-outside: url("${b64}");`);
