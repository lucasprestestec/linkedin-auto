"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setAudioMode } from "@/app/voz/actions";
import { AUDIO_MODES, hasVoice, type AudioMode, type VoiceSettings } from "@/lib/voice/settings";

// "Mensagens de voz" em Conta: a voz do usuário e a escolha PESSOAL de quando o assistente responde em áudio.
export function VoiceOverview({ voice, configured }: { voice: VoiceSettings; configured: boolean }) {
  const [mode, setMode] = useState<AudioMode>(voice.mode);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = hasVoice(voice);

  function choose(next: AudioMode) {
    const before = mode;
    setMode(next);
    setError(null);
    startTransition(async () => {
      const r = await setAudioMode(next);
      if (r.error) {
        setMode(before);
        setError(r.error);
      }
    });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {!configured && <p className="note note-warn">O serviço de voz ainda não foi configurado neste sistema. Peça ao suporte para ativar.</p>}

      {!ready ? (
        <div className="note stack" style={{ gap: 10 }}>
          <b>Crie a sua voz para o assistente responder em áudio</b>
          <span>Você grava uns 30 segundos lendo um texto, e o assistente passa a poder falar como você. Pode apagar a voz quando quiser.</span>
          <div>
            <Link href="/voz" className="btn-solid btn-sm">
              Criar minha voz
            </Link>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{ gap: 8, justifyContent: "space-between" }}>
          <span>
            <b>{voice.voiceName ?? "Minha voz"}</b> <span className="small muted">· pronta</span>
          </span>
          <Link href="/voz" className="btn-line btn-sm">
            Gerenciar minha voz
          </Link>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Quando o assistente responde em áudio?</span>
        {AUDIO_MODES.map((m) => {
          const selected = mode === m.value;
          const disabled = pending || (m.value !== "off" && !ready);
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => choose(m.value)}
              style={{
                textAlign: "left",
                padding: 12,
                borderRadius: "var(--radius-sm)",
                border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                background: selected ? "var(--accent-soft)" : "var(--card)",
                color: "var(--text)",
                font: "inherit",
                opacity: disabled && !selected ? 0.55 : 1,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <b>{m.label}</b>
              <br />
              <span className="small muted">{m.hint}</span>
            </button>
          );
        })}
        <p className="hint" style={{ margin: 0 }}>
          Só vale no WhatsApp. Com a aprovação ligada, você ouve o áudio antes de ele sair. Se o áudio falhar, a resposta sai em texto.
        </p>
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}
