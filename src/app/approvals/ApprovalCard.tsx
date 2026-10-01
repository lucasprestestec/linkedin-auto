"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { DRAFT_REASON_KEYS } from "@/lib/writingStyle";
import { approve, discard, markDraftFeedback, previewDraftAudio, setDraftAudio } from "./actions";

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
  asAudio: boolean;
  // A voz do usuario esta pronta e o servico de voz no ar: da pra mandar este rascunho em audio.
  canAudio: boolean;
  when: string;
}

// Uma mensagem que o assistente quer mandar. O texto é editável: mexer nele
// também conta como aprovação (e fica registrado que você ajustou).
export function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [text, setText] = useState(item.content);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [audio, setAudio] = useState(item.asAudio);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || "Contato";
  const changed = text.trim() !== item.content.trim();

  function send() {
    startTransition(async () => {
      const r = await approve(item.id, text);
      if ("error" in r) setNotice({ tone: "error", text: r.error });
      else setNotice({ tone: "ok", text: r.status === "waiting" ? "Aprovada. Sai quando o horário de trabalho abrir." : "Enviada." });
    });
  }

  function listen() {
    setNotice(null);
    startTransition(async () => {
      const r = await previewDraftAudio(item.id, text);
      if (r.error) setNotice({ tone: "error", text: r.error });
      else setAudioUrl(r.url ?? null);
    });
  }

  function switchAudio(on: boolean) {
    startTransition(async () => {
      const r = await setDraftAudio(item.id, on);
      if (r.error) setNotice({ tone: "error", text: r.error });
      else {
        setAudio(on);
        setAudioUrl(null);
      }
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
    <article className="card">
      <div className="row" style={{ gap: 12 }}>
        <Avatar firstName={item.firstName} lastName={item.lastName} size={44} />
        <div className="item-main">
          <Link href={`/leads/${item.leadId}`} className="item-title" style={{ textDecoration: "none" }}>
            {name}
          </Link>
          <span className="item-sub">{item.jobTitle ?? item.channel}</span>
        </div>
        <span className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
          <span className="item-meta">{item.when}</span>
          <span className="pill pill-accent">
            {item.kind} · {item.channel}
          </span>
        </span>
      </div>

      {item.subject && <p className="small muted">Assunto: {item.subject}</p>}
      <textarea
        className="field"
        rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        aria-label={`Mensagem para ${name}`}
      />
      {item.reason && <p className="hint" style={{ margin: 0 }}>Por que o assistente escreveu isso: {item.reason}</p>}

      {item.channel === "WhatsApp" && (audio || item.canAudio) && (
        <div className="note stack" style={{ gap: 8 }}>
          {audio ? (
            <>
              <b className="small">Vai sair como mensagem de voz, com a sua voz. O texto acima é o que será falado.</b>
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="button" className="btn-line btn-sm" onClick={listen} disabled={pending || !text.trim()}>
                  {pending ? "Gerando…" : audioUrl ? "Gerar de novo" : "Ouvir antes de enviar"}
                </button>
                <button type="button" className="btn-text" onClick={() => switchAudio(false)} disabled={pending}>
                  Enviar como texto
                </button>
              </div>
              {audioUrl && <audio controls src={audioUrl} style={{ width: "100%" }} />}
            </>
          ) : (
            <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
              <span className="small">Vai sair em texto.</span>
              <button type="button" className="btn-text" onClick={() => switchAudio(true)} disabled={pending}>
                Enviar como áudio
              </button>
            </div>
          )}
        </div>
      )}

      {notice && (
        <p className={notice.tone === "error" ? "field-error" : "ok-text"} role="status">
          {notice.text}
        </p>
      )}

      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn-solid" onClick={send} disabled={pending || !text.trim()}>
          {pending ? "Enviando…" : changed ? "Enviar com meu ajuste" : "Enviar"}
        </button>
        <button type="button" className="btn-line" onClick={drop} disabled={pending}>
          Descartar
        </button>
        {!feedbackOpen && (
          <button type="button" className="btn-text" onClick={() => setFeedbackOpen(true)} disabled={pending}>
            Não é meu jeito
          </button>
        )}
      </div>
      {feedbackOpen && (
        <FeedbackPanel
          reasonKeys={DRAFT_REASON_KEYS}
          title="O que não ficou com a sua cara?"
          placeholder="Se quiser, escreva como você teria dito (opcional)."
          onSubmit={(reasons, note) => markDraftFeedback(item.id, reasons, note)}
          onDone={() => setFeedbackOpen(false)}
        />
      )}
    </article>
  );
}
