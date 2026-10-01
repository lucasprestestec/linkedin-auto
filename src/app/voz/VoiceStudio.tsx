"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { encodeWav } from "@/lib/voice/wav";
import type { VoiceSettings } from "@/lib/voice/settings";
import { deleteMyVoice, previewMyVoice } from "./actions";

const MIN_SECONDS = 15;
const MAX_SECONDS = 60;
const RATE = 24000;

// Texto pra ler em voz alta (uns 25 a 35 segundos, com o nome do usuário).
function readingText(name: string | null) {
  return (
    `Oi, tudo bem? ${name ? `Aqui é ${name}. ` : ""}Eu trabalho ajudando empresas a encontrar a melhor solução, sem complicação. ` +
    "Gosto de entender o cenário de cada cliente antes de sugerir qualquer coisa, porque cada empresa tem uma necessidade diferente. " +
    "Se fizer sentido, a gente conversa rapidinho por telefone ou por vídeo, no melhor horário pra você. Combinado? Um abraço, e até já."
  );
}

// Gravação do navegador (webm/ogg) -> WAV mono de 24 kHz, que é o que o servidor aceita.
async function toWav(blob: Blob): Promise<{ wav: Blob; seconds: number }> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return { wav: new Blob([encodeWav(rendered.getChannelData(0), RATE)], { type: "audio/wav" }), seconds: decoded.duration };
}

type Phase = "idle" | "recording" | "recorded" | "uploading";

export function VoiceStudio({ ownerName, voice, configured }: { ownerName: string | null; voice: VoiceSettings; configured: boolean }) {
  const router = useRouter();
  const [rerecord, setRerecord] = useState(false);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [wav, setWav] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sample, setSample] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const hasVoice = Boolean(voice.voiceId) && !rerecord;

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    setWav(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Não consegui usar o microfone. Libere o acesso ao microfone no navegador e tente de novo.");
      return;
    }
    chunks.current = [];
    const rec = new MediaRecorder(stream.current);
    recorder.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = async () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      try {
        const out = await toWav(new Blob(chunks.current, { type: rec.mimeType }));
        setWav({ blob: out.wav, url: URL.createObjectURL(out.wav), seconds: out.seconds });
        setPhase("recorded");
      } catch {
        setError("Não consegui processar a gravação. Tente de novo.");
        setPhase("idle");
      }
    };
    rec.start();
    setSeconds(0);
    setPhase("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }

  async function upload() {
    if (!wav) return;
    setError(null);
    setPhase("uploading");
    const form = new FormData();
    form.set("audio", wav.blob, "minha-voz.wav");
    form.set("consent", "true");
    try {
      const res = await fetch("/api/voice", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não consegui criar a voz agora.");
        setPhase("recorded");
        return;
      }
      setDone(true);
      setRerecord(false);
      setPhase("idle");
      setWav(null);
      router.refresh();
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
      setPhase("recorded");
    }
  }

  function preview() {
    setError(null);
    startTransition(async () => {
      const r = await previewMyVoice();
      if (r.error) setError(r.error);
      else setSample(r.url ?? null);
    });
  }

  function remove() {
    if (!window.confirm("Apagar a sua voz? O assistente volta a responder só em texto.")) return;
    startTransition(async () => {
      const r = await deleteMyVoice();
      if (r.error) setError(r.error);
      else {
        setSample(null);
        setDone(false);
        router.refresh();
      }
    });
  }

  if (!configured) {
    return (
      <p className="note note-warn">
        O serviço de voz ainda não foi configurado neste sistema (falta a chave do Fish Audio no servidor). Peça ao suporte para ativar.
      </p>
    );
  }

  if (hasVoice) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <div className="note note-ok stack" style={{ gap: 4 }}>
          <b>{done ? "Voz criada!" : "Sua voz está pronta."}</b>
          <span>
            {voice.voiceName ?? "Minha voz"}
            {voice.createdAt ? ` · criada em ${new Date(voice.createdAt).toLocaleDateString("pt-BR")}` : ""}
          </span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn-solid btn-sm" onClick={preview} disabled={pending}>
              {pending ? "Gerando…" : "Ouvir um exemplo"}
            </button>
            <button type="button" className="btn-line btn-sm" onClick={() => setRerecord(true)} disabled={pending}>
              Gravar de novo
            </button>
            <button type="button" className="btn-text" onClick={remove} disabled={pending}>
              Apagar minha voz
            </button>
          </div>
          {sample && <audio controls src={sample} style={{ width: "100%" }} />}
        </div>
        <p className="small muted">
          Em Conta → Mensagens de voz você escolhe quando o assistente responde em áudio. Nas primeiras semanas, com a aprovação ligada, você ouve cada áudio antes de ele sair.
        </p>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} />
        <span className="small">
          Declaro que <b>esta é a minha própria voz</b> e autorizo o uso dela para criar uma voz digital que o assistente usará para enviar mensagens de voz em meu nome, nas conversas de
          WhatsApp que eu permitir. A gravação é enviada ao serviço de voz (Fish Audio) só para criar a voz, e eu posso apagá-la a qualquer momento nesta tela.
        </span>
      </label>

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Leia em voz alta, de forma natural (de {MIN_SECONDS} a {MAX_SECONDS} segundos):</span>
        <blockquote style={{ margin: 0, padding: "12px 14px", background: "var(--surface-3)", borderRadius: "var(--radius-sm)", lineHeight: 1.5 }}>{readingText(ownerName)}</blockquote>
        <p className="hint" style={{ margin: 0 }}>
          Dica: grave num lugar silencioso, perto do microfone, sem ninguém falando ao fundo.
        </p>
      </div>

      {phase === "idle" && (
        <div>
          <button type="button" className="btn-solid" onClick={start} disabled={!consent}>
            {consent ? "Começar a gravar" : "Marque a confirmação para gravar"}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="stack" style={{ gap: 8 }} role="status">
          <b>Gravando… {seconds}s</b>
          <div>
            <button type="button" className="btn-solid" onClick={stop} disabled={seconds < MIN_SECONDS}>
              {seconds < MIN_SECONDS ? `Continue lendo (mínimo ${MIN_SECONDS}s)` : "Parar"}
            </button>
          </div>
        </div>
      )}

      {(phase === "recorded" || phase === "uploading") && wav && (
        <div className="stack" style={{ gap: 10 }}>
          <b className="small">Ouça como ficou ({Math.round(wav.seconds)}s):</b>
          <audio controls src={wav.url} style={{ width: "100%" }} />
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn-solid" onClick={upload} disabled={phase === "uploading" || wav.seconds < 10}>
              {phase === "uploading" ? "Criando a sua voz…" : "Usar esta gravação"}
            </button>
            <button type="button" className="btn-line" onClick={start} disabled={phase === "uploading"}>
              Gravar de novo
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
