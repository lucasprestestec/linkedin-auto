"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { IconBot, IconLinkedin } from "@/components/Icons";
import { toggleAutomation } from "./actions";

// O coração do painel: a automação está ligada ou não, e o que ela fez hoje.
export function AutomationCard({
  paused,
  connected,
  invitesToday,
  inviteLimit,
  messagesToday,
  messageLimit,
}: {
  paused: boolean;
  connected: boolean;
  invitesToday: number;
  inviteLimit: number;
  messagesToday: number;
  messageLimit: number;
}) {
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(paused);
  const [, startTransition] = useTransition();
  const on = connected && !optimisticPaused;

  function toggle() {
    startTransition(async () => {
      setOptimisticPaused(!optimisticPaused);
      await toggleAutomation();
    });
  }

  return (
    <section className={`auto-card${on ? " on" : ""}`} aria-labelledby="auto-title">
      <div className="auto-top">
        <span className="auto-icon">
          <IconBot size={24} />
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <span className="auto-eyebrow">
            <i className="auto-dot" /> {on ? "Trabalhando por você" : "Parada"}
          </span>
          <h2 id="auto-title" className="auto-title">
            {!connected ? "Conecte seu LinkedIn" : on ? "Automação ligada" : "Automação pausada"}
          </h2>
        </div>
        {connected && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={on ? "Pausar automação" : "Ligar automação"}
            className="switch auto-switch"
            onClick={toggle}
          />
        )}
      </div>

      <p className="auto-text">
        {!connected
          ? "Sem a conta conectada, a automação não consegue convidar nem responder ninguém."
          : on
            ? "A IA está convidando as pessoas das suas campanhas, abrindo as conversas e respondendo. Quando alguém precisar de você, aparece aqui embaixo."
            : "Nada é enviado enquanto estiver pausada. As mensagens que chegarem ficam esperando você."}
      </p>

      {connected ? (
        <div className="auto-stats">
          <div>
            <b>
              {invitesToday}
              <small>/{inviteLimit}</small>
            </b>
            <span>convites hoje</span>
            <i className="auto-bar">
              <span style={{ width: `${Math.min(100, (invitesToday / Math.max(1, inviteLimit)) * 100)}%` }} />
            </i>
          </div>
          <div>
            <b>
              {messagesToday}
              <small>/{messageLimit}</small>
            </b>
            <span>mensagens hoje</span>
            <i className="auto-bar">
              <span style={{ width: `${Math.min(100, (messagesToday / Math.max(1, messageLimit)) * 100)}%` }} />
            </i>
          </div>
        </div>
      ) : (
        <Link href="/settings" className="btn auto-connect">
          <IconLinkedin size={18} /> Conectar agora
        </Link>
      )}
    </section>
  );
}
