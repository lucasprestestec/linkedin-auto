import Link from "next/link";
import type { ConvItem } from "@/lib/conversations";
import { STATUS_LABEL } from "@/lib/status";
import { Avatar } from "./Avatar";

function preview(c: ConvItem): string {
  if (c.status === "NEEDS_HUMAN" && c.needsHumanReason) return c.needsHumanReason;
  if (c.lastMessage) return `${c.lastMessage.sender === "AGENT" ? "Secretária: " : c.lastMessage.sender === "HUMAN" ? "Você: " : ""}${c.lastMessage.content}`;
  return c.status === "INVITE_SENT" ? "Aguardando aceite do convite" : "Conexão aceita";
}

// Uma conversa na lista: avatar, nome, prévia, etiqueta de situação e há quanto tempo.
export function ConversationRow({ c, active }: { c: ConvItem; active?: boolean }) {
  const needsYou = c.status === "NEEDS_HUMAN" || (c.unanswered && c.status !== "LOST");
  const pill = c.status === "NEEDS_HUMAN" ? "pill-danger" : needsYou ? "pill-warn" : c.status === "QUALIFIED" || c.status === "MEETING_SCHEDULED" ? "pill-ok" : "";
  const label = c.status === "NEEDS_HUMAN" ? "Precisa de você" : needsYou ? "Responder" : STATUS_LABEL[c.status];
  return (
    <Link href={`/leads/${c.id}`} className="item" aria-current={active ? "page" : undefined}>
      <Avatar firstName={c.firstName} lastName={c.lastName} size={44} />
      <span className="item-main">
        <span className="item-title">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "Contato"}</span>
        <span className="item-sub">{preview(c)}</span>
      </span>
      <span className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
        <span className="item-meta">{c.when}</span>
        <span className={`pill ${pill}`}>{label}</span>
      </span>
    </Link>
  );
}
