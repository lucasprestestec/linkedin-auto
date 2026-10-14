// Confere senha com hash, convite de acesso e sessão individual. Sem banco e sem rede.
// Uso: npx tsx scripts/test-panel-users.ts
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "x".repeat(32);

async function main() {
  const { createUserToken, isValidSessionToken, parseUserToken } = await import("../src/lib/auth");
  const { createInviteToken, fingerprint, hashPassword, readInviteToken, verifyPassword } = await import("../src/lib/panelUsers");

  const phrase = "frase-longa-de-teste";
  const h = hashPassword(phrase);
  assert.ok(h.startsWith("scrypt$"));
  assert.notEqual(h, hashPassword(phrase)); // sal diferente a cada vez
  assert.equal(verifyPassword(phrase, h), true);
  assert.equal(verifyPassword("outra-frase-qualquer", h), false);
  assert.equal(verifyPassword(phrase, null), false);
  assert.equal(verifyPassword(phrase, "lixo"), false);

  // Convite: vale 7 dias e só enquanto a senha não foi escolhida.
  const now = Date.now();
  const invite = createInviteToken("abc123", null, now);
  assert.deepEqual(readInviteToken(invite, now + 1000), { userId: "abc123", fp: fingerprint(null) });
  assert.equal(readInviteToken(invite, now + 8 * 86_400_000), null); // vencido
  assert.equal(readInviteToken(invite.replace("abc123", "zzz999"), now), null); // adulterado
  assert.equal(readInviteToken("lixo", now), null);
  assert.notEqual(fingerprint(null), fingerprint(h)); // depois de escolher a senha, o link antigo não confere mais

  // Sessão individual.
  const tok = createUserToken("abc123", fingerprint(h));
  assert.deepEqual(parseUserToken(tok), { id: "abc123", fp: fingerprint(h) });
  assert.equal(isValidSessionToken(tok), true);
  assert.equal(parseUserToken(tok.slice(0, -1) + "0"), null);
  assert.equal(isValidSessionToken("u.abc123.aaaa.bbbb"), false);
  assert.equal(parseUserToken(createUserToken("abc123", "x").replace("abc123", "outro")), null);

  console.log("ok: acesso individual");
}
main();
