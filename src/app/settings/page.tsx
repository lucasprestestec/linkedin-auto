import { prisma } from "@/lib/prisma";
import { getIdentity } from "@/lib/edges";
import { logout } from "../actions";
import { ConnectButton } from "./ConnectButton";
import { RefreshStatusButton } from "./RefreshStatusButton";
import { DisconnectButton } from "./DisconnectButton";
import { NotificationsCard } from "./NotificationsCard";
import { pushPublicKey } from "@/lib/push";
import { IdealClientForm } from "./IdealClientForm";
import { OwnerNameForm } from "./OwnerNameForm";
import { FollowUpDefaultForm } from "./FollowUpDefaultForm";
import { MobileHeader } from "@/components/MobileHeader";
import { ExclusionListForm } from "./ExclusionListForm";
import { EmailCard } from "./EmailCard";
import { passwordEmailAddress } from "@/lib/email";
import { parseExclusionLines, parseIdealClient } from "@/lib/audience";
import { describeRule } from "@/lib/followupPolicy";
import { IconBan, IconBell, IconChevronDown, IconChevronRight, IconClock, IconDownload, IconLinkedin, IconLogout, IconTarget } from "@/components/Icons";

export const dynamic = "force-dynamic";

async function getConnectionStatus(identityId: string | null) {
  if (!identityId) return { connected: false };
  try {
    const identity = await getIdentity(identityId);
    return { connected: identity.integrations.includes("linkedin"), name: identity.name };
  } catch {
    return { connected: false, error: true };
  }
}

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

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const emailResult = (await searchParams).email;
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const status = await getConnectionStatus(settings.linkedinIdentityId);
  const connected = status.connected && !settings.linkedinNeedsReconnect;

  return (
    <main className="page account">
      <MobileHeader />
      <header className="page-hero rise">
        <h1 className="display page-title">
          Sua <span className="name-grad">conta.</span>
        </h1>
        <p className="hero-sub">Seu LinkedIn e como a automação deve abordar as pessoas. Toque num item pra mudar.</p>
      </header>

      <div className="account-col">
        <section className="group rise">
          <h2 className="group-title">LinkedIn</h2>
          <section className="card card-pad connection rise" aria-label="Conta do LinkedIn">
            <div className="row" style={{ gap: 14 }}>
              <span className="li-mark">
                <IconLinkedin size={26} />
              </span>
              <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
                <span className="title-md">Conta do LinkedIn</span>
                {connected ? (
                  <span className="row small" style={{ gap: 8, color: "var(--success-ink)", fontWeight: 700 }}>
                    <span className="pulse" />
                    Conectado{status.name ? ` · ${status.name}` : ""}
                  </span>
                ) : (
                  <span className="row small" style={{ gap: 8, color: "var(--urgent-ink)", fontWeight: 700 }}>
                    <span className="pulse" />
                    {settings.linkedinNeedsReconnect ? "Sessão expirou" : "Não conectado"}
                  </span>
                )}
              </div>
            </div>

            {!connected && (
              <>
                <p className="small muted">
                  {settings.linkedinNeedsReconnect
                    ? `${settings.linkedinReconnectReason ?? "A sessão do LinkedIn caiu"}. Reconecte para a automação voltar a funcionar.`
                    : "Conecte sua conta pessoal do LinkedIn para o sistema começar a convidar e responder por você."}
                </p>
                <ConnectButton />
                <RefreshStatusButton />
              </>
            )}
            {settings.linkedinIdentityId && <DisconnectButton />}
          </section>
        </section>

        <section className="group rise">
          <h2 className="group-title">E-mail</h2>
          <EmailCard
            googleAddress={settings.googleEmail}
            expired={Boolean(settings.googleEmail && !settings.googleRefreshToken)}
            fallbackAddress={passwordEmailAddress()}
            result={typeof emailResult === "string" ? emailResult : null}
          />
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
