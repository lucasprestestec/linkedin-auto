import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { parseExclusionLines, parseIdealClient } from "@/lib/audience";
import { describeRule } from "@/lib/followupPolicy";
import { parseWritingStyle, summarizeStyle } from "@/lib/writingStyle";
import { loadSuggestions } from "@/lib/styleSuggestions";
import { EMPTY_VOICE, parseVoiceSettings } from "@/lib/voice/settings";
import { fishConfigured } from "@/lib/voice/fish";
import { elevenConfigured } from "@/lib/voice/elevenlabs";
import { approvalStats } from "@/lib/outbox";
import { reviewStateOf } from "@/lib/campaignReview";
import { StyleOverview } from "../settings/StyleOverview";
import { VoiceOverview } from "../settings/VoiceOverview";
import { IdealClientForm } from "../settings/IdealClientForm";
import { FollowUpDefaultForm } from "../settings/FollowUpDefaultForm";
import { ExclusionListForm } from "../settings/ExclusionListForm";
import { VoicePicker } from "../voz/VoicePicker";
import { VoiceStudio } from "../voz/VoiceStudio";
import { ApprovalToggle } from "../approvals/ApprovalToggle";
import { CampaignReviewForm } from "../approvals/CampaignReviewForm";
import { ReleaseReviewButton } from "../approvals/ReleaseReviewButton";
import { VoiceTabs } from "./VoiceTabs";

export const dynamic = "force-dynamic";

// Só passa a sugerir desligar a aprovação depois de amostra suficiente.
const TRUST_MIN_DECIDED = 30;
const TRUST_MIN_RATE = 0.9;

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

// Uma linha que mostra o valor atual e abre para editar.
function Row({ id, title, summary, children }: { id?: string; title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="set-d" id={id} style={{ scrollMarginTop: 24 }}>
      <summary className="set-row">
        <span className="k">
          <b>{title}</b>
          <small>{summary}</small>
        </span>
        <span className="btn-line btn-sm" aria-hidden="true">
          Alterar
        </span>
      </summary>
      <div className="set-body">{children}</div>
    </details>
  );
}

// Área Assistente: como ele escreve, como ele fala (áudio e voz), quem ele aborda e o que passa por você antes de sair.
export default async function AssistantPage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const style = parseWritingStyle(settings.writingStyle);
  const voice = parseVoiceSettings(settings.voiceSettings);
  const picked = voice.provider === "elevenlabs" && voice.voiceId ? voice : null;
  const [suggestions, stats, waiting, reviewingRaw] = await Promise.all([
    // As sugestões são um extra: se falharem, a tela abre do mesmo jeito.
    loadSuggestions(style).catch(() => []),
    approvalStats(),
    prisma.draft.count({ where: { status: "APPROVED" } }),
    settings.campaignReview ? prisma.campaign.findMany({ where: { status: "ACTIVE", reviewReleasedAt: null }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const reviewing = (await Promise.all(reviewingRaw.map(async (c) => ({ campaign: c, state: await reviewStateOf(c, settings) })))).filter((r) => r.state.inReview);
  const rate = stats.decided ? stats.untouched / stats.decided : 0;
  const trusted = stats.decided >= TRUST_MIN_DECIDED && rate >= TRUST_MIN_RATE;

  return (
    <main className="page page-wide" style={{ "--c": "var(--a-ia)" } as React.CSSProperties}>
      <MobileHeader />
      <header className="area-head">
        <div className="grow">
          <h1 className="area-title">
            <i className="area-sq" aria-hidden="true" />
            Assistente
          </h1>
          <p className="area-sub">Como ele escreve, como ele fala e quem ele aborda por você.</p>
        </div>
      </header>

      <div className="ai-grid">
        <section id="jeito" className="panel" aria-labelledby="h-jeito" style={{ scrollMarginTop: 24 }}>
          <h2 className="panel-h" id="h-jeito">
            Jeito de escrever
          </h2>
          <p className="cap-note" style={{ marginBottom: 14 }}>
            {summarizeStyle(style)}
            {suggestions.length ? ` · ${suggestions.length === 1 ? "1 sugestão nova" : `${suggestions.length} sugestões novas`}` : ""}
          </p>
          <StyleOverview style={style} suggestions={suggestions} />
        </section>

        <section className="panel" aria-labelledby="h-audio">
          <h2 className="panel-h" id="h-audio">
            Quando mandar áudio
          </h2>
          <VoiceOverview voice={voice} configured={fishConfigured() || elevenConfigured()} />
        </section>
      </div>

      <VoiceTabs
        initial={voice.provider === "fish" ? "mine" : "ready"}
        ready={<VoicePicker currentId={picked?.voiceId ?? null} currentName={picked?.voiceName ?? null} configured={elevenConfigured()} />}
        mine={<VoiceStudio ownerName={settings.ownerName?.trim() || null} voice={voice.provider === "fish" ? voice : EMPTY_VOICE} configured={fishConfigured()} />}
      />

      <section id="alcance" aria-labelledby="h-alcance" style={{ scrollMarginTop: 24 }}>
        <h2 className="panel-h" id="h-alcance">
          Quem ele aborda e como
        </h2>
        <div className="set">
          <Row title="Quem você quer alcançar" summary={audienceSummary(settings.targetAudience)}>
            <IdealClientForm value={settings.targetAudience ?? ""} />
          </Row>
          <Row title="Quantas vezes insistir" summary={describeRule(Math.min(10, settings.followUpMaxCount), settings.followUpDelayHours)}>
            <FollowUpDefaultForm count={Math.min(10, settings.followUpMaxCount)} days={Math.min(30, Math.max(1, Math.round(settings.followUpDelayHours / 24)))} />
          </Row>
          <Row title="Quem nunca contatar" summary={exclusionSummary(settings.exclusionList)}>
            <ExclusionListForm value={settings.exclusionList ?? ""} />
          </Row>
        </div>
      </section>

      <section id="aprovacao" aria-labelledby="h-aprov" style={{ scrollMarginTop: 24 }}>
        <h2 className="panel-h" id="h-aprov">
          O que passa por você
        </h2>
        <div className="set">
          <div className="set-row">
            <span className="k">
              <b>Aprovar mensagens antes de sair</b>
              <small>
                {!settings.approvalMode
                  ? "Desligado: o assistente envia sozinho, menos campanha nova em revisão e resposta em que ele ficou em dúvida."
                  : stats.decided === 0
                    ? "Ligado: nada sai sem o seu OK, menos os lembretes de reunião, que saem sozinhos no horário. Quando você aprovar as primeiras, mostro quantas o assistente acertou sem você mexer."
                    : trusted
                      ? `Acertou ${stats.untouched} de ${stats.decided} sem você mexer. Já dá para desligar a aprovação com segurança.`
                      : `Aprovadas sem mudar nada: ${stats.untouched} de ${stats.decided}. Com ${TRUST_MIN_DECIDED} decisões e 90% de acerto, sugiro liberar o automático.`}
              </small>
            </span>
            <ApprovalToggle on={settings.approvalMode} />
          </div>
          <div className="set-body" style={{ paddingTop: 18 }}>
            <span className="k">
              <b>Campanha nova</b>
              <small className="muted" style={{ display: "block" }}>
                Nas primeiras semanas de cada campanha, tudo o que o assistente escreve nela passa por você.
              </small>
            </span>
            <CampaignReviewForm on={settings.campaignReview} days={settings.campaignReviewDays} messages={settings.campaignReviewMessages} />
            {reviewing.map(({ campaign, state }) => (
              <div key={campaign.id} className="member">
                <span className="k">
                  <b>{campaign.name}</b>
                  <small>
                    Em revisão: {Math.min(state.sent, state.messages)} de {state.messages} mensagens · prazo até{" "}
                    {state.until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </small>
                </span>
                <ReleaseReviewButton campaignId={campaign.id} name={campaign.name} />
              </div>
            ))}
          </div>
        </div>
        {waiting > 0 && (
          <p className="cap-note" style={{ marginTop: 10 }} role="status">
            {waiting} mensage{waiting > 1 ? "ns" : "m"} já aprovada{waiting > 1 ? "s" : ""} aguardando o horário de trabalho ({settings.workStartHour}h às {settings.workEndHour}h).
          </p>
        )}
      </section>
    </main>
  );
}
