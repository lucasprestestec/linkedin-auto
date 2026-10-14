// Confere os números por canal da campanha. Sem banco e sem IA.
// Uso: npx tsx scripts/test-channel-numbers.ts
import assert from "node:assert/strict";
import { channelNumbers } from "../src/lib/campaignStats";

const msg = (sender: "LEAD" | "AGENT", channel: "EMAIL" | "LINKEDIN" | "WHATSAPP", openCount = 0) => ({ sender, channel, openCount });
const lead = (extra: object) => ({ linkedinConnected: false, invitedAt: null, phone: null, doNotContact: false, messages: [], ...extra });

const n = channelNumbers([
  lead({ messages: [msg("AGENT", "EMAIL", 2), msg("LEAD", "EMAIL")], invitedAt: new Date(), linkedinConnected: true, phone: "5511999999999" }),
  lead({ messages: [msg("AGENT", "EMAIL"), msg("AGENT", "EMAIL", 1)], doNotContact: true }),
  lead({ messages: [msg("AGENT", "LINKEDIN"), msg("LEAD", "LINKEDIN"), msg("LEAD", "WHATSAPP")], invitedAt: new Date(), phone: " " }),
  lead({}),
]);
assert.deepEqual(n.email, { sent: 2, opened: 2, replied: 1, optedOut: 1 });
assert.deepEqual(n.linkedin, { added: 2, accepted: 1, replied: 1 });
assert.deepEqual(n.whatsapp, { have: 1, replied: 1 });
console.log("ok: números por canal");
