// Testes da trava de aÃ§Ãµes pagas do Edges (sem rede): npx tsx scripts/test-edges-guard.ts
import assert from "node:assert/strict";
import { FREE_EDGES_ACTIONS, EdgesPaidActionError, assertFreeEdgesAction, ENGAGEMENT_ACTIONS } from "../src/lib/edges";

let failed = false;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed = true;
    console.log(`FAIL ${name}\n     ${err instanceof Error ? err.message : err}`);
  }
}

const FREE = ["linkedin-connect-profile", "linkedin-message-profile", "linkedin-extract-conversations", "linkedin-extract-messages", "linkedin-extract-connections", "linkedin-follow-profile"];
const PAID = ["linkedin-accept-invitation", "linkedin-withdraw-invitation", "linkedin-archive-message", "linkedin-visit-profile", "linkedin-extract-profile-viewers", "linkedin-extract-followers", "linkedin-extract-received-invitations", "linkedin-extract-sent-invitations", "linkedin-search-people"];

check("a lista grÃ¡tis tem exatamente as 6 aÃ§Ãµes confirmadas", () => assert.deepEqual([...FREE_EDGES_ACTIONS].sort(), [...FREE].sort()));
for (const slug of FREE) check(`libera ${slug}`, () => assert.doesNotThrow(() => assertFreeEdgesAction(slug, {})));
for (const slug of PAID) check(`bloqueia ${slug}`, () => assert.throws(() => assertFreeEdgesAction(slug, {}), EdgesPaidActionError));
check("com EDGES_ALLOW_PAID_ACTIONS=1 a trava sai", () => assert.doesNotThrow(() => assertFreeEdgesAction("linkedin-visit-profile", { EDGES_ALLOW_PAID_ACTIONS: "1" })));
check("valor diferente de 1 nÃ£o desliga a trava", () => assert.throws(() => assertFreeEdgesAction("linkedin-visit-profile", { EDGES_ALLOW_PAID_ACTIONS: "true" }), EdgesPaidActionError));
check("as aÃ§Ãµes de engagement opcionais do cÃ³digo estÃ£o bloqueadas, menos o follow", () => {
  assert.throws(() => assertFreeEdgesAction(ENGAGEMENT_ACTIONS.visitProfile, {}), EdgesPaidActionError);
  assert.throws(() => assertFreeEdgesAction(ENGAGEMENT_ACTIONS.acceptInvitation, {}), EdgesPaidActionError);
  assert.doesNotThrow(() => assertFreeEdgesAction(ENGAGEMENT_ACTIONS.followProfile, {}));
});

process.exit(failed ? 1 : 0);
