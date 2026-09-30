"use client";

import { useState, useTransition } from "react";
import { inviteWarm, loadWarmSuggestions, type WarmState } from "./actions";
import { InviteSheet, SelectionBar } from "./InviteSheet";
import type { WarmSuggestion } from "@/lib/warm";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Help } from "@/components/Help";

function SourceBadges({ s }: { s: WarmSuggestion }) {
  return (
    <span className="row wrap" style={{ gap: 5, marginTop: 3 }}>
      {s.sources.includes("viewer") && (
        <span className="pill pill-danger">Visitou seu perfil{s.viewedAt ? ` · ${relativeTime(new Date(s.viewedAt))}` : ""}</span>
      )}
      {s.sources.includes("follower") && <span className="pill pill-warn">Segue você</span>}
    </span>
  );
}

const GOOD_FIT = 60;

function FitBadge({ s }: { s: WarmSuggestion }) {
  if (s.icpScore == null) return null;
  const tone = s.icpScore >= 80 ? "pill-ok" : s.icpScore >= GOOD_FIT ? "pill-accent" : "";
  return (
    <span className={`pill ${tone}`} title={s.icpReason ?? undefined}>
      {s.icpScore}% de encaixe
    </span>
  );
}

function excludedSummary(ex: { anonymous: number; connections: number; leads: number; blocked: number }): string {
  const parts = [];
  if (ex.blocked) parts.push(`${ex.blocked} em "Nunca contatar"`);
  if (ex.connections) parts.push(`${ex.connections} já ${ex.connections > 1 ? "são conexões" : "é conexão"}`);
  if (ex.leads) parts.push(`${ex.leads} já ${ex.leads > 1 ? "são contatos" : "é contato"}`);
  if (ex.anonymous) parts.push(`${ex.anonymous} visita${ex.anonymous > 1 ? "s" : ""} anônima${ex.anonymous > 1 ? "s" : ""}`);
  return parts.length ? `Fora da lista: ${parts.join(" · ")}.` : "";
}

export function WarmSuggestions() {
  const [state, setState] = useState<WarmState | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [onlyGoodFit, setOnlyGoodFit] = useState(false);

  const all = state?.ok ? state.suggestions.filter((s) => !invited.has(s.linkedinProfileUrl)) : [];
  const scored = state?.ok && state.scoring === "ok";
  const suggestions = scored && onlyGoodFit ? all.filter((s) => (s.icpScore ?? 0) >= GOOD_FIT) : all;
  const chosen = suggestions.filter((s) => selected.has(s.linkedinProfileUrl));

  function load() {
    startLoad(async () => {
      const result = await loadWarmSuggestions();
      setState(result);
      // Com nota, já vem marcado só quem tem bom encaixe; sem nota, todo mundo.
      const preselected = result.ok ? result.suggestions.filter((s) => result.scoring !== "ok" || (s.icpScore ?? 0) >= GOOD_FIT) : [];
      setSelected(new Set(preselected.map((s) => s.linkedinProfileUrl)));
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

  function finishInvite() {
    setInvited((prev) => new Set([...prev, ...chosen.map((s) => s.linkedinProfileUrl)]));
    setSelected(new Set());
  }

  return (
    <section className="sec">
      <div className="sec-head">
        <div className="setting-text">
          <h2 className="t-label">
            Quem já te notou{" "}
            <Help>Sem custo extra. Na conta gratuita do LinkedIn só as últimas visitas ao perfil aparecem, então a maior parte vem de quem segue você.</Help>
          </h2>
          <small>Quem visitou seu perfil ou segue você já conhece seu nome.</small>
        </div>
        {state?.ok && (
          <button type="button" className="btn-text" onClick={load} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        )}
      </div>

      {!state && (
        <div>
          <button type="button" className="btn-solid" onClick={load} disabled={loading}>
            {loading ? "Buscando…" : "Buscar sugestões"}
          </button>
        </div>
      )}

      {state && !state.ok && (
        <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
          <p className="field-error">{state.error}</p>
          <button type="button" className="btn-line btn-sm" onClick={load} disabled={loading}>
            Tentar de novo
          </button>
        </div>
      )}

      {state?.ok && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="setting-text">
            <b>
              {suggestions.length === 0
                ? "Ninguém novo por enquanto"
                : `${suggestions.length} pessoa${suggestions.length > 1 ? "s" : ""} · ${chosen.length} selecionada${chosen.length !== 1 ? "s" : ""}`}
            </b>
          </p>
          {excludedSummary(state.excluded) && <p className="hint" style={{ margin: 0 }}>{excludedSummary(state.excluded)}</p>}
          {state.scoring === "off" && (
            <p className="hint" style={{ margin: 0 }}>
              Dica: descreva seu cliente ideal em <a href="/settings#alcance" className="btn-text">Conta</a> e a secretária dá uma nota de encaixe para cada pessoa.
            </p>
          )}
          {state.scoring === "error" && <p className="hint" style={{ margin: 0 }}>Não deu para calcular o encaixe agora; a lista segue sem nota.</p>}
          {scored && all.length > 0 && (
            <div className="tabs">
              <button type="button" aria-pressed={!onlyGoodFit} onClick={() => setOnlyGoodFit(false)}>
                Todos <span className="count">{all.length}</span>
              </button>
              <button type="button" aria-pressed={onlyGoodFit} onClick={() => setOnlyGoodFit(true)}>
                Bom encaixe <span className="count">{all.filter((s) => (s.icpScore ?? 0) >= GOOD_FIT).length}</span>
              </button>
            </div>
          )}
          {state.failed.length > 0 && (
            <p className="hint" style={{ margin: 0 }}>
              Não deu para carregar {state.failed.map((f) => (f === "viewer" ? "as visitas ao perfil" : "os seguidores")).join(" nem ")} agora.
            </p>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <ul className="list">
            {suggestions.map((s) => (
              <li key={s.linkedinProfileUrl}>
                <label className="item pick">
                  <input type="checkbox" checked={selected.has(s.linkedinProfileUrl)} onChange={() => toggle(s.linkedinProfileUrl)} />
                  <Avatar firstName={s.firstName} lastName={s.lastName} size={40} />
                  <span className="item-main">
                    <span className="item-title">{[s.firstName, s.lastName].filter(Boolean).join(" ") || "Perfil do LinkedIn"}</span>
                    {s.headline && <span className="item-sub">{s.headline}</span>}
                    {s.icpReason && <span className="hint" style={{ margin: 0 }}>{s.icpReason}</span>}
                    <SourceBadges s={s} />
                  </span>
                  <FitBadge s={s} />
                </label>
              </li>
            ))}
          </ul>
          <SelectionBar count={chosen.length} onContinue={() => setSheetOpen(true)} />
        </>
      )}
      {sheetOpen && (
        <InviteSheet count={chosen.length} onInvite={(campaignId) => inviteWarm(chosen, campaignId)} onClose={() => setSheetOpen(false)} onDone={finishInvite} />
      )}
    </section>
  );
}
