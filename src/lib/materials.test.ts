import assert from "node:assert/strict";
import { catalogForPrompt, checkFile, extOf, isMaterialToken, materialUrl, newMaterialToken, parseLink } from "./materials";

// Rodar: npx tsx src/lib/materials.test.ts
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

// Arquivo aceito: tipo pela extensão e começo do arquivo conferido
const ok = checkFile("Tabela Saúde 2026.PDF", pdf);
assert.ok(ok.ok && ok.mime === "application/pdf" && ok.inline);
assert.ok(checkFile("a.docx", new Uint8Array([0x50, 0x4b, 3, 4])).ok);
assert.equal(extOf("x.tar.GZ"), "gz");

// Recusado: tipo fora da lista, arquivo vazio, grande demais, conteúdo que não confere
assert.equal(checkFile("virus.exe", pdf).ok, false);
assert.equal(checkFile("pagina.html", pdf).ok, false);
assert.equal(checkFile("a.pdf", new Uint8Array(0)).ok, false);
assert.equal(checkFile("a.pdf", new Uint8Array(4 * 1024 * 1024 + 1)).ok, false);
const fake = checkFile("a.pdf", new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]));
assert.ok(!fake.ok && /não confere/.test(fake.error));

// Nome do arquivo sem caracteres perigosos
const clean = checkFile('..\..\evil"name.pdf', pdf);
assert.ok(clean.ok && !/[\\"/]/.test(clean.fileName));

// Links: só http(s)
assert.equal(parseLink("https://drive.google.com/file/d/1/view"), "https://drive.google.com/file/d/1/view");
assert.equal(parseLink("drive.google.com/x"), "https://drive.google.com/x");
assert.equal(parseLink("javascript:alert(1)"), null);
assert.equal(parseLink("ftp://a.com/x"), null);
assert.equal(parseLink("localhost"), null);
assert.equal(parseLink(""), null);

// Código e endereço
const t = newMaterialToken();
assert.ok(isMaterialToken(t) && t.length >= 16);
assert.notEqual(t, newMaterialToken());
assert.equal(isMaterialToken("../etc"), false);
assert.equal(materialUrl("https://app.x.com/", "abc"), "https://app.x.com/m/abc");

// O que a IA lê: títulos e quando usar, nunca endereço
assert.equal(catalogForPrompt([]), null);
const cat = catalogForPrompt([{ title: "Tabela Saúde", whenToUse: "preço de saúde" }, { title: "Folder", whenToUse: null }])!;
assert.match(cat, /"Tabela Saúde" — use quando: preço de saúde/);
assert.match(cat, /nunca invente/);
assert.doesNotMatch(cat, /https?:/);

console.log("ok");
