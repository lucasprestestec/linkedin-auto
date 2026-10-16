import Link from "next/link";
import type { ConvItem } from "@/lib/conversations";
import { STATUS_LABEL } from "@/lib/status";
import { tagTone } from "@/lib/tagTone";
import { Avatar } from "./Avatar";

function preview(c: ConvItem): string {
  if (c.hasDraft) return "Rascunho pronto para aprovar";
  if (c.status === "NEEDS_HUMAN" && c.needsHumanReason) return c.needsHumanReason;
  if (c.lastMessage) return `${c.lastMessage.sender === "AGENT" ? "Assistente: " : c.lastMessage.sender === "HUMAN" ? "Você: " : ""}${c.lastMessage.content}`;
  if (c.status === "NEW") return "Novo contato, ainda sem mensagem";
  return c.status === "INVITE_SENT" ? "Aguardando aceite do convite" : "Conexão aceita";
}

// O que fazer com esta conversa (e não só em que situação ela está). Sem ação a fazer, aparece há quanto tempo.
export function statusPill(c: ConvItem): { label: string; cls: string } | null {
  if (c.hasDraft) return { label: "Aprovar", cls: "tg-you" };
  if (c.status === "NEEDS_HUMAN") return { label: "Com você", cls: "tg-you" };
  if (c.unanswered && c.status !== "LOST" && c.status !== "QUALIFIED" && c.status !== "MEETING_SCHEDULED") return { label: "Responder", cls: "tg-you" };
  if (c.status === "MEETING_SCHEDULED") return { label: "Reunião", cls: "tg-ok" };
  if (c.status === "QUALIFIED") return { label: STATUS_LABEL[c.status], cls: "tg-ok" };
  return null;
}

function fullName(c: ConvItem) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Contato";
}

// Uma conversa na lista: rosto com o selo do canal, nome, prévia, etiquetas e o que fazer (ou há quanto tempo).
export function ConversationRow({ c, active }: { c: ConvItem; active?: boolean }) {
  const action = statusPill(c);
  const tags = c.tags.slice(0, 2);
  return (
    <Link href={`/leads/${c.id}`} className="c-item" aria-current={active ? "true" : undefined}>
      <Avatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.avatarUrl} channel={c.channel} size={40} />
      <span className="c-txt">
        <b>{fullName(c)}</b>
        <span className="pv">{preview(c)}</span>
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
      {action ? <span className={`tg ${action.cls}`}>{action.label}</span> : <span className="tg tg-q">{c.when}</span>}
    </Link>
  );
}

// Cartão do quadro (kanban): cabe numa coluna estreita.
export function ConversationCard({ c }: { c: ConvItem }) {
  return (
    <Link href={`/leads/${c.id}`} className="kcard">
      <Avatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.avatarUrl} channel={c.channel} size={32} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="truncate" style={{ display: "block" }}>
          {fullName(c)}
        </span>
        <small>{c.when}</small>
      </span>
    </Link>
  );
}
