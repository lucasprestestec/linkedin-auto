import Link from "next/link";
import type { ConvItem } from "@/lib/conversations";
import { STATUS_LABEL } from "@/lib/status";
import { tagTone } from "@/lib/tagTone";
import { Avatar } from "./Avatar";
import { ChannelBadge } from "./ChannelBadge";

function preview(c: ConvItem): string {
  if (c.status === "NEEDS_HUMAN" && c.needsHumanReason) return c.needsHumanReason;
  if (c.lastMessage) return `${c.lastMessage.sender === "AGENT" ? "Assistente: " : c.lastMessage.sender === "HUMAN" ? "Você: " : ""}${c.lastMessage.content}`;
  return c.status === "INVITE_SENT" ? "Aguardando aceite do convite" : "Conexão aceita";
}

// Situação e cor da conversa (a mesma que agrupa a lista e as colunas do quadro).
export function statusPill(c: ConvItem): { label: string; pill: string } {
  const needsYou = c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST");
  const pill = c.status === "NEEDS_HUMAN" ? "pill-danger" : needsYou ? "pill-warn" : c.status === "QUALIFIED" || c.status === "MEETING_SCHEDULED" ? "pill-ok" : "";
  const label = c.status === "NEEDS_HUMAN" ? "Precisa de você" : needsYou ? "Responder" : STATUS_LABEL[c.status];
  return { label, pill };
}

function fullName(c: ConvItem) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Contato";
}

// Uma conversa na lista: avatar, nome com o ícone do canal, prévia, etiquetas coloridas, situação e há quanto tempo.
export function ConversationRow({ c, active }: { c: ConvItem; active?: boolean }) {
  const { label, pill } = statusPill(c);
  const tags = c.tags.slice(0, 2);
  return (
    <Link href={`/leads/${c.id}`} className="item cv-row" aria-current={active ? "page" : undefined}>
      <Avatar firstName={c.firstName} lastName={c.lastName} size={40} />
      <span className="item-main">
        <span className="cv-name">
          <span className="item-title">{fullName(c)}</span>
          {c.channel && <ChannelBadge channel={c.channel} size={18} />}
        </span>
        <span className="item-sub">{preview(c)}</span>
        {tags.length > 0 && (
          <span className="cv-tags">
            {tags.map((t) => (
              <span key={t} className={`cv-tag tone-${tagTone(t)}`}>
                {t}
              </span>
            ))}
            {c.tags.length > 2 && <span className="cv-tag tone-neutral">+{c.tags.length - 2}</span>}
          </span>
        )}
      </span>
      <span className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
        <span className="item-meta">{c.when}</span>
        <span className={`pill ${pill}`}>{label}</span>
      </span>
    </Link>
  );
}

// Cartão do quadro (kanban): cabe numa coluna estreita.
export function ConversationCard({ c }: { c: ConvItem }) {
  const tags = c.tags.slice(0, 2);
  return (
    <Link href={`/leads/${c.id}`} className="kb-card">
      <span className="cv-name">
        <Avatar firstName={c.firstName} lastName={c.lastName} size={28} />
        <span className="item-title">{fullName(c)}</span>
        {c.channel && <ChannelBadge channel={c.channel} size={18} />}
      </span>
      <span className="item-sub kb-sub">{preview(c)}</span>
      <span className="kb-foot">
        <span className="cv-tags">
          {tags.map((t) => (
            <span key={t} className={`cv-tag tone-${tagTone(t)}`}>
              {t}
            </span>
          ))}
        </span>
        <span className="item-meta">{c.when}</span>
      </span>
    </Link>
  );
}
