import assert from "node:assert/strict";
import { parseDealStage, parseMoneyCents } from "./deal";

// Rodar: npx tsx src/lib/deal.test.ts
assert.equal(parseMoneyCents("1.500,50"), 150050);
assert.equal(parseMoneyCents("R$ 2000"), 200000);
assert.equal(parseMoneyCents("1500.5"), 150050);
assert.equal(parseMoneyCents(""), null);
assert.equal(parseMoneyCents("abc"), undefined);
assert.equal(parseMoneyCents("-5"), undefined);
assert.equal(parseDealStage("WON"), "WON");
assert.equal(parseDealStage("toString"), null);
console.log("ok");
