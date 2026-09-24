"use client";

import { useActionState, useState, useTransition } from "react";
import { parseProfiles, invite, type InviteState } from "./actions";
import type { ProspectResult } from "@/lib/prospect";
import { buildLinkedinSearchUrl } from "@/lib/linkedin";

function LinkedinSearchLink() {
  const [query, setQuery] = useState("");
  const url = buildLinkedinSearchUrl(query);
  const canOpen = query.trim() !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "var(--text-muted)" }}>
        Quem você quer alcançar?
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: corretor de seguros Porto Alegre"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14.5,
          }}
        />
      </label>
      <a
        href={canOpen ? url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!canOpen}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: canOpen ? "var(--primary)" : "var(--border)",
          color: canOpen ? "#fff" : "var(--text-faint)",
          fontSize: 14,
          fontWeight: 700,
          textAlign: "center",
          textDecoration: "none",
          cursor: canOpen ? "pointer" : "not-allowed",
          pointerEvents: canOpen ? "auto" : "none",
        }}
      >
        Abrir busca no LinkedIn ↗
      </a>
      <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
        Abre numa aba nova, sem custo. Navegue lá, escolha quem quiser e copie o link do perfil de cada pessoa.
      </p>
    </div>
  );
}

function ProspectResults({ results }: { results: ProspectResult[] }) {
  const newResults = results.filter((r) => !r.alreadyLead);
  const [selected, setSelected] = useState<Set<string>>(new Set(newResults.map((r) => r.linkedinProfileUrl)));
  const [inviteState, setInviteState] = useState<InviteState>(undefined);
  const [inviting, startInvite] = useTransition();
  const [sent, setSent] = useState(false);

  const selectedResults = newResults.filter((r) => selected.has(r.linkedinProfileUrl));

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
        {results.length} link{results.length !== 1 ? "s" : ""} reconhecido{results.length !== 1 ? "s" : ""}
        {results.length > newResults.length && ` · ${results.length - newResults.length} já são leads`}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {results.map((r) => (
          <li
            key={r.linkedinProfileUrl}
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
                checked={selected.has(r.linkedinProfileUrl)}
                onChange={() => toggle(r.linkedinProfileUrl)}
                style={{ flexShrink: 0, width: 16, height: 16 }}
              />
            )}
            <a
              href={r.linkedinProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {r.linkedinProfileUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")}
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

export function ProspectSearch() {
  const [state, formAction, parsing] = useActionState(parseProfiles, undefined);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          1. Buscar
        </h2>
        <LinkedinSearchLink />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          2. Colar quem você escolheu
        </h2>
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            name="urls"
            rows={4}
            placeholder={"Cole um link por linha, ex:\nhttps://www.linkedin.com/in/fulano\nhttps://www.linkedin.com/in/ciclana"}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13.5,
              fontFamily: "inherit",
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
          <button
            type="submit"
            disabled={parsing}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: parsing ? 0.7 : 1,
            }}
          >
            {parsing ? "Verificando..." : "Ver perfis"}
          </button>
          {state?.error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{state.error}</p>}
        </form>
      </section>

      {state && !state.error && <ProspectResults key={state.parseId} results={state.results} />}
    </div>
  );
}
