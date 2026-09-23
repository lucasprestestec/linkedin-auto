const EDGES_API_BASE = "https://api.edges.run/v1";

function getConfig() {
  const apiKey = process.env.EDGES_API_KEY;
  const identityId = process.env.EDGES_IDENTITY_ID;
  if (!apiKey || !identityId) {
    throw new Error("EDGES_API_KEY / EDGES_IDENTITY_ID não configurados.");
  }
  return { apiKey, identityId };
}

async function callAction<T>(actionSlug: string, payload: Record<string, unknown>): Promise<T> {
  const { apiKey } = getConfig();
  const res = await fetch(`${EDGES_API_BASE}/actions/${actionSlug}/run/live`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Edges action "${actionSlug}" falhou: ${data?.message ?? res.statusText}`);
  }
  return data as T;
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

export async function sendConnectionInvite(profileUrl: string, note: string) {
  const { identityId } = getConfig();
  return callAction<EdgesConnectResult>("linkedin-connect-profile", {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
    parameters: { message: note },
  });
}

export async function sendMessage(profileUrl: string, message: string) {
  const { identityId } = getConfig();
  return callAction<EdgesMessageResult>("linkedin-message-profile", {
    identity_ids: [identityId],
    input: { linkedin_profile_url: profileUrl },
    parameters: { message },
  });
}

export async function extractConversations() {
  const { identityId } = getConfig();
  return callAction<EdgesConversation[]>("linkedin-extract-conversations", {
    identity_ids: [identityId],
    parameters: { read: true },
  });
}
