// Testes de voz e mídia (sem banco e sem IA de verdade): npx tsx scripts/test-voice.ts
import assert from "node:assert/strict";
import { config } from "dotenv";
config({ path: ".env.local" });

import { prepareSpeechText, speechIssues, MAX_SPEECH_CHARS } from "../src/lib/voice/speech";
import { AUDIO_MODES, decideAudio, hasVoice, parseVoiceSettings, summarizeVoice } from "../src/lib/voice/settings";
import { encodeWav, isWav, wavSeconds } from "../src/lib/voice/wav";
import { createVoice, deleteVoice, synthesize, VoiceError } from "../src/lib/voice/fish";
import { buildParts, formatMediaMessage, mediaKindOf, understandMedia, MEDIA_MODEL_DEFAULT, MEDIA_MODEL_FALLBACK } from "../src/lib/mediaUnderstanding";
import { planInbound, MEDIA_PENDING_GRACE_MS } from "../src/lib/whatsappMedia";

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => console.log(`ok   ${name}`, ++n && ""),
      (e) => {
        console.log(`FALHOU ${name}\n   ${e instanceof Error ? e.message : e}`);
        process.exitCode = 1;
      },
    );

const realFetch = globalThis.fetch;
function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}
const restore = () => (globalThis.fetch = realFetch);

(async () => {
  // ---------------- texto falado ----------------
  await t("fala: tira emoji, link e marcação; lê R$ e % por extenso", () => {
    const out = prepareSpeechText("Oi! 😊 Veja https://x.com/a e **combinado**: R$ 1.200,50 com 35% de reajuste");
    assert.ok(!/😊|https|\*\*/.test(out), out);
    assert.match(out, /1\.200,50 reais/);
    assert.match(out, /35 por cento/);
    assert.match(out, /[.!?]$/);
  });

  await t("fala: abreviações de chat viram palavras; quebras viram pausas", () => {
    const out = prepareSpeechText("vc pode falar hj? tbm blz\nobg");
    assert.match(out, /você pode falar hoje\? também beleza\. obrigado\.$/);
    assert.equal(prepareSpeechText("   \n  "), "");
    assert.equal(prepareSpeechText("Pode ser às 15h"), "Pode ser às 15h.");
  });

  await t("fala: o que não cabe em áudio", () => {
    assert.deepEqual(speechIssues("Oi, tudo bem? Quantas pessoas vocês são?"), []);
    assert.ok(speechIssues("x".repeat(MAX_SPEECH_CHARS + 1))[0].includes("longa demais"));
    assert.ok(speechIssues("Veja em https://site.com/x")[0].includes("link"));
    assert.ok(speechIssues("www.site.com.br")[0].includes("link"));
    assert.ok(speechIssues("Me chama no 51 99999-1234")[0].includes("número longo"));
    assert.deepEqual(speechIssues("Somos 32 pessoas e o reajuste foi de 35%"), []);
    assert.deepEqual(speechIssues("  "), ["vazia"]);
  });

  // ---------------- preferências de voz ----------------
  const ready = parseVoiceSettings({ mode: "mirror", voiceId: "v1", voiceName: "Voz de Ana", consentAt: "2026-09-30T12:00:00.000Z", createdAt: "2026-09-30T12:00:00.000Z" });

  await t("voz: lixo vira 'sem voz, só texto'; sem voz o modo volta a só texto", () => {
    for (const bad of [null, undefined, 3, "x", [], { mode: "xyz" }]) {
      const s = parseVoiceSettings(bad);
      assert.equal(s.mode, "off");
      assert.equal(s.voiceId, null);
      assert.ok(!hasVoice(s));
    }
    assert.equal(parseVoiceSettings({ mode: "always" }).mode, "off");
    assert.equal(ready.mode, "mirror");
    assert.ok(hasVoice(ready));
    assert.ok(!hasVoice(parseVoiceSettings({ voiceId: "v1" })), "sem consentimento não vale");
  });

  await t("voz: resumo e opções", () => {
    assert.match(summarizeVoice(parseVoiceSettings({})), /ainda não criada/);
    assert.match(summarizeVoice(ready), /pronta.*áudio quando o lead mandar áudio/);
    assert.deepEqual(AUDIO_MODES.map((m) => m.value), ["off", "mirror", "always"]);
  });

  await t("quando mandar áudio: matriz de modos, canais e serviço", () => {
    const ok = { channel: "WHATSAPP" as const, inboundKind: "audio", serviceReady: true };
    assert.equal(decideAudio({ settings: ready, ...ok }), true, "espelho: lead mandou áudio");
    assert.equal(decideAudio({ settings: ready, ...ok, inboundKind: null }), false, "espelho: lead mandou texto");
    assert.equal(decideAudio({ settings: ready, ...ok, inboundKind: "image" }), false, "espelho: foto não conta");
    const always = { ...ready, mode: "always" as const };
    assert.equal(decideAudio({ settings: always, ...ok, inboundKind: null }), true);
    assert.equal(decideAudio({ settings: { ...ready, mode: "off" }, ...ok }), false);
    assert.equal(decideAudio({ settings: always, ...ok, channel: "LINKEDIN" }), false, "só WhatsApp");
    assert.equal(decideAudio({ settings: always, ...ok, channel: "EMAIL" }), false);
    assert.equal(decideAudio({ settings: always, ...ok, serviceReady: false }), false, "serviço fora do ar");
    assert.equal(decideAudio({ settings: { ...always, consentAt: null }, ...ok }), false, "sem consentimento");
    assert.equal(decideAudio({ settings: { ...always, voiceId: null }, ...ok }), false, "sem voz");
  });

  // ---------------- WAV ----------------
  await t("wav: cabeçalho, duração e amostras", () => {
    const rate = 24000;
    const samples = new Float32Array(rate * 2).map((_, i) => Math.sin(i / 10));
    const buf = new Uint8Array(encodeWav(samples, rate));
    assert.ok(isWav(buf));
    assert.equal(buf.length, 44 + samples.length * 2);
    assert.ok(Math.abs((wavSeconds(buf) ?? 0) - 2) < 0.001);
    assert.equal(wavSeconds(new Uint8Array([1, 2, 3])), null);
    assert.ok(!isWav(new Uint8Array(100)));
    const clipped = new DataView(encodeWav(new Float32Array([2, -2]), rate));
    assert.equal(clipped.getInt16(44, true), 32767);
    assert.equal(clipped.getInt16(46, true), -32768);
  });

  // ---------------- Fish Audio ----------------
  process.env.FISH_AUDIO_API_KEY = "chave-de-teste";

  await t("fish: criar voz manda o formulário certo e devolve o id", async () => {
    const calls = mockFetch(() => new Response(JSON.stringify({ _id: "voz-123", state: "created" }), { status: 201 }));
    const r = await createVoice("Voz de Ana", [{ bytes: new Uint8Array([1, 2, 3]), filename: "a.wav", mime: "audio/wav" }]);
    restore();
    assert.deepEqual(r, { id: "voz-123", state: "created" });
    assert.equal(calls[0].url, "https://api.fish.audio/model");
    assert.equal(calls[0].init.method, "POST");
    assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer chave-de-teste");
    const form = calls[0].init.body as FormData;
    assert.equal(form.get("type"), "tts");
    assert.equal(form.get("train_mode"), "fast");
    assert.equal(form.get("visibility"), "private");
    assert.equal(form.get("title"), "Voz de Ana");
    assert.ok(form.get("voices") instanceof Blob);
  });

  await t("fish: falar manda o texto, a voz e o formato e devolve MP3", async () => {
    const calls = mockFetch(() => new Response(new Uint8Array(2000), { status: 200 }));
    const r = await synthesize("Oi, tudo bem?", "voz-123");
    restore();
    assert.equal(r.mime, "audio/mpeg");
    assert.equal(r.bytes.length, 2000);
    assert.equal(calls[0].url, "https://api.fish.audio/v1/tts");
    const h = calls[0].init.headers as Record<string, string>;
    assert.equal(h.model, "s2.1-pro-free", "sem configuração, usa o modelo gratuito");
    assert.equal(h.authorization, "Bearer chave-de-teste");
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.text, "Oi, tudo bem?");
    assert.equal(body.reference_id, "voz-123");
    assert.equal(body.format, "mp3");
  });

  await t("fish: modelo pago como primeira opção; sem saldo nele, cai pro gratuito", async () => {
    process.env.FISH_AUDIO_MODEL = "s2.1-pro";
    const used: string[] = [];
    mockFetch((_url, init) => {
      const model = (init.headers as Record<string, string>).model;
      used.push(model);
      return model === "s2.1-pro" ? new Response("{}", { status: 402 }) : new Response(new Uint8Array(2000), { status: 200 });
    });
    const r = await synthesize("Oi", "v");
    assert.deepEqual(used, ["s2.1-pro", "s2.1-pro-free"]);
    assert.equal(r.bytes.length, 2000);
    // com saldo no pago, o gratuito nem é chamado
    used.length = 0;
    mockFetch((_url, init) => (used.push((init.headers as Record<string, string>).model), new Response(new Uint8Array(2000), { status: 200 })));
    await synthesize("Oi", "v");
    assert.deepEqual(used, ["s2.1-pro"]);
    // sem saldo também no gratuito: o erro aparece (com o status)
    mockFetch(() => new Response("{}", { status: 402 }));
    await assert.rejects(synthesize("Oi", "v"), (e) => e instanceof VoiceError && e.status === 402 && /sem saldo na API/.test(e.message));
    // outros erros do pago não escondem: não cai pro gratuito
    used.length = 0;
    mockFetch((_url, init) => (used.push((init.headers as Record<string, string>).model), new Response("x", { status: 500 })));
    await assert.rejects(synthesize("Oi", "v"), /respondeu 500/);
    assert.deepEqual(used, ["s2.1-pro"]);
    delete process.env.FISH_AUDIO_MODEL;
    restore();
  });

  await t("fish: apagar usa DELETE /model/{id}", async () => {
    const calls = mockFetch(() => new Response("{}", { status: 200 }));
    await deleteVoice("voz 123");
    restore();
    assert.equal(calls[0].url, "https://api.fish.audio/model/voz%20123");
    assert.equal(calls[0].init.method, "DELETE");
  });

  await t("fish: erros viram mensagens em português", async () => {
    const cases: [number, RegExp][] = [[401, /recusou a chave/], [402, /sem saldo/], [429, /ocupado/], [500, /respondeu 500/]];
    for (const [status, rx] of cases) {
      mockFetch(() => new Response("x", { status }));
      await assert.rejects(synthesize("oi", "v"), (e) => e instanceof VoiceError && rx.test(e.message));
    }
    mockFetch(() => Promise.reject(new Error("rede")));
    await assert.rejects(synthesize("oi", "v"), (e) => e instanceof VoiceError && /Não consegui falar/.test(e.message));
    mockFetch(() => new Response(new Uint8Array(10), { status: 200 }));
    await assert.rejects(synthesize("oi", "v"), (e) => e instanceof VoiceError && /vazio/.test(e.message));
    mockFetch(() => new Response(JSON.stringify({ _id: "x", state: "failed" }), { status: 201 }));
    await assert.rejects(createVoice("t", [{ bytes: new Uint8Array(1), filename: "a.wav", mime: "audio/wav" }]), /Não foi possível criar a voz/);
    restore();
    await assert.rejects(createVoice("t", []), /Falta a gravação/);
  });

  await t("fish: sem chave configurada não tenta chamar", async () => {
    const saved = process.env.FISH_AUDIO_API_KEY;
    delete process.env.FISH_AUDIO_API_KEY;
    const calls = mockFetch(() => new Response("{}"));
    await assert.rejects(synthesize("oi", "v"), /ainda não foi configurado/);
    restore();
    assert.equal(calls.length, 0);
    process.env.FISH_AUDIO_API_KEY = saved;
  });

  // ---------------- entender mídia ----------------
  await t("mídia: tipo da mensagem -> o que entendemos", () => {
    assert.equal(mediaKindOf("audio"), "audio");
    assert.equal(mediaKindOf("ptt"), "audio");
    assert.equal(mediaKindOf("document", "audio/ogg; codecs=opus"), "audio");
    assert.equal(mediaKindOf("image"), "image");
    assert.equal(mediaKindOf("video"), "video");
    assert.equal(mediaKindOf("sticker", "image/webp"), null, "figurinha não");
    assert.equal(mediaKindOf("location"), null);
    assert.equal(mediaKindOf("text"), null);
  });

  await t("mídia: como aparece na conversa", () => {
    assert.equal(formatMediaMessage("audio", " Oi, tudo bem? "), "[Áudio] Oi, tudo bem?");
    assert.equal(formatMediaMessage("image", "Uma proposta", "olha isso"), "[Foto] Uma proposta\nLegenda: olha isso");
    assert.match(formatMediaMessage("video", "x"), /^\[Vídeo\] /);
  });

  await t("mídia: partes enviadas ao modelo (formato do áudio, imagem e vídeo)", () => {
    const b = Buffer.from("abc");
    assert.deepEqual(buildParts("audio", b, "audio/ogg; codecs=opus")[0], { type: "input_audio", input_audio: { data: b.toString("base64"), format: "ogg" } });
    assert.equal((buildParts("audio", b, "audio/mpeg")[0] as { input_audio: { format: string } }).input_audio.format, "mp3");
    assert.match(String((buildParts("image", b, "image/png")[0] as { image_url: { url: string } }).image_url.url), /^data:image\/png;base64,/);
    assert.match(String((buildParts("video", b, null)[0] as { video_url: { url: string } }).video_url.url), /^data:video\/mp4;base64,/);
  });

  const okFetch = (body = "áudio", type = "audio/ogg") => (async () => new Response(Buffer.from(body), { status: 200, headers: { "content-type": type } })) as unknown as typeof fetch;

  await t("mídia: sucesso usa o modelo padrão e devolve o texto", async () => {
    const models: string[] = [];
    const r = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: okFetch(), ask: async (m) => (models.push(m), "Somos 32 pessoas") });
    assert.deepEqual(r, { ok: true, text: "Somos 32 pessoas", model: MEDIA_MODEL_DEFAULT });
    assert.deepEqual(models, [MEDIA_MODEL_DEFAULT]);
  });

  await t("mídia: se o modelo padrão falha, tenta o reserva", async () => {
    const models: string[] = [];
    const r = await understandMedia(
      { url: "https://x.test/a.ogg", kind: "audio" },
      { fetchFn: okFetch(), ask: async (m) => { models.push(m); if (m === MEDIA_MODEL_DEFAULT) throw new Error("fora do ar"); return "Oi"; } },
    );
    assert.deepEqual(models, [MEDIA_MODEL_DEFAULT, MEDIA_MODEL_FALLBACK]);
    assert.equal(r.ok && r.model, MEDIA_MODEL_FALLBACK);
    const empty = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: okFetch(), ask: async (m) => (m === MEDIA_MODEL_DEFAULT ? "" : "Oi") });
    assert.equal(empty.ok && empty.model, MEDIA_MODEL_FALLBACK);
  });

  await t("mídia: falhas viram motivo legível (sem fala, arquivo, tamanho, modelo)", async () => {
    const noSpeech = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: okFetch(), ask: async () => "(sem fala)" });
    assert.deepEqual(noSpeech, { ok: false, reason: "o áudio não tem fala" });
    const notFound = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: (async () => new Response("", { status: 404 })) as unknown as typeof fetch, ask: async () => "x" });
    assert.deepEqual(notFound, { ok: false, reason: "o arquivo não está disponível (404)" });
    const bad = await understandMedia({ url: "não é url", kind: "image" }, { ask: async () => "x" });
    assert.deepEqual(bad, { ok: false, reason: "endereço da mídia inválido" });
    const ftp = await understandMedia({ url: "ftp://x.test/a", kind: "image" }, { ask: async () => "x" });
    assert.equal(ftp.ok, false);
    const big = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: (async () => new Response("x", { status: 200, headers: { "content-length": String(50 * 1024 * 1024) } })) as unknown as typeof fetch, ask: async () => "x" });
    assert.deepEqual(big, { ok: false, reason: "arquivo grande demais" });
    const empty = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: (async () => new Response("", { status: 200 })) as unknown as typeof fetch, ask: async () => "x" });
    assert.deepEqual(empty, { ok: false, reason: "arquivo vazio" });
    const down = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: (async () => { throw new Error("rede"); }) as unknown as typeof fetch, ask: async () => "x" });
    assert.deepEqual(down, { ok: false, reason: "não consegui baixar o arquivo" });
    const allFail = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: okFetch(), ask: async () => { throw new Error("quebrou"); } });
    assert.deepEqual(allFail, { ok: false, reason: "quebrou" });
  });

  await t("mídia: texto muito longo é cortado", async () => {
    const r = await understandMedia({ url: "https://x.test/a.ogg", kind: "audio" }, { fetchFn: okFetch(), ask: async () => "a".repeat(9000) });
    assert.ok(r.ok && r.text.length === 2500);
  });

  // ---------------- o que fazer com cada mensagem do WhatsApp ----------------
  const now = new Date("2026-09-30T15:00:00.000Z");
  const msg = (o: Record<string, unknown>) => ({ id: "m", direction: "inbound", type: "text", body: null, sent_at: "2026-09-30T14:59:00.000Z", ...o }) as never;

  await t("whatsapp: texto comum", () => {
    assert.deepEqual(planInbound(msg({ body: " oi " }), now), { action: "text", text: "oi" });
  });

  await t("whatsapp: áudio pronto vira 'media'; foto com legenda leva a legenda", () => {
    const a = planInbound(msg({ type: "audio", media_status: "ready", media_signed_url: "https://s/x", media_mime: "audio/ogg" }), now);
    assert.deepEqual(a, { action: "media", kind: "audio", url: "https://s/x", mime: "audio/ogg", caption: null });
    const f = planInbound(msg({ type: "image", body: "olha", media_status: "ready", media_signed_url: "https://s/y" }), now);
    assert.deepEqual(f, { action: "media", kind: "image", url: "https://s/y", mime: null, caption: "olha" });
  });

  await t("whatsapp: mídia ainda sendo guardada espera, até o prazo; depois desiste", () => {
    assert.deepEqual(planInbound(msg({ type: "audio", media_status: "pending" }), now), { action: "wait" });
    const old = new Date(now.getTime() - MEDIA_PENDING_GRACE_MS - 1000).toISOString();
    assert.deepEqual(planInbound(msg({ type: "audio", media_status: "pending", sent_at: old }), now), { action: "unsupported", label: "um áudio" });
  });

  await t("whatsapp: sem arquivo (Deskcomm antigo) e tipos sem suporte", () => {
    assert.deepEqual(planInbound(msg({ type: "audio" }), now), { action: "unsupported", label: "um áudio" });
    assert.deepEqual(planInbound(msg({ type: "video" }), now), { action: "unsupported", label: "um vídeo" });
    assert.deepEqual(planInbound(msg({ type: "image" }), now), { action: "unsupported", label: "uma foto" });
    assert.deepEqual(planInbound(msg({ type: "image", body: "veja" }), now), { action: "text", text: "veja" }, "só a legenda");
    assert.deepEqual(planInbound(msg({ type: "sticker", media_mime: "image/webp" }), now), { action: "unsupported", label: "um arquivo" });
    assert.deepEqual(planInbound(msg({ type: "location" }), now), { action: "unsupported", label: "um arquivo" });
    assert.deepEqual(planInbound(msg({ type: "contact", body: "Fulano" }), now), { action: "text", text: "Fulano" });
  });

  // ---------------- prompt do agente ----------------
  const { decideResponse, AUDIO_STYLE } = await import("../src/lib/agent");
  async function systemFor(asAudio: boolean) {
    let system = "";
    await decideResponse(
      { instructions: null, lead: { firstName: "Ana", lastName: null, jobTitle: null }, history: [{ sender: "LEAD", content: "[Áudio] Somos 32 pessoas" }], channel: "WHATSAPP", style: null, asAudio },
      {
        model: "x",
        complete: async ({ messages }) => {
          system = String(messages[0].content);
          return {
            id: "t", object: "chat.completion", created: 0, model: "x",
            choices: [{ index: 0, finish_reason: "tool_calls", logprobs: null, message: { role: "assistant", refusal: null, content: null, tool_calls: [{ id: "c", type: "function", function: { name: "respond_to_lead", arguments: JSON.stringify({ analysis: "t", action: "reply", message: "Entendi, são 32 pessoas. Qual a operadora de vocês hoje?" }) } }] } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          } as never;
        },
      },
    ).then((d) => {
      if (d.action === "reply") assert.equal(d.audioOk, true);
    });
    return system;
  }
  await t("agente: pede texto falado quando vai em áudio, e conhece os marcadores de mídia", async () => {
    const spoken = await systemFor(true);
    const written = await systemFor(false);
    assert.ok(spoken.includes(AUDIO_STYLE.slice(0, 40)));
    assert.ok(!written.includes(AUDIO_STYLE.slice(0, 40)));
    assert.match(spoken, /começam com \[Áudio\], \[Foto\] ou \[Vídeo\]/);
    assert.match(written, /WhatsApp: bem curto e informal/);
  });

  console.log(process.exitCode ? "\nHÁ FALHAS" : "\nTodos passaram");
  process.exit(process.exitCode ? 1 : 0);
})();
