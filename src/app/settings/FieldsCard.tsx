"use client";

import { useActionState } from "react";
import { Help } from "@/components/Help";

// Formulário com vários campos que são salvos juntos como um texto só
// (hidden input). O botão Salvar só aparece quando algo mudou.
export function FieldsCard({
  action,
  name,
  serialized,
  initial,
  status,
  children,
}: {
  action: (prev: unknown, formData: FormData) => Promise<{ saved?: boolean }>;
  name: string;
  serialized: string;
  initial: string;
  status?: string;
  children: React.ReactNode;
  // Aceitos por compatibilidade com as telas antigas; não são mais mostrados.
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconStyle?: React.CSSProperties;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const dirty = serialized.trim() !== initial.trim();

  return (
    <form action={formAction} className="form">
      <input type="hidden" name={name} value={serialized} />
      {children}
      <div className="form-actions">
        {dirty ? (
          <button type="submit" className="btn-solid btn-sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : (
          state?.saved && <span className="ok-text">Salvo</span>
        )}
        {status && <span className="hint" style={{ margin: 0 }}>{status}</span>}
      </div>
    </form>
  );
}

export function Field({ label, hint, children }: { icon?: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {hint && <Help>{hint}</Help>}
      </label>
      {children}
    </div>
  );
}
