import assert from "node:assert/strict";

// Rodar: npx tsx src/lib/stripQuoted.test.ts
// (o e-mail precisa de variáveis de ambiente só para enviar; aqui testamos só a função pura)
async function main() {
  const { stripQuoted } = await import("./email");
  const want = "Pode ser terça às 15h.";
  // Gmail em uma linha
  assert.equal(stripQuoted(`${want}\n\nEm qua., 30 de set. de 2026 às 09:12, Lucas <l@x.com> escreveu:\n> Oi, Bruno`), want);
  // Gmail com a linha quebrada em duas
  assert.equal(stripQuoted(`${want}\n\nEm qua., 30 de set. de 2026 às 09:12, Lucas Almeida <lucas.almeida@corretor.com.br>\nescreveu:\n> Oi, Bruno`), want);
  // Inglês
  assert.equal(stripQuoted(`${want}\n\nOn Wed, Sep 30, 2026 at 9:12 AM Lucas <l@x.com> wrote:\n> Hi`), want);
  // Outlook: traço e cabeçalho De/Enviado
  assert.equal(stripQuoted(`${want}\n\n________________________________\nDe: Lucas <l@x.com>\nEnviado: quarta-feira\nPara: Bruno`), want);
  // Assinatura do celular antes da citação
  assert.equal(stripQuoted(`${want}\n\nEnviado do meu iPhone\n\nEm qua., 30 de set. ... escreveu:\n> Oi`), want);
  assert.equal(stripQuoted(`${want}\nSent from my Android\n> Hi`), want);
  assert.equal(stripQuoted(`${want}\n\nObter o Outlook para Android`), want);
  // Mensagem normal fica inteira, inclusive com "em" no começo de uma frase
  const normal = "Oi!\nEm resumo, temos 15 vidas hoje.\nMe liga amanhã?";
  assert.equal(stripQuoted(normal), normal);
  console.log("ok");
}
main();
