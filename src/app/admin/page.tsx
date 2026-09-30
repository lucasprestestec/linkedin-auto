import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminEnabled, isAdmin } from "@/lib/admin";
import { AdminLogin } from "./AdminLogin";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { LimitsForm } from "./LimitsForm";
import { WorkHoursForm } from "./WorkHoursForm";
import { EngagementForm } from "./EngagementForm";
import { AccountTypeNotice } from "./AccountTypeNotice";
import { adminLogout } from "./actions";
import { AgentEval } from "./eval/AgentEval";
import { EmailStatus } from "./EmailStatus";
import { emailConnection } from "@/lib/email";
import { googleConfigured, googleRedirectUri } from "@/lib/gmail";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Configurações técnicas, fora do alcance do usuário final. Sem ADMIN_PASSWORD
// definido no ambiente, a página simplesmente não existe (404).
export default async function AdminPage() {
  if (!adminEnabled()) notFound();

  if (!(await isAdmin())) {
    return (
      <main className="page">
        <header className="p-head">
          <h1 className="t-title">Admin</h1>
        </header>
        <AdminLogin />
      </main>
    );
  }

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const email = await emailConnection();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <main className="page">
      <header className="p-head">
        <div>
          <h1 className="t-title">Admin</h1>
          <p className="t-sub">Configurações técnicas. O usuário do painel não vê esta página.</p>
        </div>
        <form action={adminLogout}>
          <button type="submit" className="btn-line btn-sm">
            Sair do admin
          </button>
        </form>
      </header>

      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">Agente de IA: banco de testes e modelo</h2>
          <small>Roda situações difíceis de conversa em cada modelo e mostra quem decide melhor, escreve mais natural e erra menos.</small>
        </div>
        <AgentEval />
      </section>

      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">Agente de IA: instruções gerais</h2>
          <small>Valem para todas as conversas. O texto de cada campanha é somado a estas instruções.</small>
        </div>
        <AgentInstructionsForm value={settings.agentInstructions ?? ""} />
      </section>

      <section className="sec">
        <h2 className="t-label">Limites diários</h2>
        <LimitsForm dailyInviteLimit={settings.dailyInviteLimit} dailyMessageLimit={settings.dailyMessageLimit} />
      </section>

      <section className="sec">
        <h2 className="t-label">Horário de trabalho</h2>
        <WorkHoursForm start={settings.workStartHour} end={settings.workEndHour} weekdaysOnly={settings.workWeekdaysOnly} />
      </section>

      <section className="sec">
        <h2 className="t-label">Ações extras do LinkedIn</h2>
        <EngagementForm
          values={{
            acceptInvitesEnabled: settings.acceptInvitesEnabled,
            withdrawInvitesEnabled: settings.withdrawInvitesEnabled,
            warmupEnabled: settings.warmupEnabled,
            archiveLostEnabled: settings.archiveLostEnabled,
          }}
          withdrawAfterDays={settings.withdrawAfterDays}
        />
      </section>

      <section className="sec">
        <h2 className="t-label">E-mail da secretária</h2>
        <EmailStatus
          googleConfigured={googleConfigured()}
          redirectUri={googleRedirectUri(origin)}
          connectedAddress={email?.address ?? null}
          provider={email?.provider ?? null}
          appUrlSet={Boolean(process.env.APP_URL)}
        />
      </section>

      <section className="sec">
        <h2 className="t-label">Tipo de conta do LinkedIn</h2>
        <AccountTypeNotice />
      </section>
    </main>
  );
}
