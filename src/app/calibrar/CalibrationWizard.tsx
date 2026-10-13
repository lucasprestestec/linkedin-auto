"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLOSED_QUESTIONS, PAIRS, SITUATIONS, type ClosedId } from "@/lib/calibrationData";
import { describeStyle, MAX_ANSWER_CHARS, MAX_WORDS_CHARS, type WritingStyle } from "@/lib/writingStyle";
import { finishCalibration, saveCalibration, type CalibrationPatch } from "@/app/settings/style-actions";
import { ClosedQuestions } from "./ClosedQuestions";
import { StyleAdjustments } from "./StyleAdjustments";

type StepId = string;
const STEPS: StepId[] = ["intro", "closed", "pairs", ...SITUATIONS.map((s) => `s:${s.id}`), "words", "done"];
const at = (id: StepId) => STEPS.indexOf(id);

const hasClosed = (s: WritingStyle) => CLOSED_QUESTIONS.some((q) => s[q.id] !== "auto");

// Primeiro passo que ainda não foi respondido (pra "Continuar de onde parou").
function firstIncomplete(s: WritingStyle): number {
  if (!hasClosed(s)) return at("closed");
  if (Object.keys(s.choices).length === 0) return at("pairs");
  const next = SITUATIONS.find((x) => !s.answers[x.id]);
  if (next) return at(`s:${next.id}`);
  if (!s.never && !s.always) return at("words");
  return at("done");
}

const hasProgress = (s: WritingStyle) => hasClosed(s) || Object.keys(s.choices).length > 0 || Object.keys(s.answers).length > 0;

const card = (selected: boolean): React.CSSProperties => ({
  textAlign: "left",
  padding: 14,
  borderRadius: "var(--radius-sm)",
  border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
  background: selected ? "var(--accent-soft)" : "var(--card)",
  color: "var(--text)",
  font: "inherit",
  cursor: "pointer",
  lineHeight: 1.45,
});

// startAt: só os testes usam (abrir direto num passo).
export const WIZARD_STEPS = STEPS;

export function CalibrationWizard({ initial, startAt = 0 }: { initial: WritingStyle; startAt?: number }) {
  const router = useRouter();
  const [style, setStyle] = useState(initial);
  const [step, setStep] = useState(startAt);
  const [draft, setDraft] = useState(() => (STEPS[startAt]?.startsWith("s:") ? (initial.answers[STEPS[startAt].slice(2)] ?? "") : ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = STEPS[step];
  const situationIndex = id.startsWith("s:") ? SITUATIONS.findIndex((s) => `s:${s.id}` === id) : -1;
  const situation = situationIndex >= 0 ? SITUATIONS[situationIndex] : null;

  function go(to: number, current: WritingStyle = style) {
    const target = STEPS[to];
    if (target.startsWith("s:")) setDraft(current.answers[target.slice(2)] ?? "");
    setError(null);
    setStep(to);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  // Salva o passo atual e avança.
  function saveAndNext(patch: CalibrationPatch) {
    startTransition(async () => {
      const r = await saveCalibration(patch);
      if (r.error || !r.style) {
        setError(r.error ?? "Não consegui salvar. Tente de novo.");
        return;
      }
      setStyle(r.style);
      go(step + 1, r.style);
    });
  }

  function next() {
    if (id === "closed") {
      const patch: CalibrationPatch = {};
      for (const q of CLOSED_QUESTIONS) (patch as Record<string, unknown>)[q.id] = style[q.id];
      return saveAndNext(patch);
    }
    if (id === "pairs") return saveAndNext({ choices: style.choices });
    if (situation) return saveAndNext({ answers: { [situation.id]: draft } });
    if (id === "words") return saveAndNext({ never: style.never, always: style.always });
    go(step + 1);
  }

  function finish() {
    startTransition(async () => {
      await finishCalibration();
      router.push("/settings#jeito");
    });
  }

  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const part =
    id === "closed"
      ? "Parte 1 de 3 · Seu jeito de falar"
      : id === "pairs"
        ? "Parte 2 de 3 · Qual parece mais com você?"
        : situation
          ? `Parte 3 de 3 · Com as suas palavras · ${situationIndex + 1} de ${SITUATIONS.length}`
          : id === "words"
            ? "Parte 3 de 3 · Suas palavras"
            : "";

  return (
    <div className="stack" style={{ gap: 18 }}>
      {id !== "intro" && id !== "done" && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="t-label">{part}</span>
          <progress value={progress} max={100} aria-label="Andamento da calibragem" style={{ width: "100%" }} />
        </div>
      )}

      {id === "intro" && (
        <div className="stack" style={{ gap: 14 }}>
          <h2 className="t-title" style={{ margin: 0 }}>
            Vamos calibrar o seu assistente
          </h2>
          <p>
            Para o assistente escrever como você, preciso conhecer o seu jeito. São 3 partes: algumas perguntas rápidas, escolher o que parece mais com você e
            responder situações reais com as suas palavras.
          </p>
          <p className="small muted">
            Leva uns 8 minutos. Você pode pular o que quiser e parar a qualquer momento: o que já respondeu fica salvo.
            {style.calibratedAt && " Você já calibrou antes; pode refazer, e as respostas anteriores aparecem para ajustar."}
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn-solid" onClick={() => go(hasProgress(style) ? firstIncomplete(style) : at("closed"))}>
              {hasProgress(style) ? "Continuar" : "Começar"}
            </button>
            {hasProgress(style) && (
              <button type="button" className="btn-line" onClick={() => go(at("closed"))}>
                Rever do começo
              </button>
            )}
          </div>
        </div>
      )}

      {id === "closed" && (
        <div className="stack" style={{ gap: 18 }}>
          <p className="small muted">Toque na opção que mais combina com você. Se nenhuma servir, pule a pergunta.</p>
          <ClosedQuestions
            style={style}
            disabled={pending}
            onChange={(qid: ClosedId, value: string) => setStyle((prev) => ({ ...prev, [qid]: value }))}
          />
        </div>
      )}

      {id === "pairs" && (
        <div className="stack" style={{ gap: 20 }}>
          <p className="small muted">Em cada situação, escolha a resposta que mais parece com o que você mandaria. Não precisa ser igual.</p>
          {PAIRS.map((p) => (
            <div key={p.id} className="stack" style={{ gap: 8 }}>
              <span className="label">{p.situation}</span>
              {(["A", "B"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={style.choices[p.id] === v}
                  disabled={pending}
                  style={card(style.choices[p.id] === v)}
                  onClick={() =>
                    setStyle((prev) => {
                      const choices = { ...prev.choices };
                      if (choices[p.id] === v) delete choices[p.id];
                      else choices[p.id] = v;
                      return { ...prev, choices };
                    })
                  }
                >
                  {v === "A" ? p.a : p.b}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {situation && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="note stack" style={{ gap: 4 }}>
            <b className="small">Situação</b>
            <span>{situation.context}</span>
          </div>
          {situation.leadSays && (
            <blockquote style={{ margin: 0, padding: "12px 14px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)" }}>
              &ldquo;{situation.leadSays}&rdquo;
            </blockquote>
          )}
          <label className="label" htmlFor="resposta">
            {situation.ask}
          </label>
          <textarea
            id="resposta"
            className="field"
            rows={5}
            maxLength={MAX_ANSWER_CHARS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            placeholder="Escreva como você realmente mandaria. Não precisa ser perfeito."
          />
          <p className="hint" style={{ margin: 0 }}>
            Dica: quanto mais parecido com o que você escreveria de verdade, melhor o assistente aprende.
          </p>
        </div>
      )}

      {id === "words" && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <label className="label" htmlFor="nunca">
              Alguma palavra ou expressão que você nunca usaria?
            </label>
            <input
              id="nunca"
              className="field"
              maxLength={MAX_WORDS_CHARS}
              value={style.never}
              disabled={pending}
              onChange={(e) => setStyle((prev) => ({ ...prev, never: e.target.value }))}
              placeholder='Ex.: "prezado", "estimado", "gostaria de"'
            />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label className="label" htmlFor="sempre">
              E alguma que você usa o tempo todo?
            </label>
            <input
              id="sempre"
              className="field"
              maxLength={MAX_WORDS_CHARS}
              value={style.always}
              disabled={pending}
              onChange={(e) => setStyle((prev) => ({ ...prev, always: e.target.value }))}
              placeholder='Ex.: "show", "tranquilo", "combinado"'
            />
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Opcional. Pode deixar em branco.
          </p>
        </div>
      )}

      {id === "done" && (
        <div className="stack" style={{ gap: 18 }}>
          <h2 className="t-title" style={{ margin: 0 }}>
            Pronto. Esse é o seu jeito.
          </h2>
          {describeStyle(style).length > 0 || Object.keys(style.answers).length > 0 ? (
            <div className="stack" style={{ gap: 6 }}>
              {describeStyle(style).map((r) => (
                <p key={r.label} style={{ margin: 0 }}>
                  <b>{r.label}:</b> {r.value}
                </p>
              ))}
              {Object.keys(style.answers).length > 0 && (
                <p className="small muted" style={{ margin: 0 }}>
                  {Object.keys(style.answers).length} situação(ões) respondida(s) com as suas palavras.
                </p>
              )}
            </div>
          ) : (
            <p className="note">Você pulou tudo, então o assistente continua com um jeito neutro. Dá para voltar e responder quando quiser.</p>
          )}
          <p className="small muted">
            Agora vale testar: olhe os próximos rascunhos em Aprovações. Se algo não estiver com a sua cara, peça o ajuste aqui embaixo (também dá para fazer isso depois, em Conta).
          </p>
          <StyleAdjustments initialRules={style.rules} />
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {id !== "intro" && (
        <div className="row wrap" style={{ gap: 8 }}>
          {id === "done" ? (
            <button type="button" className="btn-solid" onClick={finish} disabled={pending}>
              {pending ? "Concluindo…" : "Concluir calibragem"}
            </button>
          ) : (
            <button type="button" className="btn-solid" onClick={next} disabled={pending}>
              {pending ? "Salvando…" : "Próximo"}
            </button>
          )}
          {situation && (
            <button type="button" className="btn-line" onClick={() => go(step + 1)} disabled={pending}>
              Pular
            </button>
          )}
          {id === "words" && (
            <button type="button" className="btn-line" onClick={() => go(step + 1)} disabled={pending}>
              Pular
            </button>
          )}
          <button type="button" className="btn-text" onClick={() => go(step - 1)} disabled={pending}>
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
