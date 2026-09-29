import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { emailConnection } from "@/lib/email";
import { linkedinStatus } from "../channels/LinkedinCard";
import { logout } from "../actions";
import { NotificationsCard } from "./NotificationsCard";
import { pushPublicKey } from "@/lib/push";
import { IdealClientForm } from "./IdealClientForm";
import { OwnerNameForm } from "./OwnerNameForm";
import { FollowUpDefaultForm } from "./FollowUpDefaultForm";
import { MobileHeader } from "@/components/MobileHeader";
import { ExclusionListForm } from "./ExclusionListForm";
import { DailySummaryToggle } from "./DailySummaryToggle";
import { parseExclusionLines, parseIdealClient } from "@/lib/audience";
import { describeRule } from "@/lib/followupPolicy";
import { IconBan, IconBell, IconCalendar, IconChat, IconChevronDown, IconChevronRight, IconClock, IconDownload, IconLinkedin, IconLogout, IconMail, IconTarget } from "@/components/Icons";

export const dynamic = "force-dynamic";

// Uma linha que mostra o valor atual e abre pra editar — a página inteira cabe
// numa olhada e ninguém precisa rolar por formulários que não vai mexer.
function SettingItem({
  icon,
  tone,
  title,
  summary,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="setting-item">
      <summary className="setting-row">
        <span className={`setting-icon tone-${tone}`}>{icon}</span>
        <span className="setting-text">
          <b>{title}</b>
          <span className="tiny faint setting-summary">{summary}</span>
        </span>
        <IconChevronDown size={18} className="chev" />
      </summary>
      <div className="setting-body">{children}</div>
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
  const [status, email] = await Promise.all([linkedinStatus(settings), emailConnection()]);
  const linkedinOk = status.connected;

  return (
    <main className="page account">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Sua <span className="name-grad">conta.</span>
        </h1>
        <p className="hero-sub">Seus canais e como a secretária deve abordar as pessoas. Toque num item pra mudar.</p>
      </header>

      <div className="account-col">
        <section className="group rise">
          <h2 className="group-title">Canais</h2>
          <Link href="/channels" className="card channels-summary">
            <span className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700 }}>LinkedIn, e-mail e WhatsApp</span>
              <span className="channel-chips">
                <span className={linkedinOk ? "chip on" : "chip off"}>
                  <IconLinkedin size={13} /> {linkedinOk ? "Conectado" : settings.linkedinNeedsReconnect ? "Reconectar" : "Não conectado"}
                </span>
                <span className={email ? "chip on" : "chip"}>
                  <IconMail size={13} /> {email ? "Conectado" : "Opcional"}
                </span>
                <span className="chip">
                  <IconChat size={13} /> Em breve
                </span>
              </span>
            </span>
            <IconChevronRight size={18} className="chev" />
          </Link>
        </section>

        <section className="group rise">
          <h2 className="group-title">Você</h2>
          <OwnerNameForm value={settings.ownerName ?? ""} />
        </section>

        <section id="alcance" className="group rise" style={{ scrollMarginTop: 90 }}>
          <h2 className="group-title">Sua abordagem</h2>
          <div className="card setting-list">
            <SettingItem icon={<IconTarget size={19} />} tone="brand" title="Quem você quer alcançar" summary={audienceSummary(settings.targetAudience)}>
              <IdealClientForm value={settings.targetAudience ?? ""} />
            </SettingItem>
            <SettingItem
              icon={<IconClock size={19} />}
              tone="waiting"
              title="Follow-up"
              summary={describeRule(Math.min(10, settings.followUpMaxCount), settings.followUpDelayHours)}
            >
              <FollowUpDefaultForm
                count={Math.min(10, settings.followUpMaxCount)}
                days={Math.min(30, Math.max(1, Math.round(settings.followUpDelayHours / 24)))}
              />
            </SettingItem>
            <SettingItem icon={<IconBan size={19} />} tone="urgent" title="Quem nunca contatar" summary={exclusionSummary(settings.exclusionList)}>
              <ExclusionListForm value={settings.exclusionList ?? ""} />
            </SettingItem>
            <SettingItem
              icon={<IconCalendar size={19} />}
              tone="open"
              title="Resumo do dia"
              summary={settings.dailySummaryEnabled ? `Às ${settings.workEndHour}h${email ? ", no celular e no seu e-mail" : ", no celular"}` : "Desligado"}
            >
              <DailySummaryToggle enabled={settings.dailySummaryEnabled} endHour={settings.workEndHour} hasEmail={Boolean(email)} hasPush={Boolean(pushPublicKey())} />
            </SettingItem>
            {/* Sem as chaves de push no servidor, o card só mostraria um aviso técnico. */}
            {pushPublicKey() && (
              <SettingItem icon={<IconBell size={19} />} tone="open" title="Avisos no celular" summary="Quando alguém precisar de você">
                <NotificationsCard publicKey={pushPublicKey()} />
              </SettingItem>
            )}
          </div>
        </section>

        <div className="card rise" style={{ overflow: "hidden" }}>
          <a href="/api/export/leads" className="setting-row" download>
            <span className="setting-icon" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}>
              <IconDownload size={19} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>Baixar meus leads</span>
              <span className="tiny faint">Planilha para Excel ou Google Planilhas</span>
            </span>
            <IconChevronRight size={18} className="chev" />
          </a>
          <form action={logout} style={{ borderTop: "1px solid var(--border)" }}>
            <button type="submit" className="setting-row" style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}>
              <span className="setting-icon" style={{ background: "var(--urgent-soft)", color: "var(--urgent-ink)" }}>
                <IconLogout size={19} />
              </span>
              <span style={{ flex: 1, fontWeight: 700, color: "var(--urgent-ink)" }}>Sair</span>
              <IconChevronRight size={18} className="chev" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
