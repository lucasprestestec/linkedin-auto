"use client";

import { useState, useTransition } from "react";
import { inviteWarm, loadWarmSuggestions, type InviteState, type WarmState } from "./actions";
import type { WarmSuggestion } from "@/lib/warm";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { IconAlert, IconCheck, IconEye, IconFlame, IconRefresh, IconUserPlus } from "@/components/Icons";

function SourceBadges({ s }: { s: WarmSuggestion }) {
  return (
    <span className="row" style={{ gap: 5, flexWrap: "wrap", marginTop: 3 }}>
      {s.sources.includes("viewer") && (
        <span className="badge badge-urgent badge-plain" style={{ height: 20, fontSize: 11 }}>
          <IconEye size={11} /> Visitou seu perfil{s.viewedAt ? ` · ${relativeTime(new Date(s.viewedAt))}` : ""}
        </span>
      )}
      {s.sources.includes("follower") && (
        <span className="badge badge-waiting badge-plain" style={{ height: 20, fontSize: 11 }}>
          Segue você
        </span>
      )}
    </span>
  );
}

function excludedSummary(ex: { anonymous: number; connections: number; leads: number }): string {
  const parts = [];
  if (ex.connections) parts.push(`${ex.connections} já ${ex.connections > 1 ? "são conexões" : "é conexão"}`);
  if (ex.leads) parts.push(`${ex.leads} já ${ex.leads > 1 ? "são leads" : "é lead"}`);
  if (ex.anonymous) parts.push(`${ex.anonymous} visita${ex.anonymous > 1 ? "s" : ""} anônima${ex.anonymous > 1 ? "s" : ""}`);
  return parts.length ? `Fora da lista: ${parts.join(" · ")}.` : "";
}

export function WarmSuggestions() {
  const [state, setState] = useState<WarmState | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [loading, startLoad] = useTransition();
  const [inviting, startInvite] = useTransition();

  const suggestions = state?.ok ? state.suggestions : [];
  const chosen = suggestions.filter((s) => selected.has(s.linkedinProfileUrl));

  function load() {
    setInviteState(undefined);
    startLoad(async () => {
      const result = await loadWarmSuggestions();
      setState(result);
      setSelected(new Set(result.ok ? result.suggestions.map((s) => s.linkedinProfileUrl) : []));
    });
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function handleInvite() {
    startInvite(async () => setInviteState(await inviteWarm(chosen)));
  }

  const header = (
    <div className="step-head">
      <span className="step-num" style={{ background: "var(--urgent-soft)", color: "var(--urgent-ink)" }}>
        <IconFlame size={18} />
      </span>
      <div className="stack" style={{ minWidth: 0, flex: 1 }}>
        <h2 className="title-md">Sugestões quentes</h2>
        <p className="small muted">Quem visitou seu perfil ou segue você — já conhece seu nome.</p>
      </div>
    </div>
  );

  if (inviteState && !inviteState.error) {
    return (
      <section className="card success-card">
        <span className="success-icon">
          <IconCheck size={30} strokeWidth={3} />
        </span>
        <h2 className="title-lg">
          {inviteState.scheduled} convite{inviteState.scheduled !== 1 ? "s" : ""} agendado{inviteState.scheduled !== 1 ? "s" : ""}
        </h2>
        <p className="small muted" style={{ maxWidth: 290 }}>
          Quem aceitar recebe a mensagem de abertura da IA automaticamente.
        </p>
        {inviteState.skippedForLimit > 0 && (
          <span className="badge badge-invite" style={{ marginTop: 6 }}>
            {inviteState.skippedForLimit} ficaram de fora pelo limite diário
          </span>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} style={{ marginTop: 6 }}>
          <IconRefresh size={15} /> Buscar de novo
        </button>
      </section>
    );
  }

  return (
    <section className="card step rise" style={{ padding: "18px 0 0", overflow: "hidden" }}>
      <div className="stack" style={{ gap: 14, padding: "0 18px 18px" }}>
        {header}

        {!state && (
          <>
            <button type="button" className="btn btn-dark btn-block" onClick={load} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Buscando…
                </>
              ) : (
                <>
                  <IconFlame size={18} /> Buscar sugestões
                </>
              )}
            </button>
            <p className="hint">
              Sem custo extra. Na conta gratuita do LinkedIn só as últimas visitas ao perfil aparecem, então a maior parte vem de
              quem segue você.
            </p>
          </>
        )}

        {state && !state.ok && (
          <>
            <p className="error-text">
              <IconAlert size={15} /> {state.error}
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
              <IconRefresh size={15} /> Tentar de novo
            </button>
          </>
        )}

        {state?.ok && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="small" style={{ fontWeight: 700 }}>
                {suggestions.length === 0
                  ? "Ninguém novo por enquanto"
                  : `${suggestions.length} pessoa${suggestions.length > 1 ? "s" : ""} · ${chosen.length} selecionada${chosen.length !== 1 ? "s" : ""}`}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
                <IconRefresh size={15} style={loading ? { animation: "spin 0.8s linear infinite" } : undefined} /> Atualizar
              </button>
            </div>
            {excludedSummary(state.excluded) && <p className="hint">{excludedSummary(state.excluded)}</p>}
            {state.failed.length > 0 && (
              <p className="hint" style={{ color: "var(--warning-ink)" }}>
                Não deu pra carregar {state.failed.map((f) => (f === "viewer" ? "as visitas ao perfil" : "os seguidores")).join(" nem ")} agora.
              </p>
            )}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <>
          <ul className="list" style={{ border: "none", borderTop: "1px solid var(--border)", borderRadius: 0, boxShadow: "none" }}>
            {suggestions.map((s) => (
              <li key={s.linkedinProfileUrl}>
                <label className="check-row">
                  <input type="checkbox" checked={selected.has(s.linkedinProfileUrl)} onChange={() => toggle(s.linkedinProfileUrl)} />
                  <span className="checkbox">
                    <IconCheck size={15} strokeWidth={3.2} />
                  </span>
                  <Avatar firstName={s.firstName} lastName={s.lastName} size={40} />
                  <span className="lead-main">
                    <span className="lead-name" style={{ fontSize: 14.5 }}>
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") || "Perfil do LinkedIn"}
                    </span>
                    {s.headline && <span className="lead-sub tiny">{s.headline}</span>}
                    <SourceBadges s={s} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {/* Fixo só com lista longa: em lista curta o botão cabe na tela e, fixo, cobriria as últimas pessoas. */}
          <div
            className={`${suggestions.length > 5 ? "sticky-cta " : ""}stack`}
            style={{ gap: 10, padding: "12px 18px 18px", background: "var(--surface)" }}
          >
            {inviteState?.error && (
              <p className="error-text">
                <IconAlert size={15} /> {inviteState.error}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleInvite} disabled={inviting || chosen.length === 0}>
              {inviting ? (
                <>
                  <span className="spinner" /> Agendando convites…
                </>
              ) : chosen.length === 0 ? (
                "Selecione ao menos 1 pessoa"
              ) : (
                <>
                  <IconUserPlus size={19} /> Convidar {chosen.length} pessoa{chosen.length > 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
