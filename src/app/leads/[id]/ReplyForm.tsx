"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { IconAlert, IconArrowRight, IconLinkedin, IconMail, IconPaperclip, IconSparkles } from "@/components/Icons";
import { sendReply, suggestLeadReply } from "./actions";

type Channel = "LINKEDIN" | "EMAIL";
const LABEL: Record<Channel, string> = { LINKEDIN: "LinkedIn", EMAIL: "E-mail" };

export function ReplyForm({
  leadId,
  firstName,
  profileUrl,
  channels = ["LINKEDIN"],
  defaultChannel = "LINKEDIN",
}: {
  leadId: string;
  firstName: string;
  profileUrl: string;
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

  // Cresce junto com o texto, até o max-height do CSS.
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

  // Envio bem-sucedido: rola até a mensagem nova.
  useEffect(() => {
    if (state && !state.error) document.getElementById("thread-end")?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state]);

  // Rascunho da IA: preenche o campo pra você revisar — nada é enviado sozinho.
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
      {error && (
        <p className="error-text" style={{ padding: "0 8px 8px" }}>
          <IconAlert size={15} /> {error}
        </p>
      )}
      <input type="hidden" name="channel" value={channel} />
      {channels.length > 1 && (
        <div className="composer-channels" role="radiogroup" aria-label="Enviar por">
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              className={channel === c ? "active" : undefined}
              onClick={() => setChannel(c)}
            >
              {c === "EMAIL" ? <IconMail size={14} /> : <IconLinkedin size={14} />} {LABEL[c]}
            </button>
          ))}
        </div>
      )}
      <div className="composer-row">
        {channel === "LINKEDIN" ? (
          <a
          href={profileUrl}
          target="_blank"
          rel="noreferrer"
          className="composer-clip"
          aria-label="Enviar anexo pelo LinkedIn"
          title="Anexos: envie direto pelo LinkedIn"
        >
            <IconPaperclip size={21} />
          </a>
        ) : null}
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            id="reply-box"
            name="content"
            placeholder={channel === "EMAIL" ? `Escreva um e-mail para ${firstName}...` : `Digite uma mensagem para ${firstName}...`}
            aria-label="Mensagem"
            required
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" className="ai-suggest" onClick={suggest} disabled={suggesting} aria-label="Sugerir resposta com IA" title="Sugerir resposta com IA">
            {suggesting ? <span className="spinner" /> : <IconSparkles size={20} />}
          </button>
        </div>
        <button type="submit" className="send-btn" disabled={!canSend} aria-label="Enviar mensagem">
          {pending ? <span className="spinner" /> : <IconArrowRight size={22} strokeWidth={2.4} />}
        </button>
      </div>
    </form>
  );
}
