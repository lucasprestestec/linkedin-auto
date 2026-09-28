"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { IconAlert, IconCheck, IconExternal, IconUserPlus } from "@/components/Icons";
import { inviteFound, type FoundResult, type InviteState } from "./actions";

const GOOD_FIT = 60;

// Resultado da busca pelo Google: marca quem quer e convida, sem sair do sistema.
export function FoundPeople({
  people,
  hasMore,
  loadingMore,
  onLoadMore,
  campaignId,
  left,
}: {
  people: FoundResult[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  campaignId?: string;
  left: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [inviting, startInvite] = useTransition();

  const available = people.filter((p) => !p.alreadyLead && !p.excluded);
  const chosen = available.filter((p) => selected.has(p.linkedinProfileUrl));
  const allSelected = available.length > 0 && chosen.length === available.length;

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
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
          Os convites saem ao longo do dia. Quem aceitar aparece em Conversas, e a IA começa a conversa.
        </p>
        {inviteState.skippedForLimit > 0 && (
          <span className="badge badge-invite" style={{ marginTop: 6 }}>
            {inviteState.skippedForLimit} ficaram de fora pelo limite diário
          </span>
        )}
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setInviteState(undefined)}>
          Voltar aos resultados
        </button>
      </section>
    );
  }

  return (
    <section className="card found" aria-label="Pessoas encontradas">
      <div className="found-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2 className="title-md">
            {people.length} pessoa{people.length !== 1 ? "s" : ""} encontrada{people.length !== 1 ? "s" : ""}
          </h2>
          <span className="tiny faint">
            {chosen.length} selecionada{chosen.length !== 1 ? "s" : ""} · {left} busca{left !== 1 ? "s" : ""} grátis restante{left !== 1 ? "s" : ""} no mês
          </span>
        </div>
        {available.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(available.map((p) => p.linkedinProfileUrl)))}
          >
            {allSelected ? "Limpar" : "Selecionar todos"}
          </button>
        )}
      </div>

      {people.length === 0 ? (
        <p className="empty-line" style={{ padding: "8px 18px 18px" }}>
          Nenhum perfil encontrado com esses filtros. Tente menos filtros ou outros termos.
        </p>
      ) : (
        <ul className="rows found-rows">
          {people.map((p) => {
            const blocked = p.alreadyLead || p.excluded;
            const tone = p.icpScore == null ? "" : p.icpScore >= 80 ? "badge-qualified" : p.icpScore >= GOOD_FIT ? "badge-open" : p.icpScore >= 40 ? "badge-invite" : "";
            return (
              <li key={p.linkedinProfileUrl}>
                <label className={`found-row${blocked ? " blocked" : ""}`}>
                  {!blocked ? (
                    <>
                      <input type="checkbox" checked={selected.has(p.linkedinProfileUrl)} onChange={() => toggle(p.linkedinProfileUrl)} />
                      <span className="checkbox">
                        <IconCheck size={15} strokeWidth={3.2} />
                      </span>
                    </>
                  ) : (
                    <span className="checkbox-space" />
                  )}
                  <Avatar firstName={p.firstName} lastName={p.lastName} size={42} />
                  <span className="row-main">
                    <span className="row-top">
                      <span className="row-name">
                        {p.firstName} {p.lastName}
                      </span>
                      {blocked ? (
                        <span className="badge badge-plain" style={{ height: 22, fontSize: 11 }}>
                          {p.alreadyLead ? "Já é lead" : "Nunca contatar"}
                        </span>
                      ) : (
                        p.icpScore != null && (
                          <span className={`badge badge-plain ${tone}`} style={{ height: 22, fontSize: 11, flexShrink: 0 }} title={p.icpReason ?? undefined}>
                            {p.icpScore}% encaixe
                          </span>
                        )
                      )}
                    </span>
                    {p.headline && <span className="row-sub found-headline">{p.headline}</span>}
                    {p.snippet && <span className="found-snippet">{p.snippet}</span>}
                  </span>
                  <a
                    href={p.linkedinProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kebab"
                    aria-label={`Abrir perfil de ${p.firstName} no LinkedIn`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconExternal size={15} />
                  </a>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div style={{ padding: "0 18px 12px" }}>
          <button type="button" className="btn btn-secondary btn-block" onClick={onLoadMore} disabled={loadingMore || left <= 0}>
            {loadingMore ? (
              <>
                <span className="spinner" /> Buscando mais…
              </>
            ) : left <= 0 ? (
              "Buscas do mês acabaram"
            ) : (
              "Carregar mais pessoas"
            )}
          </button>
        </div>
      )}

      {available.length > 0 && (
        <div className="sticky-cta stack" style={{ gap: 10, padding: "12px 18px 18px", background: "var(--surface)" }}>
          {inviteState?.error && (
            <p className="error-text">
              <IconAlert size={15} /> {inviteState.error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={inviting || chosen.length === 0}
            onClick={() => startInvite(async () => setInviteState(await inviteFound(chosen, campaignId)))}
          >
            {inviting ? (
              <>
                <span className="spinner" /> Agendando convites…
              </>
            ) : chosen.length === 0 ? (
              "Marque quem você quer convidar"
            ) : (
              <>
                <IconUserPlus size={19} /> Convidar {chosen.length} pessoa{chosen.length > 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
