import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminEnabled, isAdmin } from "@/lib/admin";
import { IconLogout } from "@/components/Icons";
import { AdminLogin } from "./AdminLogin";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { LimitsForm } from "./LimitsForm";
import { FollowUpForm } from "./FollowUpForm";
import { WorkHoursForm } from "./WorkHoursForm";
import { EngagementForm } from "./EngagementForm";
import { AccountTypeNotice } from "./AccountTypeNotice";
import { adminLogout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Configurações técnicas, fora do alcance do usuário final. Sem ADMIN_PASSWORD
// definido no ambiente, a página simplesmente não existe (404).
export default async function AdminPage() {
  if (!adminEnabled()) notFound();

  if (!(await isAdmin())) {
    return (
      <main className="page">
        <header className="page-hero">
          <h1 className="display page-title">Admin.</h1>
        </header>
        <AdminLogin />
      </main>
    );
  }

  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });

  return (
    <main className="page">
      <header className="page-hero row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="display page-title">
            Ad<span className="name-grad">min.</span>
          </h1>
          <p className="hero-sub">Configurações técnicas. O usuário do painel não vê esta página.</p>
        </div>
        <form action={adminLogout}>
          <button type="submit" className="btn btn-secondary btn-sm">
            <IconLogout size={16} /> Sair do admin
          </button>
        </form>
      </header>

      <div className="settings-grid">
        <div className="settings-col">
          <section className="group">
            <h2 className="group-title">Agente de IA — instruções gerais</h2>
            <p className="tiny faint" style={{ padding: "0 4px 8px" }}>
              Valem para todas as conversas. O texto de cada campanha (escrito pelo usuário) é somado a estas instruções.
            </p>
            <AgentInstructionsForm value={settings.agentInstructions ?? ""} />
          </section>
          <section className="group">
            <h2 className="group-title">Limites diários</h2>
            <LimitsForm dailyInviteLimit={settings.dailyInviteLimit} dailyMessageLimit={settings.dailyMessageLimit} />
          </section>
          <section className="group">
            <h2 className="group-title">Follow-up automático</h2>
            <FollowUpForm followUpMaxCount={settings.followUpMaxCount} followUpDelayHours={settings.followUpDelayHours} />
          </section>
        </div>
        <div className="settings-col">
          <section className="group">
            <h2 className="group-title">Horário de trabalho</h2>
            <WorkHoursForm start={settings.workStartHour} end={settings.workEndHour} weekdaysOnly={settings.workWeekdaysOnly} />
          </section>
          <section className="group">
            <h2 className="group-title">Ações extras do LinkedIn</h2>
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
          <section className="group">
            <h2 className="group-title">Tipo de conta do LinkedIn</h2>
            <AccountTypeNotice />
          </section>
        </div>
      </div>
    </main>
  );
}
