const EDGES_API_BASE = "https://api.edges.run/v1";

function getApiKey() {
  const apiKey = process.env.EDGES_API_KEY;
  if (!apiKey) throw new Error("EDGES_API_KEY não configurado.");
  return apiKey;
}

async function edgesFetchRaw(path: string, init?: RequestInit) {
  const res = await fetch(`${EDGES_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-API-Key": getApiKey(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Edges request "${path}" falhou: ${data?.message ?? res.statusText}`);
  }
  return { data, headers: res.headers };
}

async function edgesFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await edgesFetchRaw(path, init);
  return data as T;
}

async function callAction<T>(actionSlug: string, payload: Record<string, unknown>): Promise<T> {
  return edgesFetch<T>(`/actions/${actionSlug}/run/live`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface EdgesIdentity {
  uid: string;
  name: string;
  integrations: string[];
  identity_login_links?: { linkedin?: string };
}

export async function createIdentity(name: string, timezone: string) {
  return edgesFetch<EdgesIdentity>("/identities", {
    method: "POST",
    body: JSON.stringify({ name, timezone, type: "engagement" }),
  });
}

export async function getIdentity(identityId: string) {
  return edgesFetch<EdgesIdentity>(`/identities/${identityId}`);
}

export async function deleteIdentity(identityId: string) {
  return edgesFetch<Record<string, never>>(`/identities/${identityId}`, { method: "DELETE" });
}

export interface EdgesMessageResult {
  is_sent: boolean;
  linkedin_thread_id: string;
  linkedin_message_id: string;
  delivered_at: string;
}

export interface EdgesConnectResult {
  connected: boolean;
  pending: boolean;
  linkedin_profile_id: number;
}

export interface EdgesConversation {
  linkedin_thread_id: string;
  linkedin_thread_url?: string;
  linkedin_profile_url: string;
  first_name: string;
  last_name: string;
  job_title: string;
  unread_count: number;
  last_activity_at: string;
  last_message: {
    content: string;
    delivered_at: string;
    message_id: string;
    first_name: string;
  };
}

// Uma mensagem do histórico de uma conversa (ação "Extract LinkedIn Messages").
// linkedin_profile_id é de quem ENVIOU a mensagem — é o que diz se foi o lead.
export interface EdgesThreadMessage {
  linkedin_thread_id: string;
  position: number;
  delivered_at: string;
  created_at?: string;
  first_name: string;
  last_name: string;
  linkedin_profile_id: number;
  content: string;
  message_id: string;
  attachments?: object[];
}

export interface EdgesAsyncRun {
  run_uid: string;
  status: string;
}

// Convite sem nota, em modo async: a edges.run espaça e limita as chamadas por conta
// própria (ver docs.edges.run/v1/actions/linkedin-connect-profile-async) — em modo
// live isso seria responsabilidade nossa, e uma função serverless não segura um loop
// com espera de minutos entre convites. custom_data volta em cada callback, é como
// identificamos qual perfil foi processado.
export async function scheduleConnectionInvites(
  identityId: string,
  candidates: { linkedin_profile_url: string; full_name?: string; job_title?: string; icp_score?: number; campaign_id?: string }[],
  callbackUrl: string,
) {
  return edgesFetch<EdgesAsyncRun>("/actions/linkedin-connect-profile/run/async", {
    method: "POST",
    body: JSON.stringify({
      identity_ids: [identityId],
      inputs: candidates.map((c) => ({
        linkedin_profile_url: c.linkedin_profile_url,
        custom_data: { full_name: c.full_name, job_title: c.job_title, icp_score: c.icp_score, campaign_id: c.campaign_id },
      })),
      callback: { url: callbackUrl },
    }),
  });
}

export async function sendMessage(identityId: string, profileUrl: string, message: string) {
  return callAction<EdgesMessageResult>("linkedin-message-profile", {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
    parameters: { message },
  });
}

export async function extractConversations(identityId: string) {
  return callAction<EdgesConversation[]>("linkedin-extract-conversations", {
    identity_ids: [identityId],
    parameters: { read: true },
  });
}

// A conversa é identificada pela URL da thread. A listagem de conversas pode já
// trazer essa URL; se não trouxer, montamos a URL padrão do LinkedIn pelo ID.
export function threadUrl(conv: Pick<EdgesConversation, "linkedin_thread_id" | "linkedin_thread_url">): string {
  return conv.linkedin_thread_url || `https://www.linkedin.com/messaging/thread/${conv.linkedin_thread_id}/`;
}

// Histórico completo de uma conversa, em ordem. extractConversations só traz a
// última mensagem de cada conversa — se o lead manda duas seguidas entre uma
// rodada do cron e outra, a primeira se perderia sem isso.
export async function extractThreadMessages(identityId: string, linkedinThreadUrl: string) {
  const data = await callAction<EdgesThreadMessage[]>("linkedin-extract-messages", {
    identity_ids: [identityId],
    input: { linkedin_thread_url: linkedinThreadUrl },
  });
  if (!Array.isArray(data)) throw new Error("Resposta inesperada de linkedin-extract-messages.");
  return data;
}

// Conexões mais recentes da conta (ação "Extract LinkedIn Connections", tipo
// Engagement). É como detectamos que um convite foi aceito: aceitar convite sem
// nota não cria conversa no LinkedIn, então extract-conversations não enxerga.
export interface EdgesConnection {
  connected_at?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  linkedin_profile_handle?: string;
  linkedin_profile_url?: string;
  linkedin_profile_id?: number;
}

export async function extractConnections(identityId: string): Promise<EdgesConnection[]> {
  const data = await callAction<EdgesConnection[]>("linkedin-extract-connections", {
    identity_ids: [identityId],
  });
  if (!Array.isArray(data)) throw new Error("Resposta inesperada de linkedin-extract-connections.");
  return data;
}

// Quem visitou o perfil da conta (ação "Extract LinkedIn Profile Viewers",
// Engagement, sem input). Em conta gratuita o LinkedIn só expõe as últimas
// poucas visitas, e visitas em modo privado vêm sem URL de perfil.
export interface EdgesProfileViewer {
  view_timestamp?: number;
  view_date?: string;
  connection_degree?: string;
  linkedin_profile_handle?: string;
  headline?: string;
  linkedin_profile_url?: string;
  linkedin_profile_id?: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export async function extractProfileViewers(identityId: string): Promise<EdgesProfileViewer[]> {
  const data = await callAction<EdgesProfileViewer[]>("linkedin-extract-profile-viewers", { identity_ids: [identityId] });
  if (!Array.isArray(data)) throw new Error("Resposta inesperada de linkedin-extract-profile-viewers.");
  return data;
}

// Quem segue o perfil da conta (ação "Extract LinkedIn Followers", Engagement,
// sem input). Inclui as conexões: no LinkedIn, conexão segue automaticamente.
export interface EdgesFollower {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  linkedin_profile_handle?: string;
  linkedin_profile_url?: string;
  linkedin_profile_id?: number;
}

export async function extractFollowers(identityId: string): Promise<EdgesFollower[]> {
  const data = await callAction<EdgesFollower[]>("linkedin-extract-followers", { identity_ids: [identityId] });
  if (!Array.isArray(data)) throw new Error("Resposta inesperada de linkedin-extract-followers.");
  return data;
}

// ---------------------------------------------------------------------------
// Ações Engagement opcionais (ligadas em Ajustes). Os slugs abaixo seguem o
// padrão das ações já confirmadas (linkedin-connect-profile,
// linkedin-message-profile...); se algum não bater com o Actions Library, é
// só corrigir aqui. Todas são tolerantes: falha vira log, não derruba o cron.
// ---------------------------------------------------------------------------

export const ENGAGEMENT_ACTIONS = {
  // Confirmados na documentação: accept-invitation, withdraw-invitation,
  // visit-profile, follow-profile, archive-message, extract-sent-invitations.
  // extract-received-invitations também confirmado.
  acceptInvitation: "linkedin-accept-invitation",
  extractReceivedInvitations: "linkedin-extract-received-invitations",
  withdrawInvitation: "linkedin-withdraw-invitation",
  visitProfile: "linkedin-visit-profile",
  followProfile: "linkedin-follow-profile",
  archiveMessage: "linkedin-archive-message",
  extractSentInvitations: "linkedin-extract-sent-invitations",
} as const;

// Convite (recebido ou enviado) como a edges.run devolve.
export interface EdgesInvitationRef {
  linkedin_invitation_id?: string;
  linkedin_invitation_urn?: string;
}

// Convite recebido pendente (formato confirmado na documentação). Atenção aos
// nomes: o segredo vem como "invitation_secret" (e a ação de aceitar recebe
// como "linkedin_invitation_secret"), e o cargo vem em "title".
export interface EdgesReceivedInvitation extends EdgesInvitationRef {
  invitation_secret?: string;
  message?: string;
  sent_date?: string;
  linkedin_profile_url?: string;
  linkedin_profile_handle?: string;
  linkedin_profile_id?: number;
  linkedin_profile_image_url?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
}

export async function extractReceivedInvitations(identityId: string): Promise<EdgesReceivedInvitation[]> {
  const data = await callAction<unknown>(ENGAGEMENT_ACTIONS.extractReceivedInvitations, { identity_ids: [identityId], parameters: {} });
  return Array.isArray(data) ? (data as EdgesReceivedInvitation[]) : [];
}

// Aceita UM convite recebido (a ação exige urn + secret do convite).
export async function acceptInvitation(identityId: string, urn: string, secret: string) {
  return callAction<unknown>(ENGAGEMENT_ACTIONS.acceptInvitation, {
    identity_ids: [identityId],
    input: { linkedin_invitation_urn: urn, linkedin_invitation_secret: secret },
  });
}

// Convites que a conta enviou e ainda estão pendentes — é daqui que sai o URN
// que a ação de retirar exige. Formato do item a confirmar no Actions Library.
export interface EdgesSentInvitation extends EdgesInvitationRef {
  linkedin_profile_url?: string;
  linkedin_profile_handle?: string;
  sent_date?: string;
}

export async function extractSentInvitations(identityId: string): Promise<EdgesSentInvitation[]> {
  // Paginada (100 por página); a primeira página basta pro volume de um corretor.
  const data = await callAction<unknown>(ENGAGEMENT_ACTIONS.extractSentInvitations, { identity_ids: [identityId], parameters: {} });
  return Array.isArray(data) ? (data as EdgesSentInvitation[]) : [];
}

export async function withdrawInvitation(identityId: string, invitationUrn: string) {
  return callAction<unknown>(ENGAGEMENT_ACTIONS.withdrawInvitation, {
    identity_ids: [identityId],
    input: { linkedin_invitation_urn: invitationUrn, linkedin_invitation_type: "CONNECTION" },
  });
}

export async function visitProfile(identityId: string, profileUrl: string) {
  return callAction<unknown>(ENGAGEMENT_ACTIONS.visitProfile, {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
  });
}

export async function followProfile(identityId: string, profileUrl: string) {
  return callAction<unknown>(ENGAGEMENT_ACTIONS.followProfile, {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
  });
}

export async function archiveThread(identityId: string, linkedinThreadId: string) {
  return callAction<unknown>(ENGAGEMENT_ACTIONS.archiveMessage, {
    identity_ids: [identityId],
    input: { linkedin_thread_id: linkedinThreadId },
  });
}
