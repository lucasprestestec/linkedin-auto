"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { parseProfiles, invite, type InviteState } from "./actions";
import type { ProspectResult } from "@/lib/prospect";
import { buildLinkedinSearchUrl, normalizeLinkedinUrl } from "@/lib/linkedin";
import { nameFromProfileUrl } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { IconAlert, IconCheck, IconClipboard, IconExternal, IconLinkedin, IconSearch, IconUserPlus } from "@/components/Icons";

const SUGGESTIONS = ["Diretor de RH", "Sócio fundador", "CFO", "Gerente administrativo", "Advogado sócio"];

function StepHeader({ n, title, subtitle, done }: { n: number; title: string; subtitle: string; done?: boolean }) {
  return (
    <div className={`step-head${done ? " step-done" : ""}`}>
      <span className="step-num">{done ? <IconCheck size={18} strokeWidth={3} /> : n}</span>
      <div className="stack" style={{ minWidth: 0 }}>
        <h2 className="title-md">{title}</h2>
        <p className="small muted">{subtitle}</p>
      </div>
    </div>
  );
}

function LinkedinSearchLink() {
  const [query, setQuery] = useState("");
  const url = buildLinkedinSearchUrl(query);
  const canOpen = query.trim() !== "";

  return (
    <section className="card card-pad step rise" style={{ "--i": 1 } as React.CSSProperties}>
      <StepHeader n={1} title="Encontre pessoas" subtitle="Busca gratuita, direto no LinkedIn." />
      <div className="input-wrap">
        <IconSearch size={19} />
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cargo, setor ou cidade"
          aria-label="Quem você quer alcançar?"
          enterKeyHint="search"
        />
      </div>
      <div className="chips" aria-label="Sugestões">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={query === s} onClick={() => setQuery(s)}>
            {s}
          </button>
        ))}
      </div>
      <a
        href={canOpen ? url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!canOpen}
        className="btn btn-dark btn-block"
      >
        <IconLinkedin size={18} />
        Abrir busca no LinkedIn
        <IconExternal size={16} style={{ opacity: 0.6 }} />
      </a>
      <p className="hint">Abre numa aba nova. Escolha quem quiser e copie o link do perfil de cada pessoa.</p>
    </section>
  );
}

function ProspectResults({ results }: { results: ProspectResult[] }) {
  const newResults = results.filter((r) => !r.alreadyLead);
  const [selected, setSelected] = useState<Set<string>>(new Set(newResults.map((r) => r.linkedinProfileUrl)));
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [inviting, startInvite] = useTransition();

  const selectedResults = newResults.filter((r) => selected.has(r.linkedinProfileUrl));
  const allSelected = newResults.length > 0 && selectedResults.length === newResults.length;

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(newResults.map((r) => r.linkedinProfileUrl)));
  }

  function handleInvite() {
    startInvite(async () => {
      setInviteState(await invite(selectedResults));
    });
  }

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
          Os convites saem ao longo do dia, espaçados para parecer natural. Quem aceitar aparece na sua lista de leads.
        </p>
        {inviteState.skippedForLimit > 0 && (
          <span className="badge badge-invite" style={{ marginTop: 6 }}>
            {inviteState.skippedForLimit} ficaram de fora pelo limite diário
          </span>
        )}
      </section>
    );
  }

  return (
    <section className="card step rise" style={{ padding: "18px 0 0", overflow: "hidden" }}>
      <div style={{ padding: "0 18px" }}>
        <StepHeader
          n={3}
          title="Revise e convide"
          subtitle={`${results.length} perfi${results.length !== 1 ? "s" : "l"} reconhecido${results.length !== 1 ? "s" : ""}${
            results.length > newResults.length ? ` · ${results.length - newResults.length} já são leads` : ""
          }`}
        />
      </div>

      {newResults.length > 1 && (
        <div className="row" style={{ justifyContent: "space-between", padding: "0 18px" }}>
          <span className="small faint" style={{ fontWeight: 600 }}>
            {selectedResults.length} de {newResults.length} selecionados
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAll}>
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </button>
        </div>
      )}

      <ul className="list" style={{ border: "none", borderTop: "1px solid var(--border)", borderRadius: 0, boxShadow: "none" }}>
        {results.map((r) => {
          const { firstName, lastName, slug } = nameFromProfileUrl(r.linkedinProfileUrl);
          return (
            <li key={r.linkedinProfileUrl}>
              <label className="check-row" style={r.alreadyLead ? { opacity: 0.5, cursor: "default" } : undefined}>
                {!r.alreadyLead && (
                  <>
                    <input type="checkbox" checked={selected.has(r.linkedinProfileUrl)} onChange={() => toggle(r.linkedinProfileUrl)} />
                    <span className="checkbox">
                      <IconCheck size={15} strokeWidth={3.2} />
                    </span>
                  </>
                )}
                <Avatar firstName={firstName} lastName={lastName} size={40} />
                <span className="lead-main">
                  <span className="lead-name" style={{ fontSize: 14.5 }}>
                    {firstName} {lastName}
                  </span>
                  <span className="lead-sub tiny">linkedin.com/in/{slug}</span>
                </span>
                {r.alreadyLead ? (
                  <span className="badge badge-plain">Já é lead</span>
                ) : (
                  <a
                    href={r.linkedinProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="icon-btn icon-btn-round"
                    style={{ width: 34, height: 34 }}
                    aria-label={`Abrir perfil de ${firstName}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconExternal size={15} />
                  </a>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {newResults.length > 0 && (
        <div className="sticky-cta stack" style={{ gap: 10, padding: "12px 18px 18px", background: "var(--surface)" }}>
          {inviteState?.error && (
            <p className="error-text">
              <IconAlert size={15} /> {inviteState.error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={handleInvite}
            disabled={inviting || selectedResults.length === 0}
          >
            {inviting ? (
              <>
                <span className="spinner" /> Agendando convites…
              </>
            ) : selectedResults.length === 0 ? (
              "Selecione ao menos 1 pessoa"
            ) : (
              <>
                <IconUserPlus size={19} />
                Convidar {selectedResults.length} pessoa{selectedResults.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

export function ProspectSearch() {
  const [state, formAction, parsing] = useActionState(parseProfiles, undefined);
  const [raw, setRaw] = useState("");
  const [clipboardError, setClipboardError] = useState(false);

  const detected = useMemo(() => {
    const urls = new Set<string>();
    for (const token of raw.split(/\s+/)) {
      const normalized = normalizeLinkedinUrl(token);
      if (normalized) urls.add(normalized);
    }
    return urls.size;
  }, [raw]);

  async function pasteFromClipboard() {
    setClipboardError(false);
    try {
      const text = await navigator.clipboard.readText();
      setRaw((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    } catch {
      setClipboardError(true);
    }
  }

  const hasResults = Boolean(state && !state.error);

  return (
    <>
      <LinkedinSearchLink />

      <section className="card card-pad step rise" style={{ "--i": 2 } as React.CSSProperties}>
        <StepHeader n={2} title="Cole os perfis escolhidos" subtitle="Um link por linha — pode colar vários de uma vez." done={hasResults} />
        <form action={formAction} className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 10 }}>
            <textarea
              name="urls"
              rows={4}
              className="textarea"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"https://www.linkedin.com/in/fulano\nhttps://www.linkedin.com/in/ciclana"}
              aria-label="Links dos perfis"
              style={{ fontSize: 14.5 }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className={`badge ${detected > 0 ? "badge-open" : "badge-plain"}`}>
                {detected} perfi{detected !== 1 ? "s" : "l"} detectado{detected !== 1 ? "s" : ""}
              </span>
              <button type="button" className="btn btn-soft btn-sm" onClick={pasteFromClipboard}>
                <IconClipboard size={15} /> Colar
              </button>
            </div>
          </div>
          {clipboardError && <p className="hint">Não foi possível ler a área de transferência — cole manualmente no campo.</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={parsing || raw.trim() === ""}>
            {parsing ? (
              <>
                <span className="spinner" /> Verificando…
              </>
            ) : (
              "Verificar perfis"
            )}
          </button>
          {state?.error && (
            <p className="error-text">
              <IconAlert size={15} /> {state.error}
            </p>
          )}
        </form>
      </section>

      {state && !state.error && <ProspectResults key={state.parseId} results={state.results} />}
    </>
  );
}
