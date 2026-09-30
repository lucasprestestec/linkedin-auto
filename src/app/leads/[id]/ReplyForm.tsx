"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { sendReply, suggestLeadReply } from "./actions";

type Channel = "LINKEDIN" | "EMAIL" | "WHATSAPP";
const LABEL: Record<Channel, string> = { LINKEDIN: "LinkedIn", EMAIL: "E-mail", WHATSAPP: "WhatsApp" };

export function ReplyForm({
  leadId,
  firstName,
  channels = ["LINKEDIN"],
  defaultChannel = "LINKEDIN",
}: {
  leadId: string;
  firstName: string;
  profileUrl?: string | null;
  // Canais possíveis com essa pessoa; começa no último em que ela escreveu.
  channels?: Channel[];
  defaultChannel?: Channel;
}) {
  const [value, setValue] = useState("");
  const [channel, setChannel] = useState<Channel>(channels.includes(defaultChannel) ? defaultChannel : channels[0]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [state, formAction, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const result = await sendReply(leadId, prev, formData);
      if (!result.error) setValue("");
      return result;
    },
    undefined,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cresce junto com o texto, até o limite do CSS.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Como todo app de chat, abre já na mensagem mais recente.
  useEffect(() => {
    document.getElementById("thread-end")?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    if (state && !state.error) document.getElementById("thread-end")?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state]);

  // Rascunho do assistente: preenche o campo pra você revisar. Nada é enviado sozinho.
  function suggest() {
    setSuggestError(null);
    startSuggest(async () => {
      const result = await suggestLeadReply(leadId, channel);
      if (result.text) {
        setValue(result.text);
        textareaRef.current?.focus();
      } else setSuggestError(result.error ?? "Não foi possível sugerir.");
    });
  }

  const canSend = value.trim() !== "" && !pending;
  const error = state?.error ?? suggestError;

  return (
    <form action={formAction} className="composer">
      <input type="hidden" name="channel" value={channel} />
      {error && <p className="field-error composer-meta">{error}</p>}
      <div className="composer-row">
        <textarea
          ref={textareaRef}
          id="reply-box"
          name="content"
          placeholder={channel === "EMAIL" ? `E-mail para ${firstName}` : channel === "WHATSAPP" ? `WhatsApp para ${firstName}` : `Mensagem para ${firstName}`}
          aria-label="Mensagem"
          required
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn-solid" disabled={!canSend}>
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      <div className="composer-meta">
        {channels.length > 1 && (
          <span className="row" style={{ gap: 12 }} role="radiogroup" aria-label="Enviar por">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={channel === c}
                className="btn-text"
                style={{ color: channel === c ? "var(--text)" : "var(--text-3)", fontWeight: channel === c ? 600 : 400 }}
                onClick={() => setChannel(c)}
              >
                {LABEL[c]}
              </button>
            ))}
          </span>
        )}
        <button type="button" className="btn-text" style={{ marginLeft: "auto" }} onClick={suggest} disabled={suggesting}>
          {suggesting ? "Escrevendo…" : "Sugerir resposta"}
        </button>
      </div>
    </form>
  );
}
