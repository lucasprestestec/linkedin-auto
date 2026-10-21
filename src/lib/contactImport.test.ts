import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { detectColumns, readContacts } from "./contactImport";
import { readXlsx, rowsToCsv } from "./xlsx";

// Rodar: npx tsx src/lib/contactImport.test.ts
const now = new Date("2026-10-21T15:00:00Z");

// Contatos simples continuam como antes
{
  const r = readContacts("Nome;E-mail;Telefone\nAna Souza;ana@empresa.com.br;(51) 99999-0000\n;sem@nome.com;\n", undefined, now);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].firstName, "Ana");
  assert.equal(r.rows[0].lastName, "Souza");
  assert.equal(r.rows[0].client, false);
  assert.equal(r.rows[0].renewalAt, null);
  assert.equal(r.hasClientData, false);
  assert.equal(r.problems.length, 1);
}

// Carteira com títulos do dia a dia de corretora (nomes diferentes dos básicos)
{
  const csv = [
    "RELATÓRIO DE APÓLICES;;;;;",
    ";;;;;",
    "Segurado;E-mail do cliente;Celular;Ramo;Seguradora;Vigência;Prêmio;Nº Apólice",
    "Maria Lima;maria@lima.com.br;51 98888-7777;Auto;Porto;15/03/2026 a 15/03/2027;R$ 2.350,00;A-123",
    "João Pires;joao@pires.com.br;;Saúde empresarial;Amil;46461;1.200;",
    "Rita Gomes;rita@gomes.com.br;;Vida;Sulamérica;quando der;;",
  ].join("\n");
  const d = detectColumns(csv)!;
  assert.deepEqual(d.mapping, ["fullName", "email", "phone", "product", "insurer", "renewal", "premium", "policy"]);
  const r = readContacts(csv, undefined, now);
  assert.equal(r.rows.length, 3);
  assert.equal(r.hasClientData, true);
  assert.equal(r.rows[0].firstName, "Maria");
  assert.equal(r.rows[0].renewalAt, "2027-03-15");
  assert.equal(r.rows[0].renewalNote, "Auto · Porto · apólice A-123 · valor R$ 2.350,00");
  assert.equal(r.rows[0].client, true);
  assert.equal(r.rows[1].renewalAt, "2027-03-15");
  assert.equal(r.rows[2].renewalAt, null);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0].message, /quando der/);
  assert.equal(r.problems.length, 0);
}

// O corretor corrige a coluna: "Data" vira vencimento
{
  const csv = "Cliente;Contato;Data\nPedro Alves;pedro@alves.com.br;10/11/2026\n";
  const d = detectColumns(csv)!;
  assert.equal(d.mapping[2], "");
  const r = readContacts(csv, ["fullName", "email", "renewal"], now);
  assert.equal(r.rows[0].renewalAt, "2026-11-10");
  assert.equal(r.rows[0].client, true);
}

// Excel (.xlsx): números de data, textos compartilhados e colunas puladas
{
  const sheet =
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t>ana@x.com.br</t></is></c><c r="D2"><v>46461</v></c></row>' +
    "</sheetData></worksheet>";
  const shared =
    "<sst><si><t>Nome</t></si><si><t>E-mail</t></si><si><t>Vencimento</t></si><si><r><t>Ana </t></r><r><t>&amp; Cia</t></r></si></sst>";
  const wb = '<workbook><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels = '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>';
  const zip = zipSync({
    "xl/workbook.xml": strToU8(wb),
    "xl/_rels/workbook.xml.rels": strToU8(rels),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/sharedStrings.xml": strToU8(shared),
  });
  const rows = readXlsx(zip);
  assert.deepEqual(rows, [["Nome", "E-mail", "", "Vencimento"], ["Ana & Cia", "ana@x.com.br", "", "46461"]]);
  const r = readContacts(rowsToCsv(rows), undefined, now);
  assert.equal(r.rows[0].renewalAt, "2027-03-15");
  assert.throws(() => readXlsx(new Uint8Array([1, 2, 3])), /\.xlsx/);
}

console.log("ok");
