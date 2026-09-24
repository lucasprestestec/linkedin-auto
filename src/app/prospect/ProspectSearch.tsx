"use client";

import { useActionState, useState, useTransition } from "react";
import { search, invite, type InviteState } from "./actions";
import { Avatar } from "@/components/Avatar";

export function ProspectSearch() {
  const [state, formAction, searching] = useActionState(search, undefined);
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [inviting, startInvite] = useTransition();
  const [invitedQuery, setInvitedQuery] = useState<string | null>(null);

  const newResults = state?.results.filter((r) => !r.alreadyLead) ?? [];
  const alreadySent = invitedQuery === state?.query;

  function handleInvite() {
    if (!state) return;
    startInvite(async () => {
      const result = await invite(state.results);
      setInviteState(result);
      setInvitedQuery(state.query);
    });
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          name="query"
          rows={2}
          placeholder="Quem você quer alcançar? Ex: donos de pequenas empresas em Porto Alegre"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14.5,
            fontFamily: "inherit",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
        <button
          type="submit"
          disabled={searching}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: searching ? 0.7 : 1,
          }}
        >
          {searching ? "Buscando..." : "Buscar"}
        </button>
        {state?.error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>}
      </form>

      {state && !state.error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {state.results.length} pessoas encontradas
            {state.results.length > newResults.length && ` · ${state.results.length - newResults.length} já são leads`}
          </p>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {state.results.map((r) => (
              <li
                key={r.linkedin_profile_url}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  opacity: r.alreadyLead ? 0.55 : 1,
                }}
              >
                <Avatar firstName={r.full_name?.split(" ")[0]} lastName={r.full_name?.split(" ").slice(1).join(" ")} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.full_name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.job_title ?? r.headline} {r.location ? `· ${r.location}` : ""}
                  </div>
                </div>
                {r.alreadyLead && <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>já é lead</span>}
              </li>
            ))}
          </ul>

          {newResults.length > 0 && !alreadySent && (
            <button
              onClick={handleInvite}
              disabled={inviting}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                opacity: inviting ? 0.7 : 1,
              }}
            >
              {inviting ? "Enviando..." : `Enviar convite pra ${newResults.length} pessoa${newResults.length > 1 ? "s" : ""}`}
            </button>
          )}

          {alreadySent && inviteState && !inviteState.error && (
            <p style={{ fontSize: 13, color: "var(--accent-open)", margin: 0 }}>
              Convite agendado pra {inviteState.scheduled} pessoa{inviteState.scheduled !== 1 ? "s" : ""}
              {inviteState.skippedForLimit > 0 && ` · ${inviteState.skippedForLimit} ficaram de fora (limite diário atingido)`}
            </p>
          )}
          {alreadySent && inviteState?.error && (
            <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{inviteState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
