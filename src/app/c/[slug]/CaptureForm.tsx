"use client";

import { useActionState } from "react";
import { submitCapture, type CaptureState } from "./actions";

// Formulário público. Os campos "website" (escondido) e "t" (carimbo assinado) existem para barrar robôs.
export function CaptureForm({ slug, token, owner, title }: { slug: string; token: string; owner: string; title: string }) {
  const [state, action, pending] = useActionState((prev: CaptureState, form: FormData) => submitCapture(slug, prev, form), undefined);

  if (state?.done)
    return (
      <div role="status" className="stack" style={{ gap: 8 }}>
        <h2>Recebido, obrigado!</h2>
        <p>Em breve {owner} entra em contato com você.</p>
      </div>
    );

  return (
    <form action={action} className="form" style={{ gap: 14 }}>
      <input type="hidden" name="t" value={token} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Não preencha este campo
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div>
        <label className="label" htmlFor="cap-name">
          Seu nome
        </label>
        <input id="cap-name" className="field" name="name" autoComplete="name" required maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="cap-email">
          E-mail
        </label>
        <input id="cap-email" className="field" type="email" name="email" autoComplete="email" maxLength={160} />
      </div>
      <div>
        <label className="label" htmlFor="cap-phone">
          WhatsApp
        </label>
        <input id="cap-phone" className="field" type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="(51) 99999-0000" maxLength={30} />
      </div>
      <div>
        <label className="label" htmlFor="cap-company">
          Empresa (opcional)
        </label>
        <input id="cap-company" className="field" name="company" autoComplete="organization" maxLength={100} />
      </div>
      <div>
        <label className="label" htmlFor="cap-role">
          Cargo (opcional)
        </label>
        <input id="cap-role" className="field" name="role" autoComplete="organization-title" maxLength={100} />
      </div>
      <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" name="consent" required style={{ marginTop: 4 }} />
        <span className="small">
          Autorizo {owner} a falar comigo, pelo e-mail e pelo WhatsApp informados, sobre &ldquo;{title}&rdquo;. Posso pedir para parar a qualquer momento. Veja a{" "}
          <a href="/privacidade" target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>
          .
        </span>
      </label>
      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-solid" disabled={pending}>
        {pending ? "Enviando…" : "Quero ser contatado"}
      </button>
      <p className="muted small">Informe pelo menos o e-mail ou o WhatsApp.</p>
    </form>
  );
}
