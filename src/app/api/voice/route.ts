import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createVoice, deleteVoice, fishConfigured, VoiceError } from "@/lib/voice/fish";
import { parseVoiceSettings } from "@/lib/voice/settings";
import { isWav, wavSeconds } from "@/lib/voice/wav";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const MIN_SECONDS = 10;
const MAX_SECONDS = 90;
const MAX_BYTES = 4 * 1024 * 1024;

// Cria a voz do usuário a partir da gravação dele (multipart: audio + consent). Só com o consentimento
// marcado: a voz é dele e ele autoriza o uso. A chave do serviço de voz nunca sai do servidor.
export async function POST(req: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }
  if (!fishConfigured()) return NextResponse.json({ error: "O serviço de voz ainda não foi configurado." }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Não consegui ler a gravação." }, { status: 400 });
  }
  if (form.get("consent") !== "true") {
    return NextResponse.json({ error: "Marque a confirmação de que a voz é sua e que você autoriza o uso." }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Falta a gravação." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "A gravação ficou grande demais. Grave um trecho mais curto." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWav(bytes)) return NextResponse.json({ error: "Formato de gravação inválido. Grave de novo por esta tela." }, { status: 400 });
  const seconds = wavSeconds(bytes) ?? 0;
  if (seconds < MIN_SECONDS) return NextResponse.json({ error: `A gravação ficou curta (${Math.round(seconds)} s). Grave pelo menos ${MIN_SECONDS} segundos.` }, { status: 400 });
  if (seconds > MAX_SECONDS) return NextResponse.json({ error: `A gravação ficou longa demais. O máximo é ${MAX_SECONDS} segundos.` }, { status: 400 });

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { ownerName: true, voiceSettings: true } });
  const previous = parseVoiceSettings(settings.voiceSettings);
  const name = settings.ownerName?.trim() || "Minha voz";

  let created: { id: string };
  try {
    created = await createVoice(`Voz de ${name}`, [{ bytes, filename: "minha-voz.wav", mime: "audio/wav" }]);
  } catch (err) {
    const msg = err instanceof VoiceError ? err.message : "Não consegui criar a voz agora.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const now = new Date().toISOString();
  const next = { mode: previous.mode, voiceId: created.id, voiceName: `Voz de ${name}`, consentAt: now, createdAt: now };
  await prisma.settings.update({ where: { id: "singleton" }, data: { voiceSettings: next as unknown as Prisma.InputJsonValue } });
  // Voz anterior (regravação): some do serviço, melhor esforço.
  if (previous.voiceId && previous.voiceId !== created.id) await deleteVoice(previous.voiceId).catch(() => {});
  return NextResponse.json({ ok: true, voiceName: next.voiceName });
}
