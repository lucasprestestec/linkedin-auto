"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SCENARIOS } from "@/lib/agentEval/scenarios";
import type { EvalResult, ModelInfo } from "@/lib/agentEval/run";
import { loadEvalSetup, runEvalScenario, setAgentModel } from "./actions";
import { IconAlert, IconCheck, IconDownload, IconRefresh, IconSearch, IconX } from "@/components/Icons";

const STORE_KEY = "admin:agent-eval";
const CONCURRENCY = 4;

// Sugestões pré-marcadas (se existirem no catálogo): o modelo atual e alguns
// fortes/baratos de famílias diferentes.
const SUGGESTED = [/claude.*sonnet/i, /claude.*haiku/i, /kimi.*k3|kimi/i, /gemini.*flash/i];
const JUDGE_PREF = [/claude.*opus/i, /claude.*sonnet/i, /gpt-5/i];

type Summary = {
  model: string;
  done: number;
  errors: number;
  decisions: number;
  cleanFirstTry: number;
  naturalness: number | null;
  competence: number | null;
  serious: number;
  avgIn: number;
  avgOut: number;
  avgMs: number;
  costPer1000: number | null;
};

function key(model: string, scenarioId: string) {
  return `${model}|${scenarioId}`;
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function pickLatest(ids: string[], re: RegExp) {
  // Ids com números maiores costumam ser versões mais novas.
  return ids.filter((id) => re.test(id)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}

export function AgentEval() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [current, setCurrent] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [judgeModel, setJudgeModel] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<Record<string, EvalResult>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [detail, setDetail] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.results) setResults(saved.results);
    } catch {}
    loadEvalSetup().then((r) => {
      setModels(r.models);
      setCurrent(r.current);
      setSetupError(r.error ?? null);
      const ids = r.models.map((m) => m.id);
      const pre = [r.current, ...SUGGESTED.map((re) => pickLatest(ids, re))].filter((x): x is string => Boolean(x));
      setSelected([...new Set(pre)].slice(0, 5));
      setJudgeModel(JUDGE_PREF.map((re) => pickLatest(ids, re)).find(Boolean) ?? r.current);
      setLoading(false);
    });
  }, []);

  const priceOf = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const summaries: Summary[] = useMemo(() => {
    const byModel = new Map<string, EvalResult[]>();
    for (const r of Object.values(results)) byModel.set(r.model, [...(byModel.get(r.model) ?? []), r]);
    return [...byModel.entries()].map(([model, rs]) => {
      const ok = rs.filter((r) => r.ok);
      const judged = ok.filter((r) => r.judge);
      const avgIn = avg(ok.map((r) => r.usage?.inputTokens ?? 0)) ?? 0;
      const avgOut = avg(ok.map((r) => r.usage?.outputTokens ?? 0)) ?? 0;
      const reported = ok.map((r) => r.usage?.cost).filter((c): c is number => typeof c === "number");
      const p = priceOf.get(model);
      const costPer1000 = reported.length
        ? (avg(reported) ?? 0) * 1000
        : p?.inputPerM != null && p.outputPerM != null
          ? ((avgIn * p.inputPerM + avgOut * p.outputPerM) / 1_000_000) * 1000
          : null;
      return {
        model,
        done: rs.length,
        errors: rs.length - ok.length,
        decisions: ok.filter((r) => r.decisionOk).length,
        cleanFirstTry: ok.filter((r) => r.attempts === 1 && !r.checkIssues?.length).length,
        naturalness: avg(judged.map((r) => r.judge!.naturalness)),
        competence: avg(judged.map((r) => r.judge!.competence)),
        serious: judged.filter((r) => r.judge!.invented || r.judge!.brokeRule).length,
        avgIn,
        avgOut,
        avgMs: avg(ok.map((r) => r.ms ?? 0)) ?? 0,
        costPer1000,
      };
    });
  }, [results, priceOf]);

  const visibleModels = models.filter((m) => !filter || m.id.toLowerCase().includes(filter.toLowerCase()));
  const calls = selected.length * SCENARIOS.length * (judgeModel ? 2 : 1);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function run() {
    const tasks = selected.flatMap((m) => SCENARIOS.map((s) => ({ model: m, scenarioId: s.id })));
    stopRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: tasks.length });
    // Limpa resultados antigos dos modelos que vão rodar de novo.
    setResults((prev) => Object.fromEntries(Object.entries(prev).filter(([, r]) => !selected.includes(r.model))));
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < tasks.length && !stopRef.current) {
        const t = tasks[next++];
        let r: EvalResult;
        try {
          r = await runEvalScenario(t.scenarioId, t.model, judgeModel || null);
        } catch (err) {
          r = { scenarioId: t.scenarioId, model: t.model, ok: false, error: err instanceof Error ? err.message : "falhou" };
        }
        setResults((prev) => {
          const updated = { ...prev, [key(t.model, t.scenarioId)]: r };
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify({ results: updated }));
          } catch {}
          return updated;
        });
        setProgress({ done: ++done, total: tasks.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  async function chooseModel(model: string | null) {
    setSaving(model ?? "env");
    const r = await setAgentModel(model);
    setCurrent(r.current);
    setSaving(null);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ scenarios: SCENARIOS, results: Object.values(results) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `teste-agente-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  if (loading) {
    return (
      <div className="card card-pad row" style={{ gap: 10 }}>
        <span className="spinner" /> Carregando modelos do Nous…
      </div>
    );
  }

  return (
    <div className="stack eval" style={{ gap: 16 }}>
      <div className="card card-pad stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="tiny faint">Modelo usado nas conversas agora</span>
            <b className="eval-current">{current}</b>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => chooseModel(null)} disabled={saving !== null}>
            Voltar ao padrão do ambiente
          </button>
        </div>

        {setupError ? (
          <p className="error-text">
            <IconAlert size={15} /> {setupError}
          </p>
        ) : (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <span className="label">Modelos para testar ({selected.length} marcados)</span>
              <div className="eval-picked">
                {selected.map((id) => (
                  <button key={id} type="button" className="chip" aria-pressed="true" onClick={() => toggle(id)}>
                    {id} <IconX size={12} />
                  </button>
                ))}
              </div>
              <label className="pill-input">
                <IconSearch size={16} />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Buscar entre ${models.length} modelos (ex.: claude, kimi, gemini)`} />
              </label>
              {filter && (
                <div className="eval-model-list">
                  {visibleModels.slice(0, 40).map((m) => (
                    <label key={m.id} className="eval-model">
                      <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
                      <span>{m.id}</span>
                      {m.inputPerM != null && (
                        <small className="faint">
                          US$ {m.inputPerM.toFixed(2)} / {m.outputPerM?.toFixed(2)} por 1M
                        </small>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="field" style={{ gap: 6 }}>
              <span className="label">Avaliador (dá as notas de naturalidade e competência)</span>
              <select className="input" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
                <option value="">Sem avaliador (só as checagens automáticas — mais barato)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </label>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {running ? (
                <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
                  Parar
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={run} disabled={selected.length === 0}>
                  <IconRefresh size={16} /> Rodar {SCENARIOS.length} cenários em {selected.length} modelo{selected.length !== 1 ? "s" : ""}
                </button>
              )}
              <span className="tiny faint">{calls} chamadas ao Nous. Usa os créditos da sua conta.</span>
            </div>
            {progress.total > 0 && (
              <div className="eval-progress" aria-label="Progresso">
                <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {summaries.length > 0 && (
        <div className="card eval-table-wrap">
          <table className="simple-table eval-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th title="Respondeu / passou pro corretor / encerrou quando devia">Decisões certas</th>
                <th title="Mensagem passou na conferência de primeira">Conferência</th>
                <th>Naturalidade</th>
                <th>Competência</th>
                <th title="Inventou fato ou quebrou regra (segundo o avaliador)">Erros graves</th>
                <th>Tempo</th>
                <th>Tokens (ent./saída)</th>
                <th title="Estimativa por 1.000 respostas">Custo/1.000</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const ok = s.done - s.errors;
                return (
                  <tr key={s.model} className={detail === s.model ? "active" : undefined}>
                    <td>
                      <button type="button" className="eval-model-name" onClick={() => setDetail(detail === s.model ? null : s.model)}>
                        {s.model}
                      </button>
                      {s.errors > 0 && <small className="error-text"> {s.errors} falha{s.errors > 1 ? "s" : ""}</small>}
                    </td>
                    <td>
                      <b>{ok ? Math.round((s.decisions / ok) * 100) : 0}%</b> <small className="faint">({s.decisions}/{ok})</small>
                    </td>
                    <td>{ok ? Math.round((s.cleanFirstTry / ok) * 100) : 0}%</td>
                    <td>{s.naturalness?.toFixed(1) ?? "—"}</td>
                    <td>{s.competence?.toFixed(1) ?? "—"}</td>
                    <td className={s.serious > 0 ? "eval-bad" : undefined}>{s.serious}</td>
                    <td>{(s.avgMs / 1000).toFixed(1)}s</td>
                    <td>
                      {Math.round(s.avgIn)}/{Math.round(s.avgOut)}
                    </td>
                    <td>{s.costPer1000 == null ? "—" : `US$ ${s.costPer1000.toFixed(2)}`}</td>
                    <td>
                      {current === s.model ? (
                        <span className="badge badge-open">Em uso</span>
                      ) : (
                        <button type="button" className="btn btn-secondary btn-sm" disabled={saving !== null} onClick={() => chooseModel(s.model)}>
                          {saving === s.model ? "Salvando…" : "Usar nas conversas"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="row" style={{ justifyContent: "space-between", padding: "10px 14px", gap: 10, flexWrap: "wrap" }}>
            <span className="tiny faint">Clique num modelo pra ver cada resposta. Resultados ficam salvos neste navegador.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportJson}>
              <IconDownload size={15} /> Baixar resultados
            </button>
          </div>
        </div>
      )}

      {detail && (
        <div className="stack" style={{ gap: 10 }}>
          <h3 className="title-md">Respostas de {detail}</h3>
          {SCENARIOS.map((s) => {
            const r = results[key(detail, s.id)];
            if (!r) return null;
            const good = r.ok && r.decisionOk && !(r.judge?.invented || r.judge?.brokeRule);
            return (
              <details key={s.id} className="card eval-case">
                <summary>
                  <span className={`eval-dot ${!r.ok ? "err" : good ? "ok" : "bad"}`}>{!r.ok ? <IconAlert size={12} /> : good ? <IconCheck size={12} strokeWidth={3} /> : <IconX size={12} />}</span>
                  <span className="eval-case-title">
                    <b>{s.title}</b>
                    <small className="faint">
                      {s.category} · esperado: {s.expect === "either" ? "tanto faz" : s.expect === "reply" ? "responder" : "passar pro corretor"}
                    </small>
                  </span>
                  {r.judge && (
                    <small className="eval-scores">
                      N {r.judge.naturalness} · C {r.judge.competence}
                    </small>
                  )}
                </summary>
                <div className="eval-case-body">
                  <p className="tiny faint">Lead disse:</p>
                  <p className="eval-quote">{s.history.filter((m) => m.sender === "LEAD").at(-1)?.content}</p>
                  {!r.ok ? (
                    <p className="error-text">{r.error}</p>
                  ) : r.action === "reply" ? (
                    <>
                      <p className="tiny faint">
                        Agente respondeu{r.qualified ? " · qualificado" : ""}
                        {r.declined ? " · encerrou (recusa)" : ""}
                        {r.attempts === 2 ? " · reescreveu 1x" : ""}:
                      </p>
                      <p className="eval-reply">{r.message}</p>
                    </>
                  ) : (
                    <>
                      <p className="tiny faint">Passou pro corretor:</p>
                      <p className="eval-reply handoff">{r.reason}</p>
                    </>
                  )}
                  {r.decisionNote && <p className="small" style={{ color: r.decisionOk ? "var(--warning-ink)" : "var(--urgent-ink)" }}>{r.decisionNote}</p>}
                  {r.checkIssues && r.checkIssues.length > 0 && <p className="small" style={{ color: "var(--warning-ink)" }}>Conferência: {r.checkIssues.join("; ")}</p>}
                  {r.judge && (
                    <p className="small">
                      <b>Avaliador:</b> {r.judge.comment}
                      {r.judge.invented && <span className="eval-bad"> · inventou fato</span>}
                      {r.judge.brokeRule && <span className="eval-bad"> · quebrou regra</span>}
                    </p>
                  )}
                  {r.error && r.ok && <p className="tiny faint">{r.error}</p>}
                  {r.analysis && (
                    <p className="tiny faint">
                      <b>Análise do agente:</b> {r.analysis}
                    </p>
                  )}
                  <p className="tiny faint">Critério: {s.rubric}</p>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
