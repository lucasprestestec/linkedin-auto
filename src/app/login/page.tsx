"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";
import { IconAlert, IconEye, IconEyeOff, IconLock, IconSparkles, LogoMark } from "@/components/Icons";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [visible, setVisible] = useState(false);
  // Remonta o campo a cada tentativa para a animação de erro tocar de novo.
  const [attempt, setAttempt] = useState(0);

  return (
    <main className="login">
      <div className="login-hero">
        <span className="logo">
          <LogoMark size={30} />
        </span>
        <h1 className="login-title">
          Seus leads do LinkedIn, <span>no piloto automático.</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, maxWidth: 340 }}>
          Um agente de IA que abre a conversa, responde, faz follow-up e sabe a hora de te chamar.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {["Abertura automática", "Follow-up com IA", "Handoff inteligente"].map((t) => (
            <span key={t} className="badge badge-plain" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", height: 28, padding: "0 11px" }}>
              <IconSparkles size={12} /> {t}
            </span>
          ))}
        </div>
      </div>

      <form action={formAction} onSubmit={() => setAttempt((a) => a + 1)} className="login-sheet">
        <div className="stack" style={{ gap: 4 }}>
          <h2 className="title-lg">Bem-vindo de volta</h2>
          <p className="small muted">Entre com sua senha para acessar o painel.</p>
        </div>
        <div key={attempt} className={`input-wrap${state?.error ? " shake" : ""}`}>
          <IconLock size={19} />
          <input
            className="input"
            type={visible ? "text" : "password"}
            name="password"
            placeholder="Senha"
            aria-label="Senha"
            autoComplete="current-password"
            autoFocus
            required
            style={state?.error ? { borderColor: "var(--urgent)" } : undefined}
          />
          <button
            type="button"
            className="icon-btn icon-btn-round input-action"
            style={{ border: "none", background: "transparent", boxShadow: "none", color: "var(--text-3)" }}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <IconEyeOff size={19} /> : <IconEye size={19} />}
          </button>
        </div>
        {state?.error && (
          <p className="error-text">
            <IconAlert size={15} /> {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg btn-block">
          {pending ? (
            <>
              <span className="spinner" /> Entrando…
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>
    </main>
  );
}
