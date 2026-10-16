import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { searchesLeftThisMonth, webSearchEnabled } from "@/lib/websearch";
import { emailEnabled } from "@/lib/email";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { getConversationItems } from "@/lib/conversations";
import { STATUS_LABEL } from "@/lib/status";
import { MobileHeader } from "@/components/MobileHeader";
import { Avatar } from "@/components/Avatar";
import { CHANNELS, ChannelBadge } from "@/components/ChannelBadge";
import { IconArrowRight } from "@/components/Icons";
import { ProspectProvider } from "../campaigns/InviteSheet";
import { ProspectSearch, PasteFlow } from "../campaigns/ProspectSearch";
import { WarmSuggestions } from "../campaigns/WarmSuggestions";
import { ContactForm } from "./new/ContactForm";
import { ImportForm } from "./import/ImportForm";
import { ContactsTabs } from "./ContactsTabs";
import { CONTACT_TABS, type ContactTabKey } from "./tabs";

export const dynamic = "force-dynamic";

// Quantos contatos a tabela mostra; o resto se acha pela busca de Conversas ou na planilha.
const TABLE_MAX = 100;

const STAGE: Partial<Record<string, string>> = { NEEDS_HUMAN: "s-you", QUALIFIED: "s-ok", MEETING_SCHEDULED: "s-meet" };

// Área Contatos: os cinco jeitos de colocar gente nova (buscar, sugestões, colar, à mão, planilha) e a lista de todos.
// ?aba= abre direto numa aba; ?campaign= (vindo de uma campanha) já deixa a campanha marcada e o público dela na busca.
export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const searchEnabled = webSearchEnabled();
  const [campaigns, remaining, settings, searchesLeft, email, identity, people] = await Promise.all([
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, audience: true } }),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    searchEnabled ? searchesLeftThisMonth() : Promise.resolve(0),
    emailEnabled(),
    activeIdentityIdOrNull(),
    getConversationItems(),
  ]);
  const wanted = typeof params.campaign === "string" ? params.campaign : "";
  const initialCampaignId = campaigns.some((c) => c.id === wanted) ? wanted : "";
  const initialTab = (CONTACT_TABS.find((t) => t.key === params.aba)?.key ?? "buscar") as ContactTabKey;
  const left = Math.max(0, remaining);
  const simpleCampaigns = campaigns.map(({ id, name }) => ({ id, name }));

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-cont)" } as React.CSSProperties}>
      <MobileHeader />
      {initialCampaignId && (
        <Link href={`/campaigns/${initialCampaignId}`} className="btn-text" style={{ alignSelf: "flex-start" }}>
          ← Campanha
        </Link>
      )}
      <header className="area-head">
        <div className="grow">
          <h1 className="area-title">
            <i className="area-sq" aria-hidden="true" />
            Contatos
          </h1>
          <p className="area-sub">Coloque gente nova para o assistente abordar, do jeito que for mais fácil para você.</p>
        </div>
        <p className="cap-note">
          {left > 0 ? `Hoje ainda dá para convidar ${left} pessoas no LinkedIn` : "Limite de convites de hoje atingido"} · máximo de {settings.dailyInviteLimit} por dia
        </p>
      </header>

      <ProspectProvider value={{ campaigns: campaigns.map(({ id, name, description }) => ({ id, name, description })), defaultCampaignId: initialCampaignId, invitesLeft: left }}>
        <ContactsTabs
          initial={initialTab}
          panes={{
            buscar: <ProspectSearch initialKeywords={campaigns.find((c) => c.id === initialCampaignId)?.audience ?? []} searchEnabled={searchEnabled} searchesLeft={searchesLeft} />,
            quentes: <WarmSuggestions />,
            colar: <PasteFlow />,
            mao: (
              <ContactForm
                campaigns={simpleCampaigns}
                ready={{ LINKEDIN: Boolean(identity) && !settings.linkedinNeedsReconnect, EMAIL: email, WHATSAPP: deskcommConfigOf(settings) !== null }}
              />
            ),
            planilha: <ImportForm campaigns={simpleCampaigns} />,
          }}
        />
      </ProspectProvider>

      <section aria-labelledby="h-all">
        <div className="tbl-head">
          <h2 className="h2" id="h-all" style={{ margin: 0 }}>
            Todos os contatos <span className="muted-inline">· {people.length} {people.length === 1 ? "pessoa" : "pessoas"}, as mais recentes primeiro</span>
          </h2>
          <a href="/api/export/leads" download className="link-arrow">
            Baixar planilha <IconArrowRight size={16} />
          </a>
        </div>
        {people.length === 0 ? (
          <p className="empty">Ninguém na lista ainda. Use uma das abas acima para começar.</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Situação</th>
                  <th>Canal</th>
                  <th>Campanha</th>
                  <th>Responsável</th>
                  <th>Próximo passo</th>
                </tr>
              </thead>
              <tbody>
                {people.slice(0, TABLE_MAX).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/leads/${p.id}`} className="tbl-person">
                        <Avatar firstName={p.firstName} lastName={p.lastName} photoUrl={p.avatarUrl} size={32} />
                        <span>
                          <span className="n">{[p.firstName, p.lastName].filter(Boolean).join(" ") || "Contato"}</span>
                          {(p.role || p.company) && <small>{[p.role, p.company].filter(Boolean).join(" · ")}</small>}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`stage ${STAGE[p.status] ?? ""}`}>
                        <i aria-hidden="true" />
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td>
                      {p.channel ? (
                        <span className="row" style={{ gap: 6 }}>
                          <ChannelBadge channel={p.channel} size={18} />
                          {CHANNELS[p.channel].label}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{p.campaignName ?? <span className="muted">—</span>}</td>
                    <td>{p.assigneeName ?? <span className="muted">—</span>}</td>
                    <td>{p.nextStep ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {people.length > TABLE_MAX && (
          <p className="cap-note" style={{ marginTop: 10 }}>
            Mostrando os {TABLE_MAX} mais recentes. Para achar alguém, use a busca em <Link href="/conversations">Conversas</Link> ou baixe a planilha.
          </p>
        )}
      </section>
    </main>
  );
}
