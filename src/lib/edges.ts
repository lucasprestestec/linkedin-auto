import { MAX_SEARCH_RESULTS } from "@/lib/prospect-constants";

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

export async function sendConnectionInvite(identityId: string, profileUrl: string, note: string) {
  return callAction<EdgesConnectResult>("linkedin-connect-profile", {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
    parameters: { message: note },
  });
}

export interface EdgesSearchPerson {
  full_name: string;
  linkedin_profile_url: string;
  job_title?: string;
  company_name?: string;
  headline?: string;
  location?: string;
  profile_image_url?: string;
}

const SEARCH_PAGE_SIZE = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Busca por texto livre (cargo, setor, cidade combinados numa frase) — não usamos
// geoUrn/filtros estruturados do LinkedIn de propósito: exigiriam uma segunda chamada
// de lookup de localização, e o critério aqui é uma frase que o corretor escreve, não
// uma URL de busca do LinkedIn. Pagina até `maxResults` (arredondado pra cima em
// blocos de 10), com uma pausa curta entre páginas — ver Live Mode: Safe Practices
// da edges.run sobre não disparar chamadas em sequência sem espaçamento.
export async function searchPeople(identityId: string, keywords: string, maxResults = SEARCH_PAGE_SIZE) {
  const cappedMax = Math.min(maxResults, MAX_SEARCH_RESULTS);
  const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

  const results: EdgesSearchPerson[] = [];
  let cursor: string | null = null;

  while (results.length < cappedMax) {
    const path = cursor
      ? `/actions/linkedin-search-people/run/live?cursor=${encodeURIComponent(cursor)}`
      : "/actions/linkedin-search-people/run/live";

    const { data, headers } = await edgesFetchRaw(path, {
      method: "POST",
      body: JSON.stringify({
        identity_mode: "direct",
        identity_ids: [identityId],
        input: { linkedin_people_search_url: searchUrl },
      }),
    });

    results.push(...(data as EdgesSearchPerson[]));
    const next = headers.get("x-pagination-next");
    if (!next) break;
    // O header vem com a URL absoluta da próxima página (ex: ".../run/live?cursor=XYZ"),
    // não só o token — extrai o valor do param em vez de reencapsular a URL inteira
    // dentro de um novo "cursor=" (o que gerava "invalid cursor provided").
    cursor = next.startsWith("http") ? new URL(next).searchParams.get("cursor") : next;
    if (!cursor) break;

    await sleep(3000 + Math.floor(Math.random() * 2000));
  }

  return results.slice(0, cappedMax);
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
