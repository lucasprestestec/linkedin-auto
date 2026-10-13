import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { fishConfigured } from "@/lib/voice/fish";
import { parseVoiceSettings } from "@/lib/voice/settings";
import { VoiceStudio } from "./VoiceStudio";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { voiceSettings: true, ownerName: true } });

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Minha voz</h1>
          <p className="t-sub">Grave a sua voz uma vez e o assistente poderá responder em áudio, falando como você.</p>
        </div>
        <Link href="/settings#voz" className="btn-text">
          Sair
        </Link>
      </header>
      <section className="sec">
        <VoiceStudio ownerName={settings.ownerName?.trim() || null} voice={parseVoiceSettings(settings.voiceSettings)} configured={fishConfigured()} />
      </section>
    </main>
  );
}
