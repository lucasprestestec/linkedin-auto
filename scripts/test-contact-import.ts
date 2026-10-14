// Confere a leitura da planilha de contatos (CSV). Sem banco e sem rede.
// Uso: npx tsx scripts/test-contact-import.ts
import assert from "node:assert/strict";
import { parseCsv, parseKindWord, readContacts } from "../src/lib/contactImport";

// Excel em português: ponto e vírgula, aspas, vírgula dentro do campo, quebra de linha dentro de aspas.
assert.deepEqual(parseCsv('a;b;c\n"x;y";"z ""q""";w\n'), [["a", "b", "c"], ["x;y", 'z "q"', "w"]]);
assert.deepEqual(parseCsv("a,b\r\n1,2\r\n\r\n3,4"), [["a", "b"], ["1", "2"], ["3", "4"]]);
assert.deepEqual(parseCsv('﻿nome\tmail\nAna\tana@x.com'), [["nome", "mail"], ["Ana", "ana@x.com"]]);
assert.deepEqual(parseCsv('a;b\n"linha 1\nlinha 2";c'), [["a", "b"], ["linha 1\nlinha 2", "c"]]);

const csv = [
  "Nome;Sobrenome;E-mail;Celular;Empresa;Cargo;Indicado por;Tipo;Observações;Coluna Estranha;LinkedIn",
  "Maria;Souza;maria@empresa.com.br;(51) 99999-0000;Grupo Vértice;Diretora de RH;Carlos;empresa;Conheci em evento;x",
  "João;Lima;JOAO@Empresa.com.br;;;;;pessoa;;",
  "Pedro;Dias;pedro-sem-arroba;;;;;;;",
  ";Sem Nome;sem@nome.com;;;;;;;",
  "Ana;Prado;;;;;;;;",
  "Maria;Souza;maria@empresa.com.br;;;;;;;",
  "Lia;Reis;;11988887777;;;;parceiro;;",
  "Bia;Luz;;;;;;;;;https://www.linkedin.com/in/bia-luz",
].join("\n");
const r = readContacts(csv);
assert.equal(r.error, undefined);
assert.equal(r.total, 8);
assert.deepEqual(r.ignored, ["Coluna Estranha"]);
assert.deepEqual(
  r.rows.map((x) => [x.line, x.firstName, x.lastName, x.email, x.phone, x.jobTitle, x.kind, x.referredBy]),
  [
    [2, "Maria", "Souza", "maria@empresa.com.br", "5551999990000", "Diretora de RH · Grupo Vértice", "BUSINESS", "Carlos"],
    [3, "João", "Lima", "joao@empresa.com.br", null, null, "PERSON", null],
    [8, "Lia", "Reis", null, "5511988887777", null, "PARTNER", null],
    [9, "Bia", "Luz", null, null, null, null, null],
  ],
);
assert.deepEqual(r.problems.map((p) => p.line), [4, 5, 6, 7]);
assert.match(r.problems[0].message, /E-mail inválido/);
assert.match(r.problems[1].message, /Falta o nome/);
assert.match(r.problems[2].message, /Sem e-mail/);
assert.match(r.problems[3].message, /Repetido.*linha 2/);

// Só "Nome completo": separa no primeiro espaço. Só "Nome" com espaço: idem.
const full = readContacts("Nome completo,Email\nAna Maria Prado,ana@x.com\n");
assert.deepEqual([full.rows[0].firstName, full.rows[0].lastName], ["Ana", "Maria Prado"]);
const nameOnly = readContacts("Nome,Email\nCarlos Alberto,c@x.com\n");
assert.deepEqual([nameOnly.rows[0].firstName, nameOnly.rows[0].lastName], ["Carlos", "Alberto"]);

// Planilha sem as colunas essenciais.
assert.match(readContacts("Empresa,Cargo\nX,Y\n").error ?? "", /coluna do nome/);
assert.match(readContacts("Nome,Cargo\nAna,Y\n").error ?? "", /coluna de contato/);
assert.match(readContacts("Nome,Email\n").error ?? "", /pelo menos um contato/);

assert.equal(parseKindWord("Pessoa física"), "PERSON");
assert.equal(parseKindWord("Parceiro / indicador"), "PARTNER");
assert.equal(parseKindWord("outra coisa"), null);

console.log("ok: importação de contatos");
