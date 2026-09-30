"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { parseProfiles, invite, searchPeople, type FoundResult } from "./actions";
import type { PeopleSearchFilters } from "@/lib/linkedin";
import { FoundPeople } from "./FoundPeople";
import type { ProspectResult } from "@/lib/prospect";
import { normalizeLinkedinUrl } from "@/lib/linkedin";
import { nameFromProfileUrl } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PeopleSearchBuilder } from "./PeopleSearchBuilder";
import { InviteSheet, SelectionBar } from "./InviteSheet";

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="setting-text">
      <h2 className="t-label">{title}</h2>
      <small>{subtitle}</small>
    </div>
  );
}

function LinkedinSearchStep({ initialKeywords }: { initialKeywords: string[] }) {
  return (
    <section id="search-step" className="sec" style={{ scrollMarginTop: 16 }}>
      <StepHeader title="Encontre pessoas" subtitle="Monte a busca com os filtros que quiser. É grátis, direto no LinkedIn." />
      <PeopleSearchBuilder initialKeywords={initialKeywords} />
      <p className="hint">Abre numa aba nova. Escolha quem quiser e copie o link do perfil de cada pessoa.</p>
    </section>
  );
}

function ProspectResults({ results }: { results: ProspectResult[] }) {
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const isLead = (r: ProspectResult) => r.alreadyLead || invited.has(r.linkedinProfileUrl);
  const newResults = results.filter((r) => !isLead(r) && !r.excluded);
  const [selected, setSelected] = useState<Set<string>>(new Set(newResults.map((r) => r.linkedinProfileUrl)));

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

  function finishInvite() {
    setInvited((prev) => new Set([...prev, ...selectedResults.map((r) => r.linkedinProfileUrl)]));
    setSelected(new Set());
  }

  return (
    <section className="sec">
      <div className="sec-head">
        <StepHeader
          title="Marque quem convidar"
          subtitle={`${results.length} perfi${results.length !== 1 ? "s" : "l"} reconhecido${results.length !== 1 ? "s" : ""}${
            results.length > newResults.length ? ` · ${results.length - newResults.length} não podem ser convidados` : ""
          }`}
        />
        {newResults.length > 1 && (
          <button type="button" className="btn-text" onClick={toggleAll}>
            {allSelected ? "Limpar" : "Selecionar todos"}
          </button>
        )}
      </div>

      <ul className="list">
        {results.map((r) => {
          const { firstName, lastName, slug } = nameFromProfileUrl(r.linkedinProfileUrl);
          const blocked = isLead(r) || r.excluded;
          return (
            <li key={r.linkedinProfileUrl}>
              <label className={`item pick${blocked ? " blocked" : ""}`}>
                {!blocked ? (
                  <input type="checkbox" checked={selected.has(r.linkedinProfileUrl)} onChange={() => toggle(r.linkedinProfileUrl)} />
                ) : (
                  <span style={{ width: 18, flex: "none" }} />
                )}
                <Avatar firstName={firstName} lastName={lastName} size={40} />
                <span className="item-main">
                  <span className="item-title">
                    {firstName} {lastName}
                  </span>
                  <span className="item-sub">linkedin.com/in/{slug}</span>
                </span>
                {blocked ? (
                  <span className="pill">{invited.has(r.linkedinProfileUrl) ? "Convidado agora" : r.alreadyLead ? "Já é contato" : "Nunca contatar"}</span>
                ) : (
                  <a
                    href={r.linkedinProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-text tiny"
                    aria-label={`Abrir perfil de ${firstName}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Perfil
                  </a>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <SelectionBar count={selectedResults.length} onContinue={() => setSheetOpen(true)} />
      {sheetOpen && (
        <InviteSheet
          count={selectedResults.length}
          onInvite={(campaignId) => invite(selectedResults, campaignId)}
          onClose={() => setSheetOpen(false)}
          onDone={finishInvite}
        />
      )}
    </section>
  );
}

const RECENT_KEY = "prospect:recent-searches";

function readRecent(): PeopleSearchFilters[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(f: PeopleSearchFilters) {
  try {
    const key = JSON.stringify(f);
    const next = [f, ...readRecent().filter((r) => JSON.stringify(r) !== key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function recentLabel(f: PeopleSearchFilters) {
  const parts = [f.titles, f.locations, f.companies, f.industries, f.keywords, f.firstNames, f.lastNames, f.schools]
    .filter((v) => v.length > 0)
    .map((v) => v.join(" / "));
  return parts.join(" · ");
}

// Com a busca pelo Google configurada: filtros, "Buscar pessoas" e lista aqui
// mesmo, com caixinhas. Buscas recentes repetem a leva de ontem num toque.
// Colar links fica como alternativa recolhida.
function GoogleSearchFlow({ initialKeywords, searchesLeft }: { initialKeywords: string[]; searchesLeft: number }) {
  const [filters, setFilters] = useState<PeopleSearchFilters | null>(null);
  const [people, setPeople] = useState<FoundResult[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [left, setLeft] = useState(searchesLeft);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<PeopleSearchFilters[]>([]);
  const [builder, setBuilder] = useState<{ key: number; filters?: PeopleSearchFilters }>({ key: 0 });
  const [searching, startSearch] = useTransition();
  const [loadingMore, startMore] = useTransition();

  // localStorage só existe no navegador: lê depois de montar.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRecent(readRecent()), []);

  function run(f: PeopleSearchFilters) {
    setError(null);
    startSearch(async () => {
      const r = await searchPeople(f, 0);
      if (!r.ok) return setError(r.error);
      setFilters(f);
      setPeople(r.people);
      setPage(0);
      setHasMore(r.hasMore);
      setLeft(r.left);
      const next = saveRecent(f);
      if (next) setRecent(next);
      requestAnimationFrame(() => document.getElementById("found-people")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  function repeat(f: PeopleSearchFilters) {
    setBuilder((b) => ({ key: b.key + 1, filters: f }));
    run(f);
  }

  function more() {
    if (!filters) return;
    startMore(async () => {
      const r = await searchPeople(filters, page + 1);
      if (!r.ok) return setError(r.error);
      setPeople((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.linkedinProfileUrl));
        return [...(prev ?? []), ...r.people.filter((p) => !seen.has(p.linkedinProfileUrl))];
      });
      setPage(page + 1);
      setHasMore(r.hasMore);
      setLeft(r.left);
    });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {recent.length > 0 && (
        <section className="stack" style={{ gap: 8 }} aria-label="Buscas recentes">
          <span className="label" style={{ margin: 0 }}>Repetir uma busca</span>
          <div className="tabs" style={{ flexWrap: "wrap" }}>
            {recent.map((f) => (
              <button key={JSON.stringify(f)} type="button" disabled={searching || left <= 0} onClick={() => repeat(f)}>
                {recentLabel(f)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="search-step" className="sec" style={{ scrollMarginTop: 16 }}>
        <StepHeader title="Quem você procura?" subtitle="Preencha os filtros e toque em Buscar. As pessoas aparecem aqui mesmo." />
        <PeopleSearchBuilder key={builder.key} initialKeywords={initialKeywords} initialFilters={builder.filters} onSearch={run} searching={searching} />
        {left <= 0 && <p className="hint">As buscas grátis deste mês acabaram. Voltam no dia 1º. Até lá, use &ldquo;abrir no LinkedIn&rdquo;.</p>}
        {error && <p className="field-error">{error}</p>}
      </section>

      <div id="found-people" style={{ scrollMarginTop: 16 }}>
        {people && <FoundPeople key={JSON.stringify(filters)} people={people} hasMore={hasMore} loadingMore={loadingMore} onLoadMore={more} left={left} />}
      </div>

      <details className="sec h-fold">
        <summary>Já tem os links dos perfis? Cole aqui</summary>
        <PasteFlow />
      </details>
    </div>
  );
}

export function ProspectSearch({
  initialKeywords = [],
  searchEnabled = false,
  searchesLeft = 0,
}: {
  initialKeywords?: string[];
  searchEnabled?: boolean;
  searchesLeft?: number;
}) {
  if (searchEnabled) return <GoogleSearchFlow initialKeywords={initialKeywords} searchesLeft={searchesLeft} />;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <LinkedinSearchStep initialKeywords={initialKeywords} />
      <PasteFlow numbered />
    </div>
  );
}

// Colar links de perfis (um por linha), revisar e convidar.
function PasteFlow({ numbered = false }: { numbered?: boolean }) {
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

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section id="paste-step" className={numbered ? "sec" : "stack"} style={{ scrollMarginTop: 16 }}>
        {numbered && <StepHeader title="Cole os perfis escolhidos" subtitle="Um link por linha. Pode colar vários de uma vez." />}
        <form action={formAction} className="stack" style={{ gap: 12 }}>
          <textarea
            name="urls"
            rows={4}
            className="field"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"https://www.linkedin.com/in/fulano\nhttps://www.linkedin.com/in/ciclana"}
            aria-label="Links dos perfis"
          />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className={`pill ${detected > 0 ? "pill-accent" : ""}`}>
              {detected} perfi{detected !== 1 ? "s" : "l"} detectado{detected !== 1 ? "s" : ""}
            </span>
            <button type="button" className="btn-text" onClick={pasteFromClipboard}>
              Colar
            </button>
          </div>
          {clipboardError && <p className="hint">Não foi possível ler a área de transferência. Cole manualmente no campo.</p>}
          <button type="submit" className="btn-solid" disabled={parsing || raw.trim() === ""}>
            {parsing ? "Verificando…" : "Verificar perfis"}
          </button>
          {state?.error && <p className="field-error">{state.error}</p>}
        </form>
      </section>

      {state && !state.error && <ProspectResults key={state.parseId} results={state.results} />}
    </div>
  );
}
