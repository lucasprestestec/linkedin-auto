"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { inviteFound, type FoundResult } from "./actions";
import { InviteSheet, SelectionBar } from "./InviteSheet";

const GOOD_FIT = 60;

// Resultado da busca pelo Google: marca quem quer e, no fim, escolhe a campanha.
export function FoundPeople({
  people,
  hasMore,
  loadingMore,
  onLoadMore,
  left,
}: {
  people: FoundResult[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  left: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLead = (p: FoundResult) => p.alreadyLead || invited.has(p.linkedinProfileUrl);
  const available = people.filter((p) => !isLead(p) && !p.excluded);
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

  function finishInvite() {
    setInvited((prev) => new Set([...prev, ...chosen.map((p) => p.linkedinProfileUrl)]));
    setSelected(new Set());
  }

  return (
    <section className="sec" aria-label="Pessoas encontradas">
      <div className="sec-head">
        <div className="setting-text">
          <h2 className="t-label">
            {people.length} pessoa{people.length !== 1 ? "s" : ""} encontrada{people.length !== 1 ? "s" : ""}
          </h2>
          <small>
            {chosen.length} selecionada{chosen.length !== 1 ? "s" : ""} · {left} busca{left !== 1 ? "s" : ""} grátis restante{left !== 1 ? "s" : ""} no mês
          </small>
        </div>
        {available.length > 1 && (
          <button
            type="button"
            className="btn-text"
            onClick={() => setSelected(allSelected ? new Set() : new Set(available.map((p) => p.linkedinProfileUrl)))}
          >
            {allSelected ? "Limpar" : "Selecionar todos"}
          </button>
        )}
      </div>

      {people.length === 0 ? (
        <p className="empty">Nenhum perfil encontrado com esses filtros. Tente menos filtros ou outros termos.</p>
      ) : (
        <ul className="list">
          {people.map((p) => {
            const blocked = isLead(p) || p.excluded;
            const tone = p.icpScore == null ? "" : p.icpScore >= 80 ? "pill-ok" : p.icpScore >= GOOD_FIT ? "pill-accent" : "";
            return (
              <li key={p.linkedinProfileUrl}>
                <label className={`item pick${blocked ? " blocked" : ""}`}>
                  {!blocked ? (
                    <input type="checkbox" checked={selected.has(p.linkedinProfileUrl)} onChange={() => toggle(p.linkedinProfileUrl)} />
                  ) : (
                    <span style={{ width: 18, flex: "none" }} />
                  )}
                  <Avatar firstName={p.firstName} lastName={p.lastName} size={40} />
                  <span className="item-main">
                    <span className="item-title">
                      {p.firstName} {p.lastName}
                    </span>
                    {p.headline && <span className="item-sub">{p.headline}</span>}
                    {p.snippet && <span className="hint" style={{ margin: 0 }}>{p.snippet}</span>}
                  </span>
                  {blocked ? (
                    <span className="pill">{invited.has(p.linkedinProfileUrl) ? "Convidado agora" : p.alreadyLead ? "Já é contato" : "Nunca contatar"}</span>
                  ) : (
                    p.icpScore != null && (
                      <span className={`pill ${tone}`} title={p.icpReason ?? undefined}>
                        {p.icpScore}% de encaixe
                      </span>
                    )
                  )}
                  <a
                    href={p.linkedinProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-text tiny"
                    aria-label={`Abrir perfil de ${p.firstName} no LinkedIn`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Perfil
                  </a>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <button type="button" className="btn-line btn-block" onClick={onLoadMore} disabled={loadingMore || left <= 0}>
          {loadingMore ? "Buscando mais…" : left <= 0 ? "Buscas do mês acabaram" : "Carregar mais pessoas"}
        </button>
      )}

      <SelectionBar count={chosen.length} onContinue={() => setSheetOpen(true)} />
      {sheetOpen && (
        <InviteSheet
          count={chosen.length}
          onInvite={(campaignId) => inviteFound(chosen, campaignId)}
          onClose={() => setSheetOpen(false)}
          onDone={finishInvite}
        />
      )}
    </section>
  );
}
