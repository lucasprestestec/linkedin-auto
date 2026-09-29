import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { IconClock, IconEye, IconSparkles } from "@/components/Icons";
import { emailConnection } from "@/lib/email";
import { emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
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
// prospecção; e-mail e WhatsApp são camadas a mais que a secretária usa quando
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
    <main className="page account">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Seus <span className="name-grad">canais.</span>
        </h1>
        <p className="hero-sub">Por onde a secretária fala com as pessoas. Cada canal é independente: conecte só o que fizer sentido.</p>
      </header>

      <div className="account-col">
        <section className="group rise">
          <h2 className="group-title">LinkedIn</h2>
          <LinkedinCard settings={settings} status={status} />
          <p className="tiny faint channel-foot">
            Hoje: {linkedinToday} de {settings.dailyMessageLimit} mensagens.
          </p>
        </section>

        <section className="group rise">
          <h2 className="group-title">E-mail</h2>
          <EmailCard
            googleAddress={settings.googleEmail}
            expired={Boolean(settings.googleEmail && !settings.googleRefreshToken)}
            fallbackAddress={email?.provider === "password" ? email.address : null}
            result={typeof emailResult === "string" ? emailResult : null}
          />
          {email && (
            <>
              <div className="card" style={{ overflow: "hidden", marginTop: 10 }}>
                <EmailChannelOptions enabled={settings.emailChannelEnabled} dailyLimit={settings.dailyEmailLimit} fallbackDays={settings.emailInviteFallbackDays} />
              </div>
              <p className="tiny faint channel-foot">
                Hoje: {emailToday} de {settings.dailyEmailLimit} e-mails · Últimos 7 dias: {openedWeek} de {sentWeek} abertos
              </p>
            </>
          )}
        </section>

        <section className="group rise">
          <h2 className="group-title">WhatsApp</h2>
          <WhatsappCard
            host={settings.deskcommUrl ? new URL(settings.deskcommUrl).host : null}
            channelId={settings.deskcommChannelId}
            enabled={settings.whatsappChannelEnabled}
            dailyLimit={settings.dailyWhatsappLimit}
            sentToday={whatsappToday}
          />
        </section>

        <section className="group rise">
          <h2 className="group-title">Como a secretária decide</h2>
          <div className="card card-pad stack decide-card" style={{ gap: 12 }}>
            <p className="small">
              <IconSparkles size={16} /> Quando alguém não responde, ela olha os sinais e escolhe o próximo passo: <b>retomar</b> por um dos canais,{" "}
              <b>esperar</b> um pouco mais ou <b>encerrar</b>.
            </p>
            <p className="small">
              <IconEye size={16} /> Abriu o e-mail e não respondeu? É um sinal de interesse: ela tenta de novo, de preferência por outro canal. Nunca
              diz à pessoa que sabe que ela abriu.
            </p>
            <p className="small">
              <IconClock size={16} /> Respeita o horário de trabalho, os limites de cada canal e o número de retomadas da campanha. Nada de sinal
              depois disso, ela encerra.
            </p>
            <p className="tiny faint">Em cada conversa, o campo &quot;Próximo passo&quot; mostra o que ela decidiu e por quê.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
