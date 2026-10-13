"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogVoice } from "@/lib/voice/elevenlabs";
import { chooseCatalogVoice, loadCatalogVoices } from "./actions";

// Lista de vozes prontas: o usuário ouve um trecho de cada e escolhe uma. Não precisa gravar nada.
export function VoicePicker({ currentId, configured }: { currentId: string | null; configured: boolean }) {
  const router = useRouter();
  const [voices, setVoices] = useState<CatalogVoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(currentId);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    loadCatalogVoices().then((r) => {
      if (!alive) return;
      if (r.error) setError(r.error);
      else setVoices(r.voices ?? []);
    });
    return () => {
      alive = false;
    };
  }, [configured]);

  if (!configured) return <p className="note note-warn">A lista de vozes ainda não foi ativada neste sistema. Peça ao suporte para ativar.</p>;
  if (error) return <p className="field-error">{error}</p>;
  if (!voices) return <p className="small muted">Carregando as vozes…</p>;
  if (voices.length === 0) return <p className="small muted">Nenhuma voz disponível agora.</p>;

  return (
    <ul className="list" style={{ margin: 0 }}>
      {voices.map((v) => {
        const inUse = chosen === v.id;
        return (
          <li key={v.id}>
            <div className="item" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="item-main" style={{ minWidth: 140 }}>
                <span className="item-title">{v.name}</span>
                {v.about && <span className="item-sub">{v.about}</span>}
              </div>
              {v.previewUrl && <audio controls preload="none" src={v.previewUrl} style={{ height: 36, maxWidth: 220 }} />}
              {inUse ? (
                <span className="small muted">Em uso</span>
              ) : (
                <button
                  type="button"
                  className="btn-line btn-sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await chooseCatalogVoice(v.id, v.name);
                      if (r.error) return setError(r.error);
                      setChosen(v.id);
                      router.refresh();
                    })
                  }
                >
                  Usar esta voz
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
