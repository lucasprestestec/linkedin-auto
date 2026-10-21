import assert from "node:assert/strict";

// Rodar: npx tsx src/lib/capture.test.ts
async function main() {
  process.env.SESSION_SECRET = "x".repeat(32); // valor só do teste
  const { formToken, formTokenAge, readCapture, newCaptureSlug, isCaptureSlug, MIN_FILL_MS, MAX_FILL_MS } = await import("./capture");

  // carimbo: idade certa, adulterado não vale
  const t0 = 1_800_000_000_000;
  const token = formToken(t0);
  assert.equal(formTokenAge(token, t0 + 5000), 5000);
  assert.equal(formTokenAge(token.replace(/\d/, "9"), t0 + 5000), null);
  assert.equal(formTokenAge("lixo", t0), null);
  assert.equal(formTokenAge(undefined, t0), null);

  const read = (over: Record<string, string> = {}, at = t0 + 10_000) => {
    const f = new FormData();
    const base: Record<string, string> = { name: "Ana Souza Lima", email: "Ana@Empresa.com.br", phone: "(51) 99999-0000", company: "Souza Contabilidade", role: "Sócia", consent: "on", t: token, website: "" };
    for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== "__sem__") f.set(k, v);
    return readCapture(f, at);
  };

  const ok = read();
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.firstName, "Ana");
    assert.equal(ok.data.lastName, "Souza Lima");
    assert.equal(ok.data.email, "ana@empresa.com.br");
    assert.equal(ok.data.phone, "5551999990000");
    assert.equal(ok.data.jobTitle, "Sócia · Souza Contabilidade");
  }
  // só e-mail ou só WhatsApp bastam; nenhum dos dois não
  assert.ok(read({ phone: "" }).ok);
  assert.ok(read({ email: "" }).ok);
  const none = read({ email: "", phone: "" });
  assert.ok(!none.ok && "error" in none);
  // consentimento é obrigatório
  const noConsent = read({ consent: "__sem__" });
  assert.ok(!noConsent.ok && "error" in noConsent);
  // e-mail inválido
  assert.ok(!read({ email: "isso-nao-e-email" }).ok);
  // robô: campo escondido preenchido, rápido demais ou sem carimbo são ignorados em silêncio
  const bot = read({ website: "http://spam.com" });
  assert.ok(!bot.ok && "ignore" in bot);
  const fast = read({}, t0 + MIN_FILL_MS - 1);
  assert.ok(!fast.ok && "ignore" in fast);
  const noToken = read({ t: "__sem__" });
  assert.ok(!noToken.ok && "ignore" in noToken);
  // página aberta há horas pede para recarregar
  const stale = read({}, t0 + MAX_FILL_MS + 1);
  assert.ok(!stale.ok && "error" in stale);

  // slug
  const slug = newCaptureSlug();
  assert.ok(isCaptureSlug(slug) && slug.length === 8);
  assert.ok(!isCaptureSlug("../admin"));
  assert.ok(!isCaptureSlug("ABC"));
  console.log("ok");
}
main();
