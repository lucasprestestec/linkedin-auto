"use client";

import { useMemo, useState, useTransition } from "react";
import type { KnowledgeMode } from "@prisma/client";
import { createSection, deleteSection, enableSection, setSectionMode, updateSection } from "./actions";

interface Section {
  id: string;
  title: string;
  content: string;
  mode: KnowledgeMode;
}

// Em linguagem de quem usa: o que a assistente faz com o tema.
const MODE_CHOICES: { mode: KnowledgeMode; label: string; help: string }[] = [
  { mode: "ALWAYS", label: "Sempre considera", help: "Entra em toda conversa. Use para regras e informações que valem para qualquer pessoa." },
  { mode: "ON_DEMAND", label: "Só quando o assunto aparecer", help: "Entra só quando a conversa tocar nesse assunto. Dê um título claro: é por ele que a assistente escolhe." },
];

// Primeira frase útil do tema, sem marcas de formatação.
function previewOf(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !/^[-|:= ]+$/.test(l));
  return (line ?? "").replace(/[*_`>#|]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").slice(0, 130);
}

// "9. Mensagens de abertura › 9.1 Indicados": a parte de cima vira o grupo.
function splitTitle(title: string): { parent: string | null; own: string } {
  const cut = title.lastIndexOf(" › ");
  return cut > 0 ? { parent: title.slice(0, cut), own: title.slice(cut + 3) } : { parent: null, own: title };
}

// "a Helena" no começo da frase vira "A Helena".
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function KnowledgeList({ sections, assistantName: nameProp }: { sections: Section[]; assistantName: string }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const assistantName = nameProp ? `a ${nameProp}` : "a assistente";

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return q ? sections.filter((s) => normalize(s.title).includes(q) || normalize(s.content).includes(q)) : sections;
  }, [sections, query]);

  // Temas seguidos que têm o mesmo grupo ficam sob um título só.
  const groups = useMemo(() => {
    const out: { parent: string | null; items: Section[] }[] = [];
    for (const s of shown) {
      const { parent } = splitTitle(s.title);
      const last = out[out.length - 1];
      if (last && parent !== null && last.parent === parent) last.items.push(s);
      else out.push({ parent, items: [s] });
    }
    return out;
  }, [shown]);

  const active = sections.filter((s) => s.mode !== "OFF").length;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="know-bar">
        <input
          className="field"
          type="search"
          placeholder="Buscar um tema ou uma palavra"
          aria-label="Buscar nos temas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn-solid btn-sm" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          {adding ? "Fechar" : "＋ Novo tema"}
        </button>
      </div>

      {adding && <NewTopic assistantName={assistantName} onDone={() => setAdding(false)} />}

      <p className="hint" style={{ margin: 0 }}>
        {sections.length} {sections.length === 1 ? "tema" : "temas"}, {active} {active === 1 ? "ativo" : "ativos"}
        {query.trim() ? ` · ${shown.length} ${shown.length === 1 ? "encontrado" : "encontrados"} na busca` : ""}
      </p>

      {shown.length === 0 && <p className="hint">Nenhum tema com essa palavra.</p>}

      <div className="know-list">
        {groups.map((g, i) => (
          <div key={`${g.parent ?? "solo"}-${i}`} className="know-group">
            {g.parent && <h3 className="know-group-title">{g.parent}</h3>}
            {g.items.map((s) => (
              <TopicRow key={s.id} section={s} assistantName={assistantName} grouped={Boolean(g.parent)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewTopic({ assistantName, onDone }: { assistantName: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="know-new">
      <h3 className="t-label">Novo tema</h3>
      <label>
        <span className="label">Título</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Seguro para empresas — o que cobre" maxLength={120} />
      </label>
      <label>
        <span className="label">O que {assistantName} precisa saber</span>
        <textarea className="field" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escreva do jeito que explicaria a um colega novo. Frases simples, sem abreviações." />
      </label>
      <p className="hint" style={{ margin: 0 }}>
        {cap(assistantName)} só afirma o que está escrito aqui. O título importa: é por ele que ela decide quando usar o tema.
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="btn-solid btn-sm"
          disabled={pending || !title.trim() || !content.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await createSection(title, content);
              if (r.error) setError(r.error);
              else onDone();
            })
          }
        >
          {pending ? "Salvando…" : "Adicionar tema"}
        </button>
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );
}

function TopicRow({ section, assistantName, grouped }: { section: Section; assistantName: string; grouped: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = title !== section.title || content !== section.content;
  const off = section.mode === "OFF";
  const { own } = splitTitle(section.title);

  return (
    <div className={`know-row ${off ? "know-off" : ""}`}>
      <button type="button" className="know-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="know-caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className="know-title">
          <span>{grouped ? own : section.title}</span>
          <small>{previewOf(section.content)}</small>
        </span>
        {off && <span className="know-chip">Desligado</span>}
      </button>

      {open && (
        <div className="form know-body" style={{ gap: 10 }}>
          <label>
            <span className="label">Título</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span className="label">Texto que {assistantName} usa</span>
            <textarea className="field" rows={14} value={content} onChange={(e) => setContent(e.target.value)} style={{ fontSize: 13.5 }} />
          </label>

          <details className="know-adv">
            <summary>Quando {assistantName} usa este tema</summary>
            <div className="stack" style={{ gap: 8, marginTop: 8 }}>
              {off ? (
                <p className="hint" style={{ margin: 0 }}>
                  Este tema está desligado: {assistantName} não usa. Ligue para voltar a considerá-lo.
                </p>
              ) : (
                MODE_CHOICES.map((c) => (
                  <label key={c.mode} className="know-choice">
                    <input
                      type="radio"
                      name={`modo-${section.id}`}
                      checked={section.mode === c.mode}
                      disabled={pending}
                      onChange={() => startTransition(() => setSectionMode(section.id, c.mode))}
                    />
                    <span>
                      <b>{c.label}</b>
                      <small>{c.help}</small>
                    </span>
                  </label>
                ))
              )}
            </div>
          </details>

          <div className="form-actions" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-line btn-sm"
                disabled={pending}
                onClick={() => startTransition(() => (off ? enableSection(section.id) : setSectionMode(section.id, "OFF")))}
              >
                {off ? "Ligar tema" : "Desligar tema"}
              </button>
              <button
                type="button"
                className="btn-danger-line btn-sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Apagar o tema "${section.title}"? Não dá para desfazer. Se só quer que ${assistantName} pare de usar, use "Desligar tema".`))
                    startTransition(() => deleteSection(section.id));
                }}
              >
                Apagar
              </button>
            </span>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {error && <span className="field-error">{error}</span>}
              {saved && !dirty && <span className="ok-text">Salvo. Vale na próxima mensagem.</span>}
              <button
                type="button"
                className="btn-solid btn-sm"
                disabled={!dirty || pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await updateSection(section.id, title, content);
                    setError(r.error ?? null);
                    setSaved(!r.error);
                  })
                }
              >
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
