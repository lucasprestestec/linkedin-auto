"use client";

import { useActionState } from "react";
import { IconCheck } from "@/components/Icons";

// Card de ajustes com vários campos que são salvos juntos como um texto só
// (hidden input). O botão Salvar só aparece quando algo mudou.
export function FieldsCard({
  action,
  name,
  serialized,
  initial,
  title,
  subtitle,
  icon,
  iconStyle,
  status,
  children,
}: {
  action: (prev: unknown, formData: FormData) => Promise<{ saved?: boolean }>;
  name: string;
  serialized: string;
  initial: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconStyle: React.CSSProperties;
  status: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const dirty = serialized.trim() !== initial.trim();

  return (
    <form action={formAction} className="card card-pad stack" style={{ gap: 16 }}>
      <input type="hidden" name={name} value={serialized} />
      <div className="row" style={{ gap: 14 }}>
        <span className="setting-icon" style={iconStyle}>
          {icon}
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{title}</span>
          <span className="tiny faint">{subtitle}</span>
        </div>
      </div>
      {children}
      <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
        <span className="tiny faint">{status}</span>
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

export function Field({ icon, label, hint, children }: { icon: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="filter-field">
      <span className="filter-field-label">
        {icon} {label}
      </span>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
