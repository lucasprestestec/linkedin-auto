"use client";

import { useActionState, useState } from "react";
import { IconCheck } from "@/components/Icons";

// Card com um texto longo e botão de salvar que só aparece quando muda — mesmo
// padrão das instruções do agente. Usado pro cliente ideal e a lista de exclusão.
function footer(text: string, counter: { mode: "chars" | "lines"; empty: string; linesSuffix?: string }): string {
  if (counter.mode === "chars") return text.trim() ? `${text.trim().length} caracteres` : counter.empty;
  const n = text.split("\n").filter((l) => l.trim()).length;
  return n ? `${n} ite${n > 1 ? "ns" : "m"}${counter.linesSuffix ?? ""}` : counter.empty;
}

export function TextSettingForm({
  action,
  name,
  value,
  title,
  subtitle,
  icon,
  iconStyle,
  placeholder,
  rows = 5,
  counter,
}: {
  action: (prev: unknown, formData: FormData) => Promise<{ saved?: boolean }>;
  name: string;
  value: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconStyle: React.CSSProperties;
  placeholder: string;
  rows?: number;
  // Funções não passam de Server pra Client Component — o rodapé é escolhido por modo.
  counter: { mode: "chars" | "lines"; empty: string; linesSuffix?: string };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [text, setText] = useState(value);
  const dirty = text.trim() !== value.trim();

  return (
    <form action={formAction} className="card card-pad stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 14 }}>
        <span className="setting-icon" style={iconStyle}>
          {icon}
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{title}</span>
          <span className="tiny faint">{subtitle}</span>
        </div>
      </div>
      <textarea
        name={name}
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={rows}
        aria-label={title}
        placeholder={placeholder}
        style={{ fontSize: 14.5, resize: "vertical" }}
      />
      <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
        <span className="tiny faint">{footer(text, counter)}</span>
        {dirty ? (
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          state?.saved && (
            <span className="success-text">
              <IconCheck size={15} strokeWidth={3} /> Salvo
            </span>
          )
        )}
      </div>
    </form>
  );
}
