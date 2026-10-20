import assert from "node:assert/strict";
import { checkEmailDomain, checkEmailDomains, domainOf, type DnsLookup } from "./emailDomain";

// Rodar: npx tsx src/lib/emailDomain.test.ts
const err = (code: string) => Object.assign(new Error(code), { code });
const dns = (mx: () => Promise<{ exchange: string; priority: number }[]>, a: () => Promise<string[]> = async () => { throw err("ENOTFOUND"); }): DnsLookup => ({ mx, a });

async function main() {
  assert.equal(domainOf("Ana@Empresa.com.br"), "empresa.com.br");
  assert.equal(await checkEmailDomain("x.com", dns(async () => [{ exchange: "mx.x.com", priority: 10 }])), "ok");
  // sem MX mas com registro A: e-mail ainda chega
  assert.equal(await checkEmailDomain("x.com", dns(async () => { throw err("ENODATA"); }, async () => ["1.2.3.4"])), "ok");
  // domínio inexistente
  assert.equal(await checkEmailDomain("gmial.zz", dns(async () => { throw err("ENOTFOUND"); })), "sem_servidor");
  // MX nulo
  assert.equal(await checkEmailDomain("x.com", dns(async () => [{ exchange: ".", priority: 0 }])), "sem_servidor");
  // DNS fora do ar ou lento nunca bloqueia
  assert.equal(await checkEmailDomain("x.com", dns(async () => { throw err("ESERVFAIL"); })), "incerto");
  assert.equal(await checkEmailDomain("x.com", dns(async () => { throw err("ENODATA"); }, async () => { throw err("ETIMEOUT"); })), "incerto");
  assert.equal(await checkEmailDomain("semponto", dns(async () => [])), "sem_servidor");
  // vários, sem repetir consulta
  let calls = 0;
  const m = await checkEmailDomains(["a.com", "a.com", "b.com"], dns(async () => { calls++; return [{ exchange: "mx", priority: 1 }]; }));
  assert.equal(calls, 2);
  assert.equal(m.get("b.com"), "ok");
  console.log("ok");
}
main();
