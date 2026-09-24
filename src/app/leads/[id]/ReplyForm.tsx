"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { IconAlert, IconSend } from "@/components/Icons";
import { sendReply } from "./actions";

export function ReplyForm({ leadId }: { leadId: string }) {
  const [value, setValue] = useState("");
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
    window.scrollTo({ top: document.body.scrollHeight });
  }, []);

  // Envio bem-sucedido: rola até a mensagem nova.
  useEffect(() => {
    if (state && !state.error) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }, [state]);

  const canSend = value.trim() !== "" && !pending;

  return (
    <form action={formAction} className="composer">
      {state?.error && (
        <p className="error-text" style={{ padding: "0 8px 8px" }}>
          <IconAlert size={15} /> {state.error}
        </p>
      )}
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          name="content"
          placeholder="Escreva sua resposta…"
          aria-label="Mensagem"
          required
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="send-btn" disabled={!canSend} aria-label="Enviar mensagem">
          {pending ? <span className="spinner" /> : <IconSend size={20} strokeWidth={2.4} />}
        </button>
      </div>
    </form>
  );
}
