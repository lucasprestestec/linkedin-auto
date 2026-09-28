"use client";

import Link from "next/link";
import { useState } from "react";
import type { ConvItem } from "@/lib/conversations";
import { STATUS_TONE } from "@/lib/status";
import { Avatar } from "@/components/Avatar";
import { IconArrowRight, IconChevronRight, IconInbox, IconPlus } from "@/components/Icons";

const TABS = [
  { key: "all", label: "Todas", test: () => true },
  { key: "unanswered", label: "Não respondidas", test: (c: ConvItem) => c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST") },
  { key: "replied", label: "Respondidas", test: (c: ConvItem) => c.replied },
  { key: "waiting", label: "Aguardando", test: (c: ConvItem) => c.status === "WAITING_REPLY" || c.status === "INVITE_SENT" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const LIMIT = 8;

function preview(c: ConvItem) {
  if (c.status === "NEEDS_HUMAN" && c.needsHumanReason) return c.needsHumanReason;
  if (c.lastMessage) return `${c.lastMessage.sender === "AGENT" ? "IA: " : c.lastMessage.sender === "HUMAN" ? "Você: " : ""}${c.lastMessage.content}`;
  return c.status === "INVITE_SENT" ? "Aguardando aceite do convite" : "Conexão aceita · a IA vai abrir a conversa";
}

// Painel de conversas da tela inicial: abas no topo e uma linha por conversa
// (nome e cargo à esquerda, última mensagem no meio, tempo e ação à direita).
export function HomeConversations({ items }: { items: ConvItem[] }) {
  const [tab, setTab] = useState<TabKey>("all");
  const test = TABS.find((t) => t.key === tab)!.test;
  const visible = items.filter(test);
  const unanswered = items.filter(TABS[1].test).length;

  return (
    <section className="panel conv-panel" aria-labelledby="home-conv-title">
      <div className="panel-head">
        <h2 id="home-conv-title">
          Conversas <span className="count-pill">{items.length}</span>
        </h2>
        <div className="panel-tabs" role="tablist" aria-label="Filtrar conversas">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === "unanswered" && unanswered > 0 && <span className="tab-badge">{unanswered}</span>}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel-empty">
          <IconInbox size={20} />
          <span>{items.length === 0 ? "Nenhuma conversa ainda." : "Nada por aqui agora."}</span>
          {items.length === 0 && (
            <Link href="/prospect" className="btn btn-gold btn-sm">
              <IconPlus size={16} /> Adicionar pessoas
            </Link>
          )}
        </div>
      ) : (
        <ul className="lux-rows">
          {visible.slice(0, LIMIT).map((c) => {
            const needsYou = c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST");
            return (
              <li key={c.id}>
                <Link href={`/leads/${c.id}`} className={`lux-row${needsYou ? " hot" : ""}`}>
                  <span className={`lux-dot dot-${STATUS_TONE[c.status]}`} aria-hidden />
                  <Avatar firstName={c.firstName} lastName={c.lastName} size={44} />
                  <span className="lux-who">
                    <b>
                      {c.firstName} {c.lastName}
                    </b>
                    <small>{[c.role, c.company].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="lux-msg">{preview(c)}</span>
                  <span className="lux-side">
                    <small>{c.when}</small>
                    {needsYou ? (
                      <span className="lux-tag hot">Responder</span>
                    ) : c.status === "QUALIFIED" ? (
                      <span className="lux-tag opp">Oportunidade</span>
                    ) : null}
                  </span>
                  <IconChevronRight size={18} className="lux-chev" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > LIMIT && (
        <Link href={tab === "unanswered" ? "/conversations?status=urgent" : "/conversations"} className="panel-more">
          Ver todas as {visible.length} <IconArrowRight size={15} />
        </Link>
      )}
    </section>
  );
}
