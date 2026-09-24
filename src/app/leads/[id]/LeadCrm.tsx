"use client";

import { useState, useTransition } from "react";
import { updateLeadCampaign, updateLeadNotes, updateLeadTags } from "./actions";
import { IconCheck, IconX } from "@/components/Icons";

// Anotações, etiquetas e campanha do lead. No celular fica numa seção
// recolhível acima da conversa; no computador, no painel lateral.
export function LeadCrm({
  leadId,
  notes,
  tags,
  knownTags,
  campaignId,
  campaigns,
}: {
  leadId: string;
  notes: string;
  tags: string[];
  knownTags: string[];
  campaignId: string | null;
  campaigns: { id: string; name: string }[];
}) {
  const [text, setText] = useState(notes);
  const [savedText, setSavedText] = useState(notes);
  const [currentTags, setCurrentTags] = useState(tags);
  const [draft, setDraft] = useState("");
  const [campaign, setCampaign] = useState(campaignId ?? "");
  const [pending, startTransition] = useTransition();

  function saveTags(next: string[]) {
    setCurrentTags(next);
    startTransition(async () => {
      const result = await updateLeadTags(leadId, next);
      setCurrentTags(result.tags);
    });
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    setDraft("");
    if (!tag || currentTags.includes(tag)) return;
    saveTags([...currentTags, tag]);
  }

  function saveNotes() {
    if (text.trim() === savedText.trim()) return;
    startTransition(async () => {
      await updateLeadNotes(leadId, text);
      setSavedText(text);
    });
  }

  const suggestions = knownTags.filter((t) => !currentTags.includes(t) && (!draft || t.includes(draft.toLowerCase()))).slice(0, 6);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <label className="label" htmlFor="lead-tags">
          Etiquetas
        </label>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {currentTags.map((t) => (
            <span key={t} className="badge badge-waiting badge-plain" style={{ height: 28, paddingRight: 4 }}>
              {t}
              <button
                type="button"
                onClick={() => saveTags(currentTags.filter((x) => x !== t))}
                aria-label={`Remover etiqueta ${t}`}
                style={{ border: "none", background: "none", color: "inherit", display: "flex", padding: 2 }}
              >
                <IconX size={13} />
              </button>
            </span>
          ))}
        </div>
        <input
          id="lead-tags"
          className="input"
          style={{ height: 44, fontSize: 15 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="Adicionar etiqueta e Enter (ex.: indicação)"
          enterKeyHint="done"
        />
        {suggestions.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {suggestions.map((t) => (
              <button key={t} type="button" className="chip" style={{ height: 30, fontSize: 12.5 }} onClick={() => addTag(t)}>
                + {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {campaigns.length > 0 && (
        <div className="field">
          <label className="label" htmlFor="lead-campaign">
            Campanha
          </label>
          <select
            id="lead-campaign"
            className="input"
            style={{ height: 44, fontSize: 15 }}
            value={campaign}
            onChange={(e) => {
              setCampaign(e.target.value);
              startTransition(async () => {
                await updateLeadCampaign(leadId, e.target.value || null);
              });
            }}
          >
            <option value="">Sem campanha (instruções gerais)</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="hint">A IA usa as instruções da campanha nesta conversa.</p>
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="lead-notes">
          Anotações
        </label>
        <textarea
          id="lead-notes"
          className="textarea"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveNotes}
          placeholder="Só você vê. Ex.: tem 40 vidas, reajuste vence em março."
          style={{ fontSize: 14.5, resize: "vertical" }}
        />
        <div className="row" style={{ justifyContent: "space-between", minHeight: 20 }}>
          <span className="tiny faint">A IA não lê as anotações.</span>
          {pending ? (
            <span className="tiny faint">Salvando…</span>
          ) : text.trim() !== savedText.trim() ? (
            <button type="button" className="btn btn-ghost btn-sm" style={{ height: 28 }} onClick={saveNotes}>
              Salvar
            </button>
          ) : (
            savedText && (
              <span className="success-text tiny">
                <IconCheck size={13} strokeWidth={3} /> Salvo
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
