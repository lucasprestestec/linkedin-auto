import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminVisible, isAdmin } from "@/lib/admin";
import { AdminLogin } from "./AdminLogin";
import { AgentInstructionsForm } from "./AgentInstructionsForm";
import { EngagementForm } from "./EngagementForm";
import { AccountTypeNotice } from "./AccountTypeNotice";
import { adminLogout } from "./actions";
import { AgentEval } from "./eval/AgentEval";
import { EmailStatus } from "./EmailStatus";
import { RunRobotButton } from "./RunRobotButton";
import { WhatsappKeyForm } from "./WhatsappKeyForm";
import { deskcommConfigOf, fixedDeskcommToken } from "@/lib/deskcomm";
import { emailConnection } from "@/lib/email";
import { googleConfigured, googleRedirectUri } from "@/lib/gmail";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
// O botão "Rodar agora" executa o robô inteiro aqui dentro (o robô de 15 em 15 minutos tem o mesmo teto).
export const maxDuration = 120;
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Configurações técnicas, fora do alcance do usuário final. Sem ADMIN_PASSWORD
// definido no ambiente, a página simplesmente não existe (404).
export default async function AdminPage() {
  if (!(await adminVisible())) notFound();

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
  const mailboxActive = await prisma.mailbox.count({ where: { status: "ACTIVE" } });
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
          <h2 className="t-label">Robô: rodar agora</h2>
          <small>Ele já roda sozinho de 15 em 15 minutos. Use o botão nos testes, para não esperar a próxima passada.</small>
        </div>
        <RunRobotButton />
      </section>

      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">Agente de IA: banco de testes e modelo</h2>
          <small>Roda situações difíceis de conversa em cada modelo e mostra quem decide melhor, escreve mais natural e erra menos.</small>
        </div>
        <AgentEval />
      </section>

      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">WhatsApp: chave do CRM</h2>
          <small>Crie a chave na organização deste cliente no CRM (Configurações › API Tokens, com mcp:read, mcp:write e role:manager). Aqui ela é testada e guardada cifrada, sem passar pela Vercel.</small>
        </div>
        <WhatsappKeyForm hasKey={deskcommConfigOf(settings) !== null} fromServer={fixedDeskcommToken() !== null} />
      </section>

      <section className="sec">
        <div className="sec-head">
          <div className="setting-text">
            <h2 className="t-label">Caixas de envio (e-mail da prospecção)</h2>
            <small>
              {mailboxActive
                ? `${mailboxActive} ${mailboxActive === 1 ? "caixa ativa" : "caixas ativas"} em rodízio, cada uma com limite por dia que sobe aos poucos.`
                : "Nenhuma caixa cadastrada. Cadastre as caixas dos domínios de prospecção: o usuário final não mexe nisto."}
            </small>
          </div>
          <Link href="/admin/caixas" className="btn-line btn-sm">
            {mailboxActive ? "Abrir" : "Cadastrar"}
          </Link>
        </div>
      </section>

      <section className="sec">
        <div className="setting-text">
          <h2 className="t-label">Agente de IA: instruções gerais</h2>
          <small>Valem para todas as conversas. O texto de cada campanha é somado a estas instruções.</small>
        </div>
        <AgentInstructionsForm value={settings.agentInstructions ?? ""} />
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
        <h2 className="t-label">E-mail do assistente</h2>
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
