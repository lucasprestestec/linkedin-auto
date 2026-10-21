"use client";

import { useRef, useState, useTransition } from "react";
import { encodeWav, VOICE_SAMPLE_RATE } from "@/lib/wav";
import { DEAL_LABEL, formatBRL } from "@/lib/deal";
import type { UpdateProposal } from "@/lib/leadUpdate";
import { applyVoiceUpdate } from "./actions";

const MAX_SECONDS = 90;
type Phase = "idle" | "recording" | "working" | "preview" | "done" | "error";

const shortDate = (due: string) => `${due.slice(8, 10)}/${due.slice(5, 7)}`;

// "Atualizar por voz": o corretor grava o que aconteceu, o sistema propõe as mudanças e ele confirma item por item.
// Nada vai para a ficha sem o "Aplicar".
export function LeadVoiceUpdate({ leadId }: { leadId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ transcript: string; proposal: UpdateProposal } | null>(null);
  const [picks, setPicks] = useState({ note: true, personal: true, deal: true, tasks: [] as number[] });
  const [pending, start] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunks = useRef<Blob[]>([]);

  function fail(message: string) {
    setError(message);
    setPhase("error");
  }

  async function begin() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void send(new Blob(chunks.current, { type: rec.mimeType }));
      };
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setPhase("recording");
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      fail("Não consegui usar o microfone. Libere o microfone para este site no navegador e tente de novo.");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function send(blob: Blob) {
    setPhase("working");
    try {
      // O navegador grava em formato próprio (webm/mp4): convertemos para WAV mono 16 kHz, que o modelo sempre aceita.
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      void ctx.close();
      const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * VOICE_SAMPLE_RATE)), VOICE_SAMPLE_RATE);
      const src = off.createBufferSource();
      src.buffer = audio;
      src.connect(off.destination);
      src.start();
      const wav = encodeWav((await off.startRendering()).getChannelData(0));
      const res = await fetch(`/api/leads/${leadId}/voice-update`, { method: "POST", headers: { "content-type": "audio/wav" }, body: wav });
      const json = (await res.json().catch(() => ({}))) as { error?: string; transcript?: string; proposal?: UpdateProposal };
      if (!res.ok || !json.proposal) return fail(json.error ?? "Não consegui processar o áudio. Tente de novo.");
      setResult({ transcript: json.transcript ?? "", proposal: json.proposal });
      setPicks({ note: true, personal: true, deal: true, tasks: json.proposal.tasks.map((_, i) => i) });
      setPhase("preview");
    } catch {
      fail("Não consegui processar o áudio. Tente de novo.");
    }
  }

  function apply() {
    if (!result) return;
    start(async () => {
      const r = await applyVoiceUpdate(leadId, result.proposal, picks);
      if ("error" in r && r.error) return fail(r.error);
      setPhase("done");
    });
  }

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setError(null);
  };

  if (phase === "idle")
    return (
      <button type="button" className="summary-btn" onClick={begin}>
        Atualizar por voz
      </button>
    );

  if (phase === "recording")
    return (
      <div className="summary-box" role="status">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <b>Gravando… {seconds}s de {MAX_SECONDS}s</b>
          <button type="button" className="btn-solid btn-sm" onClick={stop}>
            Parar e enviar
          </button>
        </div>
        <p className="muted small">Conte o que aconteceu: com quem falou, o que ficou combinado e quando. Nada é gravado na ficha antes de você confirmar.</p>
      </div>
    );

  if (phase === "working")
    return (
      <div className="summary-box" role="status">
        <b>Entendendo o áudio…</b>
      </div>
    );

  if (phase === "error")
    return (
      <div className="summary-box" role="alert">
        <p className="field-error">{error}</p>
        <button type="button" className="btn-text" onClick={reset}>
          Fechar
        </button>
      </div>
    );

  if (phase === "done")
    return (
      <div className="summary-box" role="status">
        <b>Ficha atualizada.</b>{" "}
        <button type="button" className="btn-text" onClick={reset}>
          Fechar
        </button>
      </div>
    );

  const p = result!.proposal;
  const nothing = !p.note && !p.personal && p.tasks.length === 0 && !p.deal;
  const toggle = (key: "note" | "personal" | "deal") => setPicks((s) => ({ ...s, [key]: !s[key] }));
  const toggleTask = (i: number) => setPicks((s) => ({ ...s, tasks: s.tasks.includes(i) ? s.tasks.filter((x) => x !== i) : [...s.tasks, i] }));

  return (
    <div className="summary-box">
      <b>{p.summary || "O que entendi"}</b>
      {nothing ? (
        <p className="muted small">Não encontrei nada para mudar na ficha.</p>
      ) : (
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          {p.note && (
            <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={picks.note} onChange={() => toggle("note")} />
              <span>
                <b>Anotar:</b> {p.note}
              </span>
            </label>
          )}
          {p.personal && (
            <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={picks.personal} onChange={() => toggle("personal")} />
              <span>
                <b>Somar ao que você sabe da pessoa:</b> {p.personal}
              </span>
            </label>
          )}
          {p.tasks.map((t, i) => (
            <label key={i} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={picks.tasks.includes(i)} onChange={() => toggleTask(i)} />
              <span>
                <b>Lembrete:</b> {t.title} {t.due ? `· ${shortDate(t.due)}` : "· sem data"}
              </span>
            </label>
          ))}
          {p.deal && (
            <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={picks.deal} onChange={() => toggle("deal")} />
              <span>
                <b>Resultado:</b> {DEAL_LABEL[p.deal.stage]}
                {p.deal.valueCents ? ` · ${formatBRL(p.deal.valueCents)}` : ""}
                {p.deal.reason ? ` · ${p.deal.reason}` : ""}
              </span>
            </label>
          )}
        </div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary className="muted small">O que eu ouvi</summary>
        <p className="muted small" style={{ whiteSpace: "pre-line" }}>
          {result!.transcript}
        </p>
      </details>
      <div className="form-actions" style={{ marginTop: 10 }}>
        {!nothing && (
          <button type="button" className="btn-solid btn-sm" onClick={apply} disabled={pending}>
            {pending ? "Aplicando…" : "Aplicar o que marquei"}
          </button>
        )}
        <button type="button" className="btn-text" onClick={reset}>
          Descartar
        </button>
      </div>
    </div>
  );
}
