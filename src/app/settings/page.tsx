import { RefreshPhotosButton } from "./RefreshPhotosButton";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { prisma } from "@/lib/prisma";
import { emailConnection } from "@/lib/email";
import { logout } from "../actions";
import { NotificationsCard } from "./NotificationsCard";
import { pushPublicKey } from "@/lib/push";
import { OwnerNameForm } from "./OwnerNameForm";
import { MobileHeader } from "@/components/MobileHeader";
import { DailySummaryToggle } from "./DailySummaryToggle";
import { CalendarForm } from "./CalendarForm";
import { MeetingRemindersForm } from "./MeetingRemindersForm";
import { TeamForm } from "./TeamForm";
import { DEFAULT_REMINDERS } from "@/lib/meetingReminders";
import { googleConfigured } from "@/lib/gmail";
import { noticeLabel } from "@/lib/slots";
import type { Tone } from "@/components/IconChip";
import { IconCalendar, IconChevronRight, IconLayers } from "@/components/Icons";

export const dynamic = "force-dynamic";

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

// Bloco da Conta: título com ícone e uma frase do que tem dentro, para a página ser lida em partes.
function Group({ id, Icon, tone, title, hint, children }: { id?: string; Icon: IconType; tone: Tone; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="sec" style={{ scrollMarginTop: 90 }}>
      <header className="group-head">
        <div>
          <h2 className={`t-label group-title ink-${tone}`}>
            <Icon size={20} />
            <span>{title}</span>
          </h2>
          <p className="group-sub">{hint}</p>
        </div>
      </header>
      <div className="group-body">{children}</div>
    </section>
  );
}

// Uma linha que mostra o valor atual e abre para editar: a página inteira cabe
// numa olhada e ninguém precisa rolar por formulários que não vai mexer.
function SettingItem({ id, title, summary, children }: { id?: string; title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="fold" id={id} style={{ scrollMarginTop: 90 }}>
      <summary>
        <span className="setting-text">
          <b>{title}</b>
          <small>{summary}</small>
        </span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

// Atalho para outra tela, com o mesmo ícone em quadradinho dos itens acima.
function ShortcutItem({ href, download, title, sub }: { href: string; download?: boolean; title: string; sub: string }) {
  const body = (
    <>
      <span className="item-main">
        <span className="item-title">{title}</span>
        <span className="item-sub">{sub}</span>
      </span>
      <IconChevronRight size={16} style={{ color: "var(--text-3)" }} />
    </>
  );
  return download ? (
    <a href={href} download className="item">
      {body}
    </a>
  ) : (
    <Link href={href} className="item">
      {body}
    </Link>
  );
}

export default async function SettingsPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const email = await emailConnection();
  const team = await prisma.teamMember.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="page page-roomy">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Conta</h1>
          <p className="t-sub">Como o assistente deve trabalhar por você.</p>
        </div>
      </header>

      <OwnerNameForm value={settings.ownerName ?? ""} />

      <Group Icon={IconCalendar} tone="ok" title="Rotina e avisos" hint="Reuniões, resumo do dia e notificações">
        <SettingItem
          title="Agenda de reuniões"
          summary={settings.googleCalendarEnabled ? `Google Agenda conectada · ${settings.meetingMinutes} min` : "Não conectada: o assistente passa a conversa para você"}
        >
          <CalendarForm
            minutes={settings.meetingMinutes}
            googleEmail={settings.googleEmail}
            calendarEnabled={settings.googleCalendarEnabled && Boolean(settings.googleRefreshToken)}
            configured={googleConfigured()}
            workHours={`${settings.workStartHour}h às ${settings.workEndHour}h${settings.workWeekdaysOnly ? ", dias úteis" : ""}`}
            notice={noticeLabel({ fromNextBusinessDay: Boolean(settings.assistantName?.trim()) })}
          />
        </SettingItem>
        <SettingItem
          title="Lembretes da reunião"
          summary={settings.meetingRemindersEnabled ? "Na véspera, 5h e 1h antes, no canal da conversa" : "Desligados"}
        >
          <MeetingRemindersForm
            enabled={settings.meetingRemindersEnabled}
            texts={{ day: settings.reminderDayText ?? "", h5: settings.reminder5hText ?? "", h1: settings.reminder1hText ?? "", noShow: settings.noShowText ?? "" }}
            defaults={{ day: DEFAULT_REMINDERS.day, h5: DEFAULT_REMINDERS["5h"], h1: DEFAULT_REMINDERS["1h"], noShow: DEFAULT_REMINDERS.noShow }}
          />
        </SettingItem>
        <SettingItem
          title="Equipe"
          summary={team.length ? `${team.length} pessoa${team.length > 1 ? "s" : ""} recebe${team.length > 1 ? "m" : ""} avisos por e-mail/WhatsApp` : "Só você recebe os avisos"}
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
        </SettingItem>
        <SettingItem
          title="Resumo do dia"
          summary={settings.dailySummaryEnabled ? `Às ${settings.workEndHour}h${email ? ", no celular e no seu e-mail" : ", no celular"}` : "Desligado"}
        >
          <DailySummaryToggle enabled={settings.dailySummaryEnabled} endHour={settings.workEndHour} hasEmail={Boolean(email)} hasPush={Boolean(pushPublicKey())} />
        </SettingItem>
        {/* Sem as chaves de push no servidor, o bloco só mostraria um aviso técnico. */}
        {pushPublicKey() && (
          <SettingItem title="Avisos no celular" summary="Quando alguém precisar de você">
            <NotificationsCard publicKey={pushPublicKey()} />
          </SettingItem>
        )}
      </Group>

      <Group Icon={IconLayers} tone="neutral" title="Atalhos e dados" hint="Outras telas e a sua lista de contatos">
        <ShortcutItem href="/assistente" title="Assistente" sub="Jeito de escrever, voz, quem ele aborda e o que passa por você" />
        <ShortcutItem href="/contacts" title="Contatos" sub="Colocar gente nova para o assistente abordar" />
        <ShortcutItem href="/campaigns" title="Campanhas" sub="Grupos de pessoas com uma oferta" />
        <ShortcutItem href="/channels" title="Canais" sub="LinkedIn, e-mail e WhatsApp" />
        <ShortcutItem href="/api/export/leads" download title="Baixar meus contatos" sub="Planilha para Excel ou Google Planilhas" />
        <RefreshPhotosButton />
        <form action={logout} style={{ paddingTop: 12 }}>
          <button type="submit" className="btn-line btn-danger-line btn-sm">
            Sair
          </button>
        </form>
      </Group>
    </main>
  );
}
