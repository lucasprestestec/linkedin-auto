import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { fishConfigured } from "@/lib/voice/fish";
import { elevenConfigured } from "@/lib/voice/elevenlabs";
import { EMPTY_VOICE, parseVoiceSettings } from "@/lib/voice/settings";
import { VoicePicker } from "./VoicePicker";
import { VoiceStudio } from "./VoiceStudio";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true, ownerName: true } });
  const voice = parseVoiceSettings(settings.voiceSettings);
  const picked = voice.provider === "elevenlabs" && voice.voiceId ? voice : null;

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Voz do assistente</h1>
          <p className="t-sub">Escolha uma voz pronta da lista ou grave a sua própria. É a voz dos áudios que o assistente manda no WhatsApp.</p>
        </div>
        <Link href="/settings#voz" className="btn-text">
          Sair
        </Link>
      </header>
      <section className="sec">
        <h2 className="t-label">Escolher uma voz pronta</h2>
        <VoicePicker currentId={picked?.voiceId ?? null} configured={elevenConfigured()} />
      </section>
      <section className="sec">
        <h2 className="t-label">Gravar a minha voz</h2>
        <VoiceStudio ownerName={settings.ownerName?.trim() || null} voice={voice.provider === "fish" ? voice : EMPTY_VOICE} configured={fishConfigured()} />
      </section>
    </main>
  );
}
