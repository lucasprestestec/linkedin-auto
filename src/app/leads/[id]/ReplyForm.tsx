"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ChannelBadge, CHANNELS } from "@/components/ChannelBadge";
import { sendReply, suggestLeadReply } from "./actions";
import { useChannel } from "./ChannelContext";

// A resposta sai pelo canal que está aberto na conversa (o seletor de cima); aqui só se mostra qual é.
export function ReplyForm({ leadId, firstName }: { leadId: string; firstName: string }) {
  const [value, setValue] = useState("");
  const { channel, reply } = useChannel();
  const canUseChannel = reply.includes(channel);
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

  const canSend = value.trim() !== "" && !pending && canUseChannel;
  const error = state?.error ?? suggestError;

  return (
    <form action={formAction} className={`composer composer-${channel.toLowerCase()}`}>
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
        <span className="composer-via">
          <ChannelBadge channel={channel} size={18} />
          {canUseChannel ? `Enviando por ${CHANNELS[channel].label}` : `Envio por ${CHANNELS[channel].label} indisponível para esta pessoa`}
        </span>
        <button type="button" className="btn-text" style={{ marginLeft: "auto" }} onClick={suggest} disabled={suggesting || !canUseChannel}>
          {suggesting ? "Escrevendo…" : "Sugerir resposta"}
        </button>
      </div>
    </form>
  );
}
