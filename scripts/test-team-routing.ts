// Confere quem recebe cada aviso da equipe (função, "cuida de" e responsável). Sem banco e sem IA.
// Uso: npx tsx scripts/test-team-routing.ts
import assert from "node:assert/strict";
import type { TeamMember } from "@prisma/client";
import { recipients } from "../src/lib/team";

const m = (id: string, extra: Partial<TeamMember> = {}): TeamMember => ({
  id, name: id, email: `${id}@x.com`, phone: null, whatsappConversationId: null,
  notifyUrgent: false, notifyMeetings: false, notifyHandoffs: false,
  role: null, handles: [], viaEmail: true, viaWhatsapp: true, createdAt: new Date(), ...extra,
});
const team = [
  m("daniel", { notifyUrgent: true, handles: ["BUSINESS", "PARTNER"] }),
  m("julia", { notifyUrgent: true, handles: ["CANDIDATE"] }),
  m("maria", { notifyUrgent: true }),
  m("preposto", { handles: ["PERSON"] }),
];
const ids = (kind: "urgent" | "meeting" | "handoff", lead: { kind: TeamMember["handles"][number] | null; assigneeId: string | null } | null) => recipients(team, kind, lead).map((x) => x.id).sort();

// Urgência: quem marcou urgência (e o responsável, se houver), não o time inteiro.
assert.deepEqual(ids("urgent", { kind: "PERSON", assigneeId: null }), ["daniel", "julia", "maria"]);
assert.deepEqual(ids("urgent", { kind: "PERSON", assigneeId: "preposto" }), ["daniel", "julia", "maria", "preposto"]);
// Reunião e "precisa de você": quem cuida do tipo do contato.
assert.deepEqual(ids("meeting", { kind: "BUSINESS", assigneeId: null }), ["daniel"]);
assert.deepEqual(ids("handoff", { kind: "CANDIDATE", assigneeId: null }), ["julia"]);
assert.deepEqual(ids("meeting", { kind: "PERSON", assigneeId: null }), ["preposto"]);
// Com responsável, só ele (os outros do mesmo tipo não são avisados).
assert.deepEqual(ids("meeting", { kind: "PERSON", assigneeId: "daniel" }), ["daniel"]);
// Sem tipo e sem responsável, ninguém além de quem marcou o aviso; sem contato, só os marcados.
assert.deepEqual(ids("meeting", { kind: null, assigneeId: null }), []);
assert.deepEqual(ids("meeting", null), []);
console.log("ok: avisos da equipe (função, cuida de e responsável)");
