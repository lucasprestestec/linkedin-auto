"use client";

import { useActionState, useState, useTransition } from "react";
import { search, invite, type InviteState } from "./actions";
import type { ProspectResult } from "@/lib/prospect";
import { Avatar } from "@/components/Avatar";

function ProfilePhoto({ result }: { result: ProspectResult }) {
  if (result.profile_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto vem de domínio externo (licdn.com), imprevisível pra next/image
      <img
        src={result.profile_image_url}
        alt=""
        width={34}
        height={34}
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  const [first, ...rest] = result.full_name.split(" ");
  return <Avatar firstName={first} lastName={rest.join(" ")} size={34} />;
}

function ProspectResults({ results }: { results: ProspectResult[] }) {
  const newResults = results.filter((r) => !r.alreadyLead);
  const [selected, setSelected] = useState<Set<string>>(new Set(newResults.map((r) => r.linkedin_profile_url)));
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [inviting, startInvite] = useTransition();
  const [sent, setSent] = useState(false);

  const selectedResults = newResults.filter((r) => selected.has(r.linkedin_profile_url));

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function handleInvite() {
    startInvite(async () => {
      const result = await invite(selectedResults);
      setInviteState(result);
      setSent(true);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        {results.length} pessoas encontradas
        {results.length > newResults.length && ` · ${results.length - newResults.length} já são leads`}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {results.map((r) => (
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
            {!r.alreadyLead && (
              <input
                type="checkbox"
                checked={selected.has(r.linkedin_profile_url)}
                onChange={() => toggle(r.linkedin_profile_url)}
                style={{ flexShrink: 0, width: 16, height: 16 }}
              />
            )}
            <ProfilePhoto result={r} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.full_name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.job_title ?? r.headline} {r.location ? `· ${r.location}` : ""}
              </div>
            </div>
            <a
              href={r.linkedin_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--primary)", flexShrink: 0, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Ver perfil
            </a>
            {r.alreadyLead && <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>já é lead</span>}
          </li>
        ))}
      </ul>

      {newResults.length > 0 && !sent && (
        <button
          onClick={handleInvite}
          disabled={inviting || selectedResults.length === 0}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: inviting || selectedResults.length === 0 ? 0.5 : 1,
          }}
        >
          {inviting
            ? "Enviando..."
            : selectedResults.length === 0
              ? "Selecione ao menos 1 pessoa"
              : `Enviar convite pra ${selectedResults.length} pessoa${selectedResults.length > 1 ? "s" : ""}`}
        </button>
      )}

      {sent && inviteState && !inviteState.error && (
        <p style={{ fontSize: 13, color: "var(--accent-open)", margin: 0 }}>
          Convite agendado pra {inviteState.scheduled} pessoa{inviteState.scheduled !== 1 ? "s" : ""}
          {inviteState.skippedForLimit > 0 && ` · ${inviteState.skippedForLimit} ficaram de fora (limite diário atingido)`}
        </p>
      )}
      {sent && inviteState?.error && <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{inviteState.error}</p>}
    </div>
  );
}

export function ProspectSearch({ maxPerSearch }: { maxPerSearch: number }) {
  const [state, formAction, searching] = useActionState(search, undefined);
  const defaultLimit = Math.min(10, maxPerSearch);

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
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
          Quantos perfis buscar?
          <input
            name="limit"
            type="number"
            min={maxPerSearch > 0 ? 10 : 0}
            max={maxPerSearch}
            step={10}
            defaultValue={defaultLimit}
            disabled={maxPerSearch <= 0}
            style={{
              width: 70,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 13.5,
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>máximo {maxPerSearch} (crédito disponível)</span>
        </label>
        <button
          type="submit"
          disabled={searching || maxPerSearch <= 0}
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
        {maxPerSearch <= 0 && (
          <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
            Sem crédito de busca disponível este mês. Convite e mensagem continuam funcionando normalmente.
          </p>
        )}
      </form>

      {state && !state.error && <ProspectResults key={state.searchId} results={state.results} />}
    </div>
  );
}
