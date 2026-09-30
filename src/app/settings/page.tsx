import Link from "next/link";
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

export const dynamic = "force-dynamic";

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

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Conta</h1>
          <p className="t-sub">Como a secretária deve trabalhar por você.</p>
        </div>
      </header>

      <OwnerNameForm value={settings.ownerName ?? ""} />

      <section id="alcance" className="sec" style={{ scrollMarginTop: 90 }}>
        <h2 className="t-label">Sua abordagem</h2>
        <div>
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
          <SettingItem
            title="Agenda de reuniões"
            summary={settings.googleCalendarEnabled ? `Google Agenda conectada · ${settings.meetingMinutes} min` : "Não conectada: a secretária passa a conversa para você"}
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
        </div>
      </section>

      <section className="sec">
        <h2 className="t-label">Mais</h2>
        <ul className="list">
          <li>
            <Link href="/prospect" className="item">
              <span className="item-main">
                <span className="item-title">Prospectar</span>
                <span className="item-sub">Adicionar pessoas para a secretária abordar</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href="/campaigns" className="item">
              <span className="item-main">
                <span className="item-title">Campanhas</span>
                <span className="item-sub">Grupos de pessoas com uma oferta</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href="/channels" className="item">
              <span className="item-main">
                <span className="item-title">Canais</span>
                <span className="item-sub">LinkedIn, e-mail e WhatsApp</span>
              </span>
            </Link>
          </li>
          <li>
            <a href="/api/export/leads" download className="item">
              <span className="item-main">
                <span className="item-title">Baixar meus contatos</span>
                <span className="item-sub">Planilha para Excel ou Google Planilhas</span>
              </span>
            </a>
          </li>
        </ul>
        <form action={logout}>
          <button type="submit" className="btn-line btn-danger-line">
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}
