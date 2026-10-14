// Confere as regras das caixas de envio (aquecimento, rodízio, e-mail devolvido) e a cifra da senha. Sem banco e sem rede.
// Uso: npx tsx scripts/test-mailboxes.ts
import assert from "node:assert/strict";
import { chooseMailbox, effectiveLimit, parseBounce, presetFor, remainingToday, startOfDaySP, totalRemainingToday, type MailboxLike } from "../src/lib/mailboxPolicy";
import { open, seal } from "../src/lib/secretBox";

const at = (iso: string) => new Date(iso);
const mb = (id: string, started: string, extra: Partial<MailboxLike> = {}): MailboxLike => ({ id, status: "ACTIVE", dailyLimit: 25, startedAt: at(started), ...extra });

// Dia de São Paulo: 02:00Z ainda é o dia anterior.
assert.equal(startOfDaySP(at("2026-10-15T02:00:00Z")).toISOString(), "2026-10-14T03:00:00.000Z");
assert.equal(startOfDaySP(at("2026-10-15T14:00:00Z")).toISOString(), "2026-10-15T03:00:00.000Z");

// Aquecimento: 5 no primeiro dia, +1 por dia, teto de 25.
const a = mb("a", "2026-10-01T12:00:00Z");
assert.equal(effectiveLimit(a, at("2026-10-01T15:00:00Z")), 5);
assert.equal(effectiveLimit(a, at("2026-10-04T15:00:00Z")), 8);
assert.equal(effectiveLimit(a, at("2026-11-30T15:00:00Z")), 25);
assert.equal(effectiveLimit(mb("b", "2026-10-01T12:00:00Z", { dailyLimit: 3 }), at("2026-10-10T12:00:00Z")), 3, "teto menor que o começo");
assert.equal(remainingToday(a, 7, at("2026-10-04T15:00:00Z")), 1);
assert.equal(remainingToday(a, 99, at("2026-10-04T15:00:00Z")), 0);

// Rodízio: vai para quem tem mais espaço; pausada e aposentada ficam de fora.
const now = at("2026-11-30T15:00:00Z");
const boxes = [mb("a", "2026-10-01T12:00:00Z"), mb("b", "2026-10-01T12:00:00Z"), mb("c", "2026-10-01T12:00:00Z", { status: "PAUSED" }), mb("d", "2026-10-01T12:00:00Z", { status: "RETIRED" })];
const sent: Record<string, number> = { a: 20, b: 3, c: 0, d: 0 };
const used = (id: string) => sent[id] ?? 0;
assert.equal(chooseMailbox(boxes, used, { now })?.id, "b");
// Quem já conversa com "a" continua nela se houver espaço, mesmo havendo mais espaço em "b".
assert.equal(chooseMailbox(boxes, used, { now, preferredId: "a" })?.id, "a");
// "a" lotada: quem só recebeu e-mail nosso muda de caixa; quem respondeu continua nela.
sent.a = 25;
assert.equal(chooseMailbox(boxes, used, { now, preferredId: "a" })?.id, "b");
assert.equal(chooseMailbox(boxes, used, { now, preferredId: "a", replied: true })?.id, "a");
// Caixa pausada não é preferida nem para quem respondeu.
assert.equal(chooseMailbox(boxes, used, { now, preferredId: "c", replied: true })?.id, "b");
// Tudo lotado: nenhuma caixa.
sent.b = 25;
assert.equal(chooseMailbox(boxes, used, { now }), null);
sent.a = 20;
sent.b = 3;
assert.equal(totalRemainingToday(boxes, used, now), 5 + 22);

// E-mail devolvido.
const hard = parseBounce(
  {
    from: "MAILER-DAEMON@mail.dors-contato.com",
    subject: "Undelivered Mail Returned to Sender",
    text: "<maria@empresa.com.br>: host mx.empresa.com.br said: 550 5.1.1 User unknown (in reply to RCPT TO command)\nRemetente: helena@dors-contato.com",
  },
  "helena@dors-contato.com",
);
assert.deepEqual(hard, { permanent: true, recipients: ["maria@empresa.com.br"] });
const soft = parseBounce({ from: "postmaster@x.com", subject: "Delivery Status Notification (Delay)", text: "Delayed: pedro@x.com 4.4.1 will keep trying" }, "helena@d.com");
assert.equal(soft?.permanent, false);
assert.equal(parseBounce({ from: "lead@x.com", subject: "Re: Oi", text: "Pode ser terça" }, "helena@d.com"), null);

// Servidores conhecidos.
assert.equal(presetFor("fulano@gmail.com")?.smtp.host, "smtp.gmail.com");
assert.equal(presetFor("fulano@empresa.com.br"), null);

// Senha cifrada: volta igual, e adulterada não abre.
const fakeKey = "teste".repeat(8);
process.env.SESSION_SECRET = fakeKey;
const box = seal("minha senha 123");
assert.notEqual(box, "minha senha 123");
assert.equal(open(box), "minha senha 123");
assert.notEqual(seal("minha senha 123"), box, "cada cifra usa um valor novo");
assert.throws(() => open(box.slice(0, -2) + "AA"));

console.log("ok: caixas de envio");
