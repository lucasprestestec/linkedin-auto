// Testes da escolha do bonequinho (sem rede): npx tsx scripts/test-avatar.ts
import assert from "node:assert/strict";
import { avatarFor, genderOfFirstName } from "../src/lib/avatarFor";

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

check("nomes femininos comuns", () => {
  for (const n of ["Catarina", "Thalita", "Juliana", "Maria", "Fernanda", "Raquel", "Beatriz", "Luciana", "Ana"]) assert.equal(genderOfFirstName(n), "mulher", n);
});
check("nomes masculinos comuns", () => {
  for (const n of ["Lucas", "Daniel", "Rafael", "João", "Rodrigo", "Gabriel", "Marcelo", "Thiago", "Luca"]) assert.equal(genderOfFirstName(n), "homem", n);
});
check("nomes neutros ou ambíguos viram neutro", () => {
  for (const n of ["Alex", "Cris", "Dani", "Gabi", "Ariel", "Charlie", "Jordan"]) assert.equal(genderOfFirstName(n), "neutro", n);
});
check("nome desconhecido sem terminação clara vira neutro", () => {
  assert.equal(genderOfFirstName("Xyzk"), "neutro");
  assert.equal(genderOfFirstName("Lee"), "neutro");
});
check("vazio ou nulo vira neutro", () => {
  assert.equal(genderOfFirstName(""), "neutro");
  assert.equal(genderOfFirstName(null), "neutro");
  assert.equal(genderOfFirstName(undefined), "neutro");
});
check("acento e maiúscula não mudam o resultado", () => {
  assert.equal(genderOfFirstName("JOÃO"), "homem");
  assert.equal(genderOfFirstName("  Conceição  "), "mulher");
});
check("usa só o primeiro nome quando vem composto", () => {
  assert.equal(genderOfFirstName("Maria Eduarda"), "mulher");
  assert.equal(genderOfFirstName("João Pedro"), "homem");
});
check("o mesmo nome sempre dá o mesmo boneco", () => {
  assert.deepEqual(avatarFor("Catarina", "Prestes"), avatarFor("Catarina", "Prestes"));
});
check("o tom vai de 1 a 5 e o arquivo segue o padrão", () => {
  const a = avatarFor("Lucas", "Prestes");
  assert.ok(a.tone >= 1 && a.tone <= 5);
  assert.match(a.src, /^\/avatars\/(mulher|homem|neutro)-[1-5]\.png$/);
});
check("há variedade de tons em 60 nomes", () => {
  const letters = (i: number) => String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + ((i * 7 + 3) % 26)) + String.fromCharCode(97 + ((i * 11 + 5) % 26));
  const tons = new Set(Array.from({ length: 60 }, (_, i) => avatarFor(`Nome${letters(i)}`, `Sobre${letters(i + 13)}`).tone));
  assert.equal(tons.size, 5);
});

process.exit(failed ? 1 : 0);
