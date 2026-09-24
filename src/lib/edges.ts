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
  candidates: { linkedin_profile_url: string; full_name?: string; job_title?: string }[],
  callbackUrl: string,
) {
  return edgesFetch<EdgesAsyncRun>("/actions/linkedin-connect-profile/run/async", {
    method: "POST",
    body: JSON.stringify({
      identity_ids: [identityId],
      inputs: candidates.map((c) => ({
        linkedin_profile_url: c.linkedin_profile_url,
        custom_data: { full_name: c.full_name, job_title: c.job_title },
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
// Devolve só as URLs de perfil; o formato de cada item é tratado de forma
// tolerante porque o nome do campo não foi confirmado na documentação.
export async function extractConnectionProfileUrls(identityId: string): Promise<string[]> {
  const data = await callAction<unknown>("linkedin-extract-connections", {
    identity_ids: [identityId],
  });
  if (!Array.isArray(data)) throw new Error("Resposta inesperada de linkedin-extract-connections.");
  const urls: string[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = record.linkedin_profile_url ?? record.profile_url ?? record.linkedin_url;
    if (typeof url === "string") urls.push(url);
  }
  return urls;
}
