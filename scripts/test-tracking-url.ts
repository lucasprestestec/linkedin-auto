// Confere de onde vêm os links do e-mail (pixel de abertura e descadastro). Sem banco e sem rede.
// Uso: npx tsx scripts/test-tracking-url.ts
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "x".repeat(32);

async function main() {
  const { trackingBase } = await import("../src/lib/trackingUrl");
  const { unsubscribeUrl } = await import("../src/lib/unsubscribe");
  const { openPixelUrl } = await import("../src/lib/email");

  // Sem nenhum endereço: sem rastreio e sem link (o rodapé manda responder).
  delete process.env.TRACKING_URL;
  delete process.env.APP_URL;
  assert.equal(trackingBase(), null);
  assert.equal(openPixelUrl("tok"), null);
  assert.equal(unsubscribeUrl("lead1"), null);

  // Só APP_URL: igual ao comportamento de antes.
  process.env.APP_URL = "https://app.exemplo.com/";
  assert.equal(trackingBase(), "https://app.exemplo.com");
  assert.equal(openPixelUrl("tok"), "https://app.exemplo.com/api/o/tok.gif");
  assert.ok(unsubscribeUrl("lead1")?.startsWith("https://app.exemplo.com/api/u/lead1."));

  // Com TRACKING_URL: os links dos e-mails usam o endereço próprio; o APP_URL fica como está.
  process.env.TRACKING_URL = "https://links.cliente.com/";
  assert.equal(trackingBase(), "https://links.cliente.com");
  assert.equal(openPixelUrl("tok"), "https://links.cliente.com/api/o/tok.gif");
  assert.ok(unsubscribeUrl("lead1")?.startsWith("https://links.cliente.com/api/u/lead1."));
  assert.equal(process.env.APP_URL, "https://app.exemplo.com/");

  // Valor só com espaços não conta como definido.
  process.env.TRACKING_URL = "   ";
  assert.equal(trackingBase(), "https://app.exemplo.com");

  console.log("ok: test-tracking-url");
}

main();
