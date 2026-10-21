import assert from "node:assert/strict";
import { qrSvg } from "./qr";

// Rodar: npx tsx src/lib/qr.test.ts
const svg = qrSvg("https://exemplo.com.br/c/abcd2345");
assert.match(svg, /^<svg/);
assert.match(svg, /<\/svg>$/);
assert.ok(svg.length > 500);
assert.notEqual(svg, qrSvg("https://exemplo.com.br/c/zzzz2345")); // links diferentes, códigos diferentes
console.log("ok");
