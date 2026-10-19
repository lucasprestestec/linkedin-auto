import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { emailConnection } from "@/lib/email";
import { emailsSentToday, messagesSentToday, whatsappSentToday } from "@/lib/limits";
import { deskcommConfigOf, whatsappLiveStatus } from "@/lib/deskcomm";
import { emailLeftToday } from "@/lib/mailboxes";
import { pushPublicKey } from "@/lib/push";
import { DEFAULT_REMINDERS } from "@/lib/meetingReminders";
import { googleConfigured } from "@/lib/gmail";
import { noticeLabel } from "@/lib/slots";
import { MobileHeader } from "@/components/MobileHeader";
import { ChannelBadge, type ChannelKey } from "@/components/ChannelBadge";
import { IconChevronRight } from "@/components/Icons";
import { logout } from "../actions";
import { WhatsappCard } from "../channels/WhatsappCard";
import { EmailChannelOptions } from "../channels/EmailChannelOptions";
import { LinkedinCard, linkedinStatus } from "../channels/LinkedinCard";
import { EmailCard } from "./EmailCard";
import { RefreshPhotosButton } from "./RefreshPhotosButton";
import { NotificationsCard } from "./NotificationsCard";
import { OwnerNameForm } from "./OwnerNameForm";
import { DailySummaryToggle } from "./DailySummaryToggle";
import { CalendarForm } from "./CalendarForm";
import { MeetingRemindersForm } from "./MeetingRemindersForm";
import { TeamForm } from "./TeamForm";

export const dynamic = "force-dynamic";

// E-mails com rastreio enviados nos últimos 7 dias e quantos foram abertos.
async function emailWeek() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const base = { channel: "EMAIL" as const, sender: { not: "LEAD" as const }, openToken: { not: null }, createdAt: { gte: weekAgo } };
  const [sentWeek, openedWeek] = await Promise.all([prisma.message.count({ where: base }), prisma.message.count({ where: { ...base, openCount: { gt: 0 } } })]);
  return { sentWeek, openedWeek };
}

// Uma linha que mostra o valor atual e abre para editar: a página inteira cabe numa olhada.
function Row({ id, channel, title, summary, tag, open, children }: { id?: string; channel?: ChannelKey; title: string; summary: string; tag?: { label: string; cls: string }; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="set-d" id={id} open={open} style={{ scrollMarginTop: 24 }}>
      <summary className="set-row">
        {channel && <ChannelBadge channel={channel} size={28} />}
        <span className="k">
          <b>{title}</b>
          <small>{summary}</small>
        </span>
        {tag ? <span className={`tg ${tag.cls}`}>{tag.label}</span> : <IconChevronRight size={18} className="set-chev" />}
      </summary>
      <div className="set-body">{children}</div>
    </details>
  );
}

function LinkRow({ href, download, title, sub }: { href: string; download?: boolean; title: string; sub: string }) {
  const body = (
    <>
      <span className="k">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <IconChevronRight size={18} className="set-chev" />
    </>
  );
  return download ? (
    <a href={href} download className="set-row set-link">
      {body}
    </a>
  ) : (
    <Link href={href} className="set-row set-link">
      {body}
    </Link>
  );
}

// Área Ajustes: canais (LinkedIn, e-mail, WhatsApp), sua conta e agenda, avisos e equipe, e seus dados.
// ?email= vem da volta do login do Google e abre o e-mail já com o resultado.
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const emailResult = (await searchParams).email;
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const whatsapp = deskcommConfigOf(settings);
  const [email, team, status, linkedinToday, emailToday, whatsappToday, { sentWeek, openedWeek }, activeBoxes, boxProblems, emailLeft, whatsappLive] = await Promise.all([
    emailConnection(),
    prisma.teamMember.findMany({ orderBy: { createdAt: "asc" } }),
    linkedinStatus(settings),
    messagesSentToday(),
    emailsSentToday(),
    whatsappSentToday(),
    emailWeek(),
    prisma.mailbox.count({ where: { status: "ACTIVE" } }),
    prisma.mailbox.count({ where: { status: "ACTIVE", lastError: { not: null } } }),
    emailLeftToday(settings),
    whatsapp ? whatsappLiveStatus(whatsapp) : null,
  ]);

  const emailOn = Boolean(email) || activeBoxes > 0;
  // O número está pareado de verdade (o Deskcomm diz WORKING), não só configurado.
  const whatsappOn = whatsappLive === "connected";
  const ok = { label: "Conectado", cls: "tg-ok" };
  const off = { label: "Não conectado", cls: "tg-q" };

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-ajus)" } as React.CSSProperties}>
      <MobileHeader />
      <header className="area-head">
        <div className="grow">
          <h1 className="area-title">
            <i className="area-sq" aria-hidden="true" />
            Ajustes
          </h1>
          <p className="area-sub">Sua conta, os canais conectados, a agenda e os avisos.</p>
        </div>
      </header>

      <nav className="set only-mobile" aria-label="Outras áreas">
        <LinkRow href="/campaigns" title="Campanhas" sub="Grupos de pessoas com uma oferta" />
        <LinkRow href="/assistente" title="Assistente" sub="Jeito de escrever, voz, quem ele aborda e o que passa por você" />
      </nav>

      <section id="canais" aria-labelledby="h-canais" style={{ scrollMarginTop: 24 }}>
        <h2 className="panel-h" id="h-canais">
          Por onde o assistente fala
        </h2>
        <div className="set">
          <Row
            id="linkedin"
            channel="LINKEDIN"
            title="LinkedIn"
            summary={
              status.connected
                ? `${status.name ?? "Conectado"} · hoje ${linkedinToday} de ${settings.dailyMessageLimit} mensagens`
                : settings.linkedinNeedsReconnect
                  ? "Saiu do ar: reconecte para o assistente voltar a trabalhar"
                  : "Convites, primeira mensagem e conversas"
            }
            tag={status.connected ? ok : settings.linkedinNeedsReconnect ? { label: "Reconectar", cls: "tg-stop" } : off}
            open={settings.linkedinNeedsReconnect}
          >
            <LinkedinCard settings={settings} status={status} today={`Hoje: ${linkedinToday} de ${settings.dailyMessageLimit} mensagens`} />
          </Row>
          <Row
            id="email"
            channel="EMAIL"
            title="E-mail"
            summary={
              emailOn
                ? `${settings.googleEmail ?? email?.address ?? `${activeBoxes} caixas em rodízio`} · hoje ${emailToday} enviados · 7 dias: ${openedWeek} de ${sentWeek} abertos`
                : "Apresentar-se e acompanhar por e-mail"
            }
            tag={emailOn ? ok : off}
            open={typeof emailResult === "string"}
          >
            <EmailCard
              googleAddress={settings.googleEmail}
              expired={Boolean(settings.googleEmail && !settings.googleRefreshToken)}
              fallbackAddress={email?.provider === "password" ? email.address : null}
              result={typeof emailResult === "string" ? emailResult : null}
            />
            {activeBoxes > 0 && (
              <p className="hint">
                E-mail de prospecção: {activeBoxes} {activeBoxes === 1 ? "caixa ativa" : "caixas ativas"} em rodízio.
                {boxProblems > 0 && " Alguma caixa está com problema: avise o suporte."}
              </p>
            )}
            {emailOn && (
              <>
                <EmailChannelOptions enabled={settings.emailChannelEnabled} dailyLimit={settings.dailyEmailLimit} fallbackDays={settings.emailInviteFallbackDays} />
                <p className="hint">
                  Hoje: {emailToday} enviados, ainda cabem {emailLeft} · últimos 7 dias: {openedWeek} de {sentWeek} abertos
                </p>
              </>
            )}
          </Row>
          <Row
            id="whatsapp"
            channel="WHATSAPP"
            title="WhatsApp"
            summary={
              whatsappOn
                ? `${settings.whatsappChannelEnabled ? "Em uso" : "Conectado, mas desligado"} · hoje ${whatsappToday} de ${settings.dailyWhatsappLimit}`
                : whatsappLive === "down"
                  ? "Número desconectado: nenhuma mensagem entra nem sai. Leia o QR Code para voltar"
                  : whatsappLive === "unknown"
                    ? "Não consegui falar com o WhatsApp agora. Abra para tentar de novo"
                    : "Conversas e áudios pelo WhatsApp"
            }
            tag={whatsappOn ? ok : whatsappLive === "down" ? { label: "Caiu", cls: "tg-stop" } : whatsappLive === "unknown" ? { label: "Sem resposta", cls: "tg-q" } : off}
          >
            <WhatsappCard
              configured={whatsapp !== null}
              enabled={settings.whatsappChannelEnabled}
              dailyLimit={settings.dailyWhatsappLimit}
              sentToday={whatsappToday}
            />
          </Row>
        </div>
      </section>

      <section aria-labelledby="h-conta">
        <h2 className="panel-h" id="h-conta">
          Sua conta e agenda
        </h2>
        <div className="set">
          <Row title="Seu nome" summary={settings.ownerName?.trim() ? `O assistente se apresenta em nome de ${settings.ownerName.trim()}` : "Obrigatório: sem ele o assistente não liga"}>
            <OwnerNameForm value={settings.ownerName ?? ""} />
          </Row>
          <Row
            id="agenda"
            title="Agenda de reuniões"
            summary={
              settings.googleCalendarEnabled
                ? `Google Agenda conectada · ${settings.meetingMinutes} min · ${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`
                : "Não conectada: o assistente passa a conversa para você"
            }
            tag={settings.googleCalendarEnabled ? { label: "Conectada", cls: "tg-ok" } : undefined}
          >
            <CalendarForm
              minutes={settings.meetingMinutes}
              googleEmail={settings.googleEmail}
              calendarEnabled={settings.googleCalendarEnabled && Boolean(settings.googleRefreshToken)}
              configured={googleConfigured()}
              workHours={`${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`}
              notice={noticeLabel({ fromNextBusinessDay: Boolean(settings.assistantName?.trim()) })}
            />
          </Row>
          <Row title="Lembretes da reunião" summary={settings.meetingRemindersEnabled ? "Na véspera, 5h e 1h antes, e aviso se a pessoa faltar" : "Desligados"}>
            <MeetingRemindersForm
              enabled={settings.meetingRemindersEnabled}
              texts={{ day: settings.reminderDayText ?? "", h5: settings.reminder5hText ?? "", h1: settings.reminder1hText ?? "", noShow: settings.noShowText ?? "" }}
              defaults={{ day: DEFAULT_REMINDERS.day, h5: DEFAULT_REMINDERS["5h"], h1: DEFAULT_REMINDERS["1h"], noShow: DEFAULT_REMINDERS.noShow }}
            />
          </Row>
        </div>
      </section>

      <section aria-labelledby="h-avisos">
        <h2 className="panel-h" id="h-avisos">
          Avisos e equipe
        </h2>
        <div className="set">
          <Row
            title="Equipe que recebe avisos"
            summary={team.length ? `${team.length} pessoa${team.length > 1 ? "s" : ""}: ${team.slice(0, 3).map((m) => m.name).join(", ")}${team.length > 3 ? "…" : ""}` : "Só você recebe os avisos"}
          >
            <TeamForm
              members={team.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email ?? "",
                phone: m.phone ?? "",
                notifyUrgent: m.notifyUrgent,
                notifyMeetings: m.notifyMeetings,
                notifyHandoffs: m.notifyHandoffs,
                role: m.role ?? "",
                handles: m.handles,
                viaEmail: m.viaEmail,
                viaWhatsapp: m.viaWhatsapp,
              }))}
            />
          </Row>
          <Row title="Resumo do dia" summary={settings.dailySummaryEnabled ? `Às ${settings.workEndHour}h${email ? ", no celular e no seu e-mail" : ", no celular"}` : "Desligado"}>
            <DailySummaryToggle enabled={settings.dailySummaryEnabled} endHour={settings.workEndHour} hasEmail={Boolean(email)} hasPush={Boolean(pushPublicKey())} />
          </Row>
          {/* Sem as chaves de push no servidor, o bloco só mostraria um aviso técnico. */}
          {pushPublicKey() && (
            <Row title="Avisos neste aparelho" summary="Quando alguém precisar de você">
              <NotificationsCard publicKey={pushPublicKey()} />
            </Row>
          )}
        </div>
      </section>

      <section aria-labelledby="h-dados">
        <h2 className="panel-h" id="h-dados">
          Seus dados
        </h2>
        <div className="set">
          <LinkRow href="/api/export/leads" download title="Baixar meus contatos" sub="Planilha para Excel ou Google Planilhas" />
          <div className="set-row">
            <span className="k">
              <b>Atualizar fotos dos contatos</b>
              <small>Busca de novo as fotos de quem já está conectado no LinkedIn</small>
            </span>
            <RefreshPhotosButton />
          </div>
          <div className="set-row">
            <span className="k">
              <b>Sair</b>
              <small>Encerra a sua sessão neste aparelho</small>
            </span>
            <form action={logout}>
              <button type="submit" className="btn-line btn-sm">
                Sair
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
