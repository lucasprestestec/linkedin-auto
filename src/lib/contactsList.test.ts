import assert from "node:assert/strict";
import { contactsWhere } from "./contactsList";

// Rodar: npx tsx src/lib/contactsList.test.ts
assert.deepEqual(contactsWhere({}), {});
assert.deepEqual(contactsWhere({ q: "   " }), {});
assert.deepEqual(contactsWhere({ q: "(51)" }), {}); // pedaço de telefone com máscara é ignorado
const w = contactsWhere({ q: "ana (51) 99999", campaign: "none", assignee: "m1" }) as { AND: unknown[] };
assert.equal(w.AND.length, 2 + 2); // "ana" e "99999" + campanha + responsável
assert.deepEqual(w.AND[2], { campaignId: null });
assert.deepEqual(w.AND[3], { assigneeId: "m1" });
const ors = (i: number) => (w.AND[i] as { OR: unknown[] }).OR.length;
assert.equal(ors(0), 4); // nome, sobrenome, cargo, e-mail
assert.equal(ors(1), 5); // + telefone
console.log("ok");
