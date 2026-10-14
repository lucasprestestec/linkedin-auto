// Confere o código assinado do link "não quero mais receber". Sem banco e sem rede.
// Uso: npx tsx scripts/test-unsubscribe.ts
import assert from "node:assert/strict";
import { leadIdFromUnsubscribeToken, unsubscribeUrl } from "../src/lib/unsubscribe";

process.env.SESSION_SECRET = "segredo-de-teste-".repeat(2);
process.env.APP_URL = "https://exemplo.test/";
const url = unsubscribeUrl("lead123");
assert.ok(url?.startsWith("https://exemplo.test/api/u/lead123."));
const token = url!.split("/api/u/")[1];
assert.equal(leadIdFromUnsubscribeToken(token), "lead123");
assert.equal(leadIdFromUnsubscribeToken(token.replace("lead123", "lead124")), null, "outra pessoa");
assert.equal(leadIdFromUnsubscribeToken(token.slice(0, -1) + "x"), null, "assinatura alterada");
assert.equal(leadIdFromUnsubscribeToken("lead123"), null);
assert.equal(leadIdFromUnsubscribeToken(`${token}.extra`), null);
delete process.env.APP_URL;
assert.equal(unsubscribeUrl("lead123"), null, "sem APP_URL, sem link");
console.log("ok: link de descadastro");
