import assert from "node:assert/strict";
import { usableChannels } from "./channelPrefs";

// Rodar: npx tsx src/lib/channelPrefs.test.ts
const none = { preferredChannel: null, blockedChannels: [] };
assert.deepEqual(usableChannels(none, ["LINKEDIN", "EMAIL"]), ["LINKEDIN", "EMAIL"]);
assert.deepEqual(usableChannels({ preferredChannel: "EMAIL", blockedChannels: [] }, ["LINKEDIN", "EMAIL", "WHATSAPP"]), ["EMAIL"]);
// preferência indisponível não trava a pessoa
assert.deepEqual(usableChannels({ preferredChannel: "EMAIL", blockedChannels: [] }, ["LINKEDIN"]), ["LINKEDIN"]);
// bloqueado nunca sai, nem como preferido
assert.deepEqual(usableChannels({ preferredChannel: "WHATSAPP", blockedChannels: ["WHATSAPP"] }, ["LINKEDIN", "WHATSAPP"]), ["LINKEDIN"]);
assert.deepEqual(usableChannels({ preferredChannel: null, blockedChannels: ["LINKEDIN", "EMAIL"] }, ["LINKEDIN", "EMAIL"]), []);
console.log("ok");
