import assert from "node:assert/strict";
import { encodeWav } from "./wav";

// Rodar: npx tsx src/lib/wav.test.ts
const wav = encodeWav(new Float32Array([0, 1, -1, 0.5, 2, -2]), 16000);
const v = new DataView(wav);
const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
assert.equal(wav.byteLength, 44 + 6 * 2);
assert.equal(tag(0), "RIFF");
assert.equal(tag(8), "WAVE");
assert.equal(tag(36), "data");
assert.equal(v.getUint32(4, true), wav.byteLength - 8);
assert.equal(v.getUint32(24, true), 16000);
assert.equal(v.getUint16(22, true), 1); // mono
assert.equal(v.getInt16(44, true), 0);
assert.equal(v.getInt16(46, true), 32767); // 1 -> máximo
assert.equal(v.getInt16(48, true), -32768); // -1 -> mínimo
assert.equal(v.getInt16(52, true), 32767); // acima de 1 é cortado
assert.equal(v.getInt16(54, true), -32768);
console.log("ok");
