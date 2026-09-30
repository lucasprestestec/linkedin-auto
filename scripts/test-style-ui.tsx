// Renderiza no servidor cada passo da calibragem e os blocos de configurações, pra pegar erro de tela
// (sem navegador, sem login e sem banco): npx tsx scripts/test-style-ui.tsx
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { CalibrationWizard, WIZARD_STEPS } = await import("../src/app/calibrar/CalibrationWizard");
  const { ClosedQuestions } = await import("../src/app/calibrar/ClosedQuestions");
  const { StyleAdjustments } = await import("../src/app/calibrar/StyleAdjustments");
  const { StyleOverview } = await import("../src/app/settings/StyleOverview");
  const { FeedbackPanel } = await import("../src/components/FeedbackPanel");
  const { parseWritingStyle } = await import("../src/lib/writingStyle");
  const { SITUATIONS, PAIRS, CLOSED_QUESTIONS } = await import("../src/lib/calibrationData");

  const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} } as never;
  const wrap = (el: React.ReactElement) => renderToString(createElement(AppRouterContext.Provider, { value: router }, el));
  const text = (html: string) =>
    html
      .replace(/<!-- -->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
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

  const empty = parseWritingStyle({});
  const full = parseWritingStyle({
    treatment: "voce",
    emoji: "rare",
    formality: "informal",
    length: "short",
    greeting: "oi",
    closing: "abraco",
    approach: "warm",
    never: "prezado",
    always: "show",
    answers: { abertura: "Oi, Ana!" },
    choices: { ab_quem_e: "A" },
    rules: ["Escreva mensagens mais curtas: no máximo 2 frases."],
    calibratedAt: "2026-09-30T12:00:00.000Z",
  });

  // Todos os passos, com perfil vazio e com perfil cheio.
  for (const [label, style] of [["vazio", empty], ["cheio", full]] as const) {
    WIZARD_STEPS.forEach((id, i) => {
      check(`calibragem (${label}) passo ${i} "${id}" renderiza`, () => {
        const t = text(wrap(createElement(CalibrationWizard, { initial: style, startAt: i })));
        assert.ok(t.length > 40, "tela vazia");
        if (id === "intro") assert.match(t, /Vamos calibrar o seu assistente/);
        if (id === "closed") for (const q of CLOSED_QUESTIONS) assert.ok(t.includes(q.title), q.title);
        if (id === "pairs") for (const p of PAIRS) assert.ok(t.includes(p.situation) && t.includes(p.a.slice(0, 20)), p.id);
        if (id.startsWith("s:")) {
          const s = SITUATIONS.find((x) => `s:${x.id}` === id)!;
          assert.ok(t.includes(s.context) && t.includes(s.ask), s.id);
          if (s.leadSays) assert.ok(t.includes(s.leadSays.slice(0, 20)));
          assert.match(t, /Pular/);
        }
        if (id === "words") assert.match(t, /nunca usaria/);
        if (id === "done") {
          assert.match(t, /Pronto\. Esse é o seu jeito/);
          assert.match(t, /Sugerir mudanças/);
          assert.match(t, /Concluir calibragem/);
        }
      });
    });
  }

  check("intro: 'Começar' sem progresso e 'Continuar' com progresso", () => {
    assert.match(text(wrap(createElement(CalibrationWizard, { initial: empty }))), /Começar/);
    const t = text(wrap(createElement(CalibrationWizard, { initial: full })));
    assert.match(t, /Continuar/);
    assert.match(t, /Você já calibrou antes/);
  });

  check("passo 'done' com perfil cheio mostra o perfil em palavras e o ajuste ativo", () => {
    const t = text(wrap(createElement(CalibrationWizard, { initial: full, startAt: WIZARD_STEPS.length - 1 })));
    assert.match(t, /Emojis: Quase nunca/);
    assert.match(t, /Despedida: "Abraço"/);
    assert.match(t, /Nunca usa: prezado/);
    assert.match(t, /Ajustes ativos/);
    assert.match(t, /no máximo 2 frases/);
  });

  check("passo 'done' com perfil vazio avisa que tudo foi pulado", () => {
    assert.match(text(wrap(createElement(CalibrationWizard, { initial: empty, startAt: WIZARD_STEPS.length - 1 }))), /pulou tudo/);
  });

  check("passo de situação já respondida mostra a resposta salva", () => {
    const i = WIZARD_STEPS.indexOf("s:abertura");
    assert.match(wrap(createElement(CalibrationWizard, { initial: full, startAt: i })), /Oi, Ana!/);
  });

  check("perguntas fechadas: marca a opção escolhida", () => {
    const html = wrap(createElement(ClosedQuestions, { style: full, onChange() {} }));
    assert.match(html, /aria-pressed="true"[^>]*>Quase nunca/);
    assert.match(html, /aria-pressed="false"[^>]*>Nunca</);
  });

  check("ajustes: sem regras não mostra a lista; com regras mostra com 'Remover'", () => {
    const none = text(wrap(createElement(StyleAdjustments, { initialRules: [] })));
    assert.match(none, /Sugerir mudanças/);
    assert.ok(!none.includes("Ajustes ativos"));
    const some = text(wrap(createElement(StyleAdjustments, { initialRules: ["Não use emojis."] })));
    assert.match(some, /Ajustes ativos/);
    assert.match(some, /Remover/);
  });

  check("configurações: sem calibragem convida a começar", () => {
    const t = text(wrap(createElement(StyleOverview, { style: empty, suggestions: [] })));
    assert.match(t, /Calibre o assistente para ele escrever como você/);
    assert.match(t, /Começar calibragem/);
    assert.match(t, /Ajustes rápidos/);
    assert.match(t, /Editar à mão/);
  });

  check("configurações: calibragem pela metade convida a continuar", () => {
    const t = text(wrap(createElement(StyleOverview, { style: parseWritingStyle({ emoji: "never" }), suggestions: [] })));
    assert.match(t, /Falta terminar a calibragem/);
    assert.match(t, /Continuar calibragem/);
  });

  check("configurações: calibrado mostra perfil, refazer e sugestões do assistente", () => {
    const t = text(
      wrap(createElement(StyleOverview, { style: full, suggestions: [{ key: "reason:long", text: "Escreva mensagens mais curtas.", evidence: "Você marcou \"Muito longa\" 3 vezes." }] })),
    );
    assert.match(t, /Emojis: Quase nunca/);
    assert.match(t, /Refazer calibragem/);
    assert.match(t, /Sugestões do assistente/);
    assert.match(t, /Sugerir mudanças/);
  });

  check("painel 'Não é meu jeito' renderiza os motivos pedidos", () => {
    const t = text(
      wrap(createElement(FeedbackPanel, { reasonKeys: ["long", "formal"], title: "O que não ficou com a sua cara?", placeholder: "x", onSubmit: async () => ({}), onDone() {} })),
    );
    assert.match(t, /Muito longa/);
    assert.match(t, /Formal demais/);
    assert.ok(!t.includes("Informal demais"));
  });

  console.log(ok ? "\nTodos passaram" : "\nHÁ FALHAS");
  process.exit(ok ? 0 : 1);
})();
