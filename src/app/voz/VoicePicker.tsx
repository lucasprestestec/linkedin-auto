"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogVoice } from "@/lib/voice/elevenlabs";
import { chooseCatalogVoice, loadCatalogVoices, previewCatalogVoice } from "./actions";

// Vozes prontas num menu: o usuário escolhe uma, ouve e confirma. Não precisa gravar nada.
export function VoicePicker({ currentId, currentName, configured }: { currentId: string | null; currentName: string | null; configured: boolean }) {
  const router = useRouter();
  const [voices, setVoices] = useState<CatalogVoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentId ?? "");
  const [inUse, setInUse] = useState<{ id: string | null; name: string | null }>({ id: currentId, name: currentName });
  const [sample, setSample] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    loadCatalogVoices().then((r) => {
      if (!alive) return;
      if (r.error) setError(r.error);
      else {
        setVoices(r.voices ?? []);
      }
    });
    return () => {
      alive = false;
    };
  }, [configured]);

  if (!configured) return <p className="note note-warn">A lista de vozes ainda não foi ativada neste sistema. Peça ao suporte para ativar.</p>;
  if (error && !voices) return <p className="field-error">{error}</p>;
  if (!voices) return <p className="small muted">Carregando as vozes…</p>;
  if (voices.length === 0) return <p className="small muted">Nenhuma voz disponível agora.</p>;

  const voice = voices.find((v) => v.id === selected) ?? null;
  // Só o nome e a voz (feminina ou masculina): o resto da descrição deixava a lista comprida.
  const label = (v: CatalogVoice) => [v.name, v.gender, v.portuguese === "pt-BR" ? "Brasil" : null].filter(Boolean).join(" · ");
  const verified = voices.filter((v) => v.portuguese);
  const others = voices.filter((v) => !v.portuguese);
  const options = (list: CatalogVoice[]) =>
    list.map((v) => (
      <option key={v.id} value={v.id}>
        {label(v)}
      </option>
    ));

  return (
    <div className="stack" style={{ gap: 12 }}>
      {inUse.id && (
        <p className="small">
          Em uso agora: <b>{inUse.name ?? "voz escolhida"}</b>
        </p>
      )}
      <label>
        <span className="label">Voz</span>
        <select
          className="field"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setSample(null);
            setError(null);
          }}
        >
          <option value="">Escolha uma voz…</option>
          {verified.length > 0 && <optgroup label="Verificadas em português">{options(verified)}</optgroup>}
          {others.length > 0 && <optgroup label={verified.length ? "Outras (falam português, sotaque pode variar)" : "Falam português, sotaque pode variar"}>{options(others)}</optgroup>}
        </select>
      </label>

      {voice && (
        <div className="stack" style={{ gap: 8 }}>
          {voice.previewUrl && <audio key={voice.id} controls preload="none" src={voice.previewUrl} style={{ width: "100%", maxWidth: 420 }} />}
          {sample && <audio key={sample} controls autoPlay src={sample} style={{ width: "100%", maxWidth: 420 }} />}
          <div className="row wrap" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-line btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await previewCatalogVoice(voice.id);
                  if (r.error) setError(r.error);
                  else setSample(r.url ?? null);
                })
              }
            >
              {pending ? "Gerando…" : "Ouvir em português"}
            </button>
            {inUse.id === voice.id ? (
              <span className="small muted" style={{ alignSelf: "center" }}>
                Esta é a voz em uso
              </span>
            ) : (
              <button
                type="button"
                className="btn-solid btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await chooseCatalogVoice(voice.id, voice.name);
                    if (r.error) return setError(r.error);
                    setInUse({ id: voice.id, name: voice.name });
                    router.refresh();
                  })
                }
              >
                Usar esta voz
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
