import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { remainingDailyInviteQuota } from "@/lib/prospect";
import { searchesLeftThisMonth, webSearchEnabled } from "@/lib/websearch";
import { emailEnabled } from "@/lib/email";
import { deskcommConfigOf } from "@/lib/deskcomm";
import { activeIdentityIdOrNull } from "@/lib/identity";
import { getContactsPage } from "@/lib/contactsList";
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

const STAGE: Partial<Record<string, string>> = { NEEDS_HUMAN: "s-you", QUALIFIED: "s-ok", MEETING_SCHEDULED: "s-meet" };

// Área Contatos: os cinco jeitos de colocar gente nova (buscar, sugestões, colar, à mão, planilha) e a lista de todos.
// ?aba= abre direto numa aba; ?campaign= (vindo de uma campanha) já deixa a campanha marcada e o público dela na busca.
export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const params = await searchParams;
  const searchEnabled = webSearchEnabled();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const filter = { q: str(params.q).slice(0, 80), campaign: str(params.fc), assignee: str(params.fr), page: Number(str(params.p)) || 1 };
  const [campaigns, remaining, settings, searchesLeft, email, identity, list, allCampaigns, team] = await Promise.all([
    prisma.campaign.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, audience: true } }),
    remainingDailyInviteQuota(),
    prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } }),
    searchEnabled ? searchesLeftThisMonth() : Promise.resolve(0),
    emailEnabled(),
    activeIdentityIdOrNull(),
    getContactsPage(filter),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teamMember.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const people = list.items;
  const filtering = Boolean(filter.q || filter.campaign || filter.assignee);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filter.q) sp.set("q", filter.q);
    if (filter.campaign) sp.set("fc", filter.campaign);
    if (filter.assignee) sp.set("fr", filter.assignee);
    if (p > 1) sp.set("p", String(p));
    const qs = sp.toString();
    return `/contacts${qs ? `?${qs}` : ""}#h-all`;
  };
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
            Todos os contatos <span className="muted-inline">· {list.total} {list.total === 1 ? "pessoa" : "pessoas"}, as mais recentes primeiro</span>
          </h2>
          <a href="/api/export/leads" download className="link-arrow">
            Baixar planilha <IconArrowRight size={16} />
          </a>
        </div>
        <form method="get" action="/contacts#h-all" className="row" style={{ gap: 8, flexWrap: "wrap", margin: "8px 0 12px" }}>
          <input className="field" type="search" name="q" defaultValue={filter.q} placeholder="Buscar por nome, empresa, e-mail ou telefone" aria-label="Buscar contatos" style={{ flex: "1 1 240px" }} />
          <select className="field" name="fc" defaultValue={filter.campaign} aria-label="Campanha" style={{ flex: "0 1 180px" }}>
            <option value="">Todas as campanhas</option>
            <option value="none">Sem campanha</option>
            {allCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {team.length > 0 && (
            <select className="field" name="fr" defaultValue={filter.assignee} aria-label="Responsável" style={{ flex: "0 1 180px" }}>
              <option value="">Todos os responsáveis</option>
              <option value="none">Sem responsável</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-solid btn-sm">
            Buscar
          </button>
          {filtering && (
            <Link href="/contacts#h-all" className="btn-text">
              Limpar
            </Link>
          )}
        </form>
        {people.length === 0 ? (
          <p className="empty">{filtering ? "Ninguém encontrado com esses filtros." : "Ninguém na lista ainda. Use uma das abas acima para começar."}</p>
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
                {people.map((p) => (
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
        {list.pages > 1 && (
          <nav className="row" style={{ gap: 12, marginTop: 10, alignItems: "center" }} aria-label="Páginas de contatos">
            {list.page > 1 ? <Link href={pageHref(list.page - 1)} className="btn-text">← Anterior</Link> : <span className="muted">← Anterior</span>}
            <span className="cap-note">
              Página {list.page} de {list.pages}
            </span>
            {list.page < list.pages ? <Link href={pageHref(list.page + 1)} className="btn-text">Próxima →</Link> : <span className="muted">Próxima →</span>}
          </nav>
        )}
      </section>
    </main>
  );
}
