"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { IconAlert, IconCheck, IconX } from "@/components/Icons";
import { approve, discard } from "./actions";

export interface ApprovalItem {
  id: string;
  leadId: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  channel: string;
  kind: string;
  subject: string | null;
  content: string;
  reason: string | null;
  when: string;
}

// Uma mensagem que a secretária quer mandar. O texto é editável: mexer nele
// também conta como aprovação (e fica registrado que você ajustou).
export function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [text, setText] = useState(item.content);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Lead";
  const changed = text.trim() !== item.content.trim();

  function send() {
    startTransition(async () => {
      const r = await approve(item.id, text);
      if ("error" in r) setNotice({ tone: "error", text: r.error });
      else setNotice({ tone: "ok", text: r.status === "waiting" ? "Aprovada. Sai quando o horário de trabalho abrir." : "Enviada." });
    });
  }

  function drop() {
    if (!window.confirm(`Descartar? A conversa com ${name} passa a ser sua.`)) return;
    startTransition(async () => {
      const r = await discard(item.id);
      if (r.error) setNotice({ tone: "error", text: r.error });
    });
  }

  return (
    <article className="panel approval-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <Avatar firstName={item.firstName} lastName={item.lastName} size={40} />
        <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
          <Link href={`/leads/${item.leadId}`} style={{ fontWeight: 600 }}>
            {name}
          </Link>
          <span className="small muted">
            {item.kind} · {item.channel} · {item.when}
            {item.jobTitle ? ` · ${item.jobTitle}` : ""}
          </span>
        </div>
      </div>

      {item.subject && (
        <p className="small muted" style={{ margin: 0 }}>
          Assunto: {item.subject}
        </p>
      )}
      <textarea className="input" rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))} value={text} onChange={(e) => setText(e.target.value)} disabled={pending} aria-label={`Mensagem para ${name}`} />
      {item.reason && <p className="small muted" style={{ margin: 0 }}>Por quê: {item.reason}</p>}

      {notice && (
        <p className={`small${notice.tone === "error" ? " error" : ""}`} style={{ margin: 0 }} role="status">
          {notice.tone === "error" ? <IconAlert size={14} /> : <IconCheck size={14} />} {notice.text}
        </p>
      )}

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-pill" onClick={send} disabled={pending || !text.trim()}>
          {pending ? <span className="spinner" /> : <IconCheck size={18} />} {changed ? "Enviar com meu ajuste" : "Enviar"}
        </button>
        <button type="button" className="btn btn-secondary btn-pill" onClick={drop} disabled={pending}>
          <IconX size={18} /> Descartar
        </button>
      </div>
    </article>
  );
}
