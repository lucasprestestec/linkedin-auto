// Teste do aviso instantâneo do Deskcomm (assinatura e leitura do corpo), sem rede: npx tsx scripts/test-deskcomm-webhook.ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { publicMediaUrl } from "../src/lib/whatsappMedia";
import { identityBlock } from "../src/lib/campaigns";
import { contactPhoneOf, conversationIdOf, samePhone, verifyDeskcommSignature } from "../src/lib/deskcommWebhook";

const SECRET = "segredo-de-teste-com-16-ou-mais";
const body = JSON.stringify({ event: "message.received", data: { message_id: "m1", conversation_id: "c1" } });
const delivery = "d-123";
const now = 1_800_000_000;
const sign = (ts: number, b = body, d = delivery, s = SECRET) => `t=${ts},v1=${createHmac("sha256", s).update(`${ts}.${d}.${b}`).digest("hex")}`;

let failed = false;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed = true;
    console.log(`FAIL ${name}\n     ${err instanceof Error ? err.message : err}`);
  }
}

check("assinatura certa passa", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now), delivery }, SECRET, now), true));
check("segredo errado é recusado", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now, body, delivery, "outro-segredo-qualquer-123"), delivery }, SECRET, now), false));
check("corpo alterado é recusado", () => assert.equal(verifyDeskcommSignature(body + " ", { signature: sign(now), delivery }, SECRET, now), false));
check("id de entrega alterado é recusado", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now), delivery: "d-999" }, SECRET, now), false));
check("aviso velho (fora da janela) é recusado", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now - 400), delivery }, SECRET, now), false));
check("aviso de 1 min atrás passa", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now - 60), delivery }, SECRET, now), true));
check("sem segredo configurado recusa tudo", () => assert.equal(verifyDeskcommSignature(body, { signature: sign(now), delivery }, undefined, now), false));
check("sem cabeçalho recusa", () => assert.equal(verifyDeskcommSignature(body, { signature: null, delivery }, SECRET, now), false));
check("assinatura quebrada não derruba", () => {
  assert.equal(verifyDeskcommSignature(body, { signature: "lixo", delivery }, SECRET, now), false);
  assert.equal(verifyDeskcommSignature(body, { signature: `t=${now},v1=zz`, delivery }, SECRET, now), false);
});
check("lê a conversa de message.received", () => assert.equal(conversationIdOf(body), "c1"));
check("ignora outros eventos", () => assert.equal(conversationIdOf(JSON.stringify({ event: "message.failed", data: { conversation_id: "c1" } })), null));
check("ignora corpo inválido ou sem conversa", () => {
  assert.equal(conversationIdOf("não é json"), null);
  assert.equal(conversationIdOf(JSON.stringify({ event: "message.received", data: {} })), null);
});

check("telefone: mesmo número em formatos diferentes", () => {
  assert.equal(samePhone("(15) 99830-0680", "+5515998300680"), true);
  assert.equal(samePhone("5515998300680", "15998300680"), true);
});
check("telefone: números diferentes ou curtos não casam", () => {
  assert.equal(samePhone("(15) 99830-0680", "+5515991462239"), false);
  assert.equal(samePhone("0680", "+5515998300680"), false);
  assert.equal(samePhone(null, "+5515998300680"), false);
});
check("lê o telefone do contato no aviso", () => {
  assert.equal(contactPhoneOf(JSON.stringify({ data: { contact: { phone_number: "+5515998300680" } } })), "+5515998300680");
  assert.equal(contactPhoneOf(JSON.stringify({ data: {} })), null);
  assert.equal(contactPhoneOf("lixo"), null);
});

check("link do arquivo: troca só o endereço", () => {
  const url = "http://localhost:54321/storage/v1/object/sign/media/a.ogg?token=abc.def";
  assert.equal(publicMediaUrl(url, "https://x-y.trycloudflare.com"), "https://x-y.trycloudflare.com/storage/v1/object/sign/media/a.ogg?token=abc.def");
  assert.equal(publicMediaUrl(url, "https://x-y.trycloudflare.com/"), "https://x-y.trycloudflare.com/storage/v1/object/sign/media/a.ogg?token=abc.def");
});
check("link do arquivo: sem base ou base inválida mantém o link", () => {
  const url = "http://localhost:54321/storage/v1/object/sign/media/a.ogg?token=abc";
  assert.equal(publicMediaUrl(url, ""), url);
  assert.equal(publicMediaUrl(url, undefined), url);
  assert.equal(publicMediaUrl(url, "não é url"), url);
});

check("identidade: usa o nome cadastrado e proíbe inventar o resto", () => {
  const b = identityBlock("  Lucas Almeida ") ?? "";
  assert.match(b, /Lucas Almeida/);
  assert.match(b, /Não invente sobrenome, empresa, cargo/);
});
check("identidade: sem nome não há bloco", () => {
  assert.equal(identityBlock(""), null);
  assert.equal(identityBlock("   "), null);
  assert.equal(identityBlock(null), null);
});

process.exit(failed ? 1 : 0);
