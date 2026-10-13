import { RefreshPhotosButton } from "./RefreshPhotosButton";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { prisma } from "@/lib/prisma";
import { emailConnection } from "@/lib/email";
import { logout } from "../actions";
import { NotificationsCard } from "./NotificationsCard";
import { pushPublicKey } from "@/lib/push";
import { IdealClientForm } from "./IdealClientForm";
import { OwnerNameForm } from "./OwnerNameForm";
import { FollowUpDefaultForm } from "./FollowUpDefaultForm";
import { MobileHeader } from "@/components/MobileHeader";
import { ExclusionListForm } from "./ExclusionListForm";
import { DailySummaryToggle } from "./DailySummaryToggle";
import { CalendarForm } from "./CalendarForm";
import { googleConfigured } from "@/lib/gmail";
import { parseExclusionLines, parseIdealClient } from "@/lib/audience";
import { describeRule } from "@/lib/followupPolicy";
import { parseWritingStyle, summarizeStyle } from "@/lib/writingStyle";
import { loadSuggestions } from "@/lib/styleSuggestions";
import { StyleOverview } from "./StyleOverview";
import { VoiceOverview } from "./VoiceOverview";
import { parseVoiceSettings, summarizeVoice } from "@/lib/voice/settings";
import { fishConfigured } from "@/lib/voice/fish";
import type { Tone } from "@/components/IconChip";
import { IconCalendar, IconChevronRight, IconLayers, IconSparkles, IconTarget } from "@/components/Icons";

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

function audienceSummary(raw: string | null) {
  const icp = parseIdealClient(raw);
  const parts = [...icp.titles.slice(0, 2), ...icp.industries.slice(0, 1), ...icp.regions.slice(0, 1)];
  return parts.length ? parts.join(" · ") : "Ainda não definido";
}

function exclusionSummary(raw: string | null) {
  const l = parseExclusionLines(raw);
  const parts = [
    l.companies.length && `${l.companies.length} empresa${l.companies.length > 1 ? "s" : ""}`,
    l.people.length + l.profiles.length && `${l.people.length + l.profiles.length} pessoa${l.people.length + l.profiles.length > 1 ? "s" : ""}`,
    l.other.length && `${l.other.length} outro${l.other.length > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Ninguém por enquanto";
}

export default async function SettingsPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const email = await emailConnection();
  const style = parseWritingStyle(settings.writingStyle);
  const voice = parseVoiceSettings(settings.voiceSettings);
  // As sugestões são um extra: se falharem, a tela abre do mesmo jeito.
  const suggestions = await loadSuggestions(style).catch(() => []);

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

      <Group id="alcance" Icon={IconTarget} tone="accent" title="Prospecção" hint="Quem o assistente aborda e como ele acompanha">
        <SettingItem title="Quem você quer alcançar" summary={audienceSummary(settings.targetAudience)}>
          <IdealClientForm value={settings.targetAudience ?? ""} />
        </SettingItem>
        <SettingItem
          title="Acompanhamento"
          summary={describeRule(Math.min(10, settings.followUpMaxCount), settings.followUpDelayHours)}
        >
          <FollowUpDefaultForm
            count={Math.min(10, settings.followUpMaxCount)}
            days={Math.min(30, Math.max(1, Math.round(settings.followUpDelayHours / 24)))}
          />
        </SettingItem>
        <SettingItem title="Quem nunca contatar" summary={exclusionSummary(settings.exclusionList)}>
          <ExclusionListForm value={settings.exclusionList ?? ""} />
        </SettingItem>
      </Group>

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

      <Group id="jeito" Icon={IconSparkles} tone="violet" title="Jeito do assistente" hint="Como ele escreve e como ele soa nos áudios">
        <SettingItem
          title="Meu jeito de escrever"
          summary={`${summarizeStyle(style)}${suggestions.length ? ` · ${suggestions.length === 1 ? "1 sugestão nova" : `${suggestions.length} sugestões novas`}` : ""}`}
        >
          <StyleOverview style={style} suggestions={suggestions} />
        </SettingItem>
        <SettingItem id="voz" title="Mensagens de voz" summary={summarizeVoice(voice)}>
          <VoiceOverview voice={voice} configured={fishConfigured()} />
        </SettingItem>
      </Group>

      <Group Icon={IconLayers} tone="neutral" title="Atalhos e dados" hint="Outras telas e a sua lista de contatos">
        <ShortcutItem href="/prospect" title="Prospectar" sub="Adicionar pessoas para o assistente abordar" />
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
