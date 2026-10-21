"use client";

import { useState, useTransition } from "react";
import { deleteMaterial, saveMaterial, setMaterialActive } from "./actions";

export interface MaterialRow {
  id: string;
  title: string;
  whenToUse: string;
  kind: "FILE" | "LINK";
  detail: string;
  link: string | null;
  active: boolean;
  opens: number;
  lastOpenAt: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function Item({ m }: { m: MaterialRow }) {
  const [title, setTitle] = useState(m.title);
  const [hint, setHint] = useState(m.whenToUse);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const dirty = title !== m.title || hint !== m.whenToUse;

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>, ok = "") =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? ok);
    });

  async function copy() {
    if (!m.link) return;
    try {
      await navigator.clipboard.writeText(m.link);
      setMsg("Endereço copiado.");
    } catch {
      setMsg("Não consegui copiar. Selecione o endereço e copie à mão.");
    }
  }

  return (
    <li className="stack" style={{ gap: 8, opacity: m.active ? 1 : 0.6, padding: "12px 0", borderTop: "1px solid rgba(128,128,128,.25)" }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input className="field" style={{ flex: "1 1 220px" }} value={title} maxLength={80} aria-label="Nome do material" onChange={(e) => setTitle(e.target.value)} />
        <input className="field" style={{ flex: "2 1 260px" }} value={hint} maxLength={200} aria-label="Quando usar" placeholder="Quando usar (opcional)" onChange={(e) => setHint(e.target.value)} />
      </div>
      <p className="muted small" style={{ margin: 0, overflowWrap: "anywhere" }}>
        {m.kind === "LINK" ? "Link" : "Arquivo"}: {m.detail} ·{" "}
        {m.opens === 0 ? "ainda não foi aberto" : `aberto ${m.opens} ${m.opens === 1 ? "vez" : "vezes"}${m.lastOpenAt ? ` (última em ${when(m.lastOpenAt)})` : ""}`}
        {!m.active && " · desligado"}
      </p>
      <div className="form-actions" style={{ flexWrap: "wrap" }}>
        {dirty && (
          <button type="button" className="btn-solid btn-sm" disabled={pending} onClick={() => run(() => saveMaterial(m.id, title, hint), "Salvo.")}>
            Salvar
          </button>
        )}
        <button type="button" className="btn-line btn-sm" disabled={pending || !m.link} onClick={copy}>
          Copiar endereço
        </button>
        <button type="button" className="btn-line btn-sm" disabled={pending} onClick={() => run(() => setMaterialActive(m.id, !m.active))}>
          {m.active ? "Desligar" : "Ligar"}
        </button>
        {confirmDel ? (
          <>
            <button type="button" className="btn-solid btn-sm" disabled={pending} onClick={() => run(() => deleteMaterial(m.id))}>
              Apagar de vez
            </button>
            <button type="button" className="btn-text" onClick={() => setConfirmDel(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="btn-text" disabled={pending} onClick={() => setConfirmDel(true)}>
            Apagar
          </button>
        )}
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </li>
  );
}

export function MaterialList({ items }: { items: MaterialRow[] }) {
  return (
    <>
      <p className="hint" style={{ margin: 0 }}>
        Desligar ou apagar faz o endereço que você já mandou deixar de abrir para o cliente.
      </p>
      <ul className="stack" style={{ gap: 0, listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((m) => (
          <Item key={m.id} m={m} />
        ))}
      </ul>
    </>
  );
}
