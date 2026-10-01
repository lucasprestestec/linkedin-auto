// Renderiza no servidor as telas de voz e a aprovação com áudio (sem navegador, login ou banco):
// npx tsx scripts/test-voice-ui.tsx
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { VoiceStudio } = await import("../src/app/voz/VoiceStudio");
  const { VoiceOverview } = await import("../src/app/settings/VoiceOverview");
  const { ApprovalCard } = await import("../src/app/approvals/ApprovalCard");
  const { parseVoiceSettings } = await import("../src/lib/voice/settings");

  const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} } as never;
  const wrap = (el: React.ReactElement) => renderToString(createElement(AppRouterContext.Provider, { value: router }, el));
  const text = (html: string) =>
    html
      .replace(/<!-- -->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");

  let ok = true;
  const check = (name: string, fn: () => void) => {
    try {
      fn();
      console.log("ok  ", name);
    } catch (e) {
      ok = false;
      console.log("FALHOU", name, "\n  ", e instanceof Error ? e.message : e);
    }
  };

  const none = parseVoiceSettings({});
  const ready = parseVoiceSettings({ mode: "mirror", voiceId: "v1", voiceName: "Voz de Ana", consentAt: "2026-09-30T12:00:00.000Z", createdAt: "2026-09-30T12:00:00.000Z" });

  check("gravação: sem serviço configurado avisa e não mostra o gravador", () => {
    const t = text(wrap(createElement(VoiceStudio, { ownerName: "Ana", voice: none, configured: false })));
    assert.match(t, /ainda não foi configurado/);
    assert.ok(!t.includes("Começar a gravar"));
  });

  check("gravação: sem voz mostra o consentimento, o texto a ler com o nome e o botão travado", () => {
    const html = wrap(createElement(VoiceStudio, { ownerName: "Ana", voice: none, configured: true }));
    const t = text(html);
    assert.match(t, /esta é a minha própria voz/);
    assert.match(t, /autorizo o uso/);
    assert.match(t, /Aqui é Ana\./);
    assert.match(t, /de 15 a 60 segundos/);
    assert.match(t, /Marque a confirmação para gravar/);
    assert.match(html, /<button[^>]*disabled[^>]*>Marque a confirmação/);
  });

  check("gravação: sem nome no cadastro o texto continua certo", () => {
    const t = text(wrap(createElement(VoiceStudio, { ownerName: null, voice: none, configured: true })));
    assert.match(t, /Oi, tudo bem\? Eu trabalho/);
  });

  check("gravação: com voz criada mostra a voz, ouvir, gravar de novo e apagar", () => {
    const t = text(wrap(createElement(VoiceStudio, { ownerName: "Ana", voice: ready, configured: true })));
    assert.match(t, /Sua voz está pronta/);
    assert.match(t, /Voz de Ana/);
    assert.match(t, /Ouvir um exemplo/);
    assert.match(t, /Gravar de novo/);
    assert.match(t, /Apagar minha voz/);
    assert.ok(!t.includes("Começar a gravar"));
  });

  check("Conta: sem voz convida a criar e deixa só 'Só texto' disponível", () => {
    const html = wrap(createElement(VoiceOverview, { voice: none, configured: true }));
    const t = text(html);
    assert.match(t, /Crie a sua voz/);
    assert.match(t, /Criar minha voz/);
    for (const label of ["Só texto", "Responder em áudio quando o lead mandar áudio", "Responder sempre em áudio no WhatsApp"]) assert.ok(t.includes(label), label);
    assert.match(html, /<button[^>]*disabled=""[^>]*>[^]*?Responder em áudio quando o lead mandar áudio/);
  });

  check("Conta: com voz mostra a escolha atual marcada e libera as opções", () => {
    const html = wrap(createElement(VoiceOverview, { voice: ready, configured: true }));
    const t = text(html);
    assert.match(t, /Voz de Ana/);
    assert.match(t, /Gerenciar minha voz/);
    assert.match(html, /aria-pressed="true"[^>]*>[^]*?Responder em áudio quando o lead mandar áudio/);
    assert.ok(!/<button[^>]*disabled=""[^>]*>[^]*?Responder sempre em áudio/.test(html), "opção liberada");
  });

  check("Conta: sem o serviço configurado avisa", () => {
    assert.match(text(wrap(createElement(VoiceOverview, { voice: none, configured: false }))), /ainda não foi configurado/);
  });

  const item = (o: Record<string, unknown> = {}) =>
    ({ id: "d1", leadId: "l1", firstName: "Marcos", lastName: "Lima", jobTitle: "CFO", channel: "WhatsApp", kind: "Resposta", subject: null, content: "Entendi, são 32 pessoas. Qual a operadora de vocês hoje?", reason: "Respondeu à pergunta dele", asAudio: true, canAudio: true, when: "agora", ...o }) as never;

  check("aprovação: rascunho em áudio avisa, deixa ouvir e trocar por texto", () => {
    const t = text(wrap(createElement(ApprovalCard, { item: item() })));
    assert.match(t, /Vai sair como mensagem de voz, com a sua voz/);
    assert.match(t, /Ouvir antes de enviar/);
    assert.match(t, /Enviar como texto/);
  });

  check("aprovação: rascunho em texto no WhatsApp oferece 'Enviar como áudio'", () => {
    const t = text(wrap(createElement(ApprovalCard, { item: item({ asAudio: false, canAudio: true }) })));
    assert.match(t, /Vai sair em texto/);
    assert.match(t, /Enviar como áudio/);
  });

  check("aprovação: outros canais não mostram nada de áudio", () => {
    const t = text(wrap(createElement(ApprovalCard, { item: item({ channel: "LinkedIn", asAudio: false, canAudio: false }) })));
    assert.ok(!/áudio/i.test(t), t);
  });

  check("aprovação: sem voz pronta, rascunho em texto não oferece áudio", () => {
    const t = text(wrap(createElement(ApprovalCard, { item: item({ asAudio: false, canAudio: false }) })));
    assert.ok(!/áudio/i.test(t), t);
  });

  console.log(ok ? "\nTodos passaram" : "\nHÁ FALHAS");
  process.exit(ok ? 0 : 1);
})();
