import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { ChannelTitle } from "@/components/ChannelBadge";
import { Help } from "@/components/Help";
import { emailConnection } from "@/lib/email";
import { emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
import { fixedDeskcommUrl } from "@/lib/deskcomm";
import { WhatsappCard } from "./WhatsappCard";
import { EmailCard } from "../settings/EmailCard";
import { EmailChannelOptions } from "./EmailChannelOptions";
import { LinkedinCard, linkedinStatus } from "./LinkedinCard";

export const dynamic = "force-dynamic";

// E-mails com rastreio enviados nos últimos 7 dias e quantos foram abertos.
async function emailWeek() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const base = { channel: "EMAIL" as const, sender: { not: "LEAD" as const }, openToken: { not: null }, createdAt: { gte: weekAgo } };
  const [sentWeek, openedWeek] = await Promise.all([prisma.message.count({ where: base }), prisma.message.count({ where: { ...base, openCount: { gt: 0 } } })]);
  return { sentWeek, openedWeek };
}

// Canais: cada um conecta, liga e desliga por conta própria. O LinkedIn é a
// prospecção; e-mail e WhatsApp são camadas a mais que o assistente usa quando
// os sinais indicam que vale a pena.
export default async function ChannelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const emailResult = (await searchParams).email;
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const [status, email, linkedinToday, emailToday, whatsappToday, { sentWeek, openedWeek }] = await Promise.all([
    linkedinStatus(settings),
    emailConnection(),
    messagesSentToday(),
    emailsSentToday(),
    whatsappSentToday(),
    emailWeek(),
  ]);

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">
            Canais{" "}
            <Help>
              Quando alguém não responde, o assistente olha os sinais e escolhe: retomar por um canal, esperar mais um pouco ou encerrar. Se a pessoa abriu o
              e-mail e não respondeu, ela tenta de novo, de preferência por outro canal, sem dizer que sabe que foi aberto. Tudo respeita seu horário de
              trabalho e os limites de cada canal.
            </Help>
          </h1>
          <p className="t-sub">Por onde o assistente fala com as pessoas. Conecte só o que fizer sentido.</p>
        </div>
      </header>

      <section className="sec">
        <ChannelTitle channel="LINKEDIN" />
        <LinkedinCard settings={settings} status={status} today={`Hoje: ${linkedinToday} de ${settings.dailyMessageLimit} mensagens`} />
      </section>

      <section className="sec">
        <ChannelTitle channel="EMAIL" />
        <EmailCard
          googleAddress={settings.googleEmail}
          expired={Boolean(settings.googleEmail && !settings.googleRefreshToken)}
          fallbackAddress={email?.provider === "password" ? email.address : null}
          result={typeof emailResult === "string" ? emailResult : null}
        />
        {email && (
          <>
            <EmailChannelOptions enabled={settings.emailChannelEnabled} dailyLimit={settings.dailyEmailLimit} fallbackDays={settings.emailInviteFallbackDays} />
            <p className="hint">
              Hoje: {emailToday} de {settings.dailyEmailLimit} e-mails · últimos 7 dias: {openedWeek} de {sentWeek} abertos
            </p>
          </>
        )}
      </section>

      <section className="sec">
        <ChannelTitle channel="WHATSAPP" />
        <WhatsappCard
          host={settings.deskcommUrl ? new URL(settings.deskcommUrl).host : null}
          channelId={settings.deskcommChannelId}
          fixedAddress={fixedDeskcommUrl() !== null}
          enabled={settings.whatsappChannelEnabled}
          dailyLimit={settings.dailyWhatsappLimit}
          sentToday={whatsappToday}
        />
      </section>
    </main>
  );
}
