import Link from "next/link";
import type { ConvItem } from "@/lib/conversations";
import { STATUS_TONE } from "@/lib/status";
import { Avatar } from "./Avatar";
import { IconChevronRight } from "./Icons";

function preview(c: ConvItem): React.ReactNode {
  if (c.status === "NEEDS_HUMAN" && c.needsHumanReason) return c.needsHumanReason;
  if (c.lastMessage) {
    return (
      <>
        {c.lastMessage.sender !== "LEAD" && <b>{c.lastMessage.sender === "AGENT" ? "IA: " : "Você: "}</b>}
        {c.lastMessage.content}
      </>
    );
  }
  return c.status === "INVITE_SENT" ? "Aguardando aceite do convite" : "Conexão aceita · a IA vai abrir a conversa";
}

// Uma conversa numa lista: avatar, nome, cargo · empresa, prévia e o ponto de status.
export function ConversationRow({ c, active, withReply }: { c: ConvItem; active?: boolean; withReply?: boolean }) {
  const tone = STATUS_TONE[c.status];
  const sub = [c.role, c.company].filter(Boolean).join(" · ");
  return (
    <Link href={`/leads/${c.id}`} className={`row-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <Avatar firstName={c.firstName} lastName={c.lastName} size={46} status={tone} />
      <span className="row-main">
        <span className="row-top">
          <span className="row-name">
            {c.firstName} {c.lastName}
          </span>
          {!withReply && <span className="row-time">{c.when}</span>}
        </span>
        {sub && <span className="row-sub">{sub}</span>}
        <span className={`row-preview${c.status === "NEEDS_HUMAN" ? " urgent" : ""}`}>{preview(c)}</span>
      </span>
      {withReply ? (
        <span className="row-side">
          <span className="row-time">{c.when}</span>
          <span className="reply-btn">Responder</span>
          <span className={`status-dot dot-${tone} only-mobile`} />
        </span>
      ) : (
        <span className={`status-dot dot-${tone}`} />
      )}
      {withReply && <IconChevronRight size={16} className="faint only-desktop" />}
    </Link>
  );
}
