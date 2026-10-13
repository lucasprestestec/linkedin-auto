"use server";

import { revalidatePath } from "next/cache";
import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export interface StepInput {
  day: number;
  channel: MessageChannel | null;
  text: string;
  notify: boolean;
}

const CHANNELS: MessageChannel[] = ["LINKEDIN", "EMAIL", "WHATSAPP"];
const MAX_STEPS = 12;

// Salva a cadência inteira: initial = mensagem inicial (D0, opcional);
// steps = retomadas, com dias crescentes contados a partir dela.
export async function saveCadence(campaignId: string, initial: string, steps: StepInput[]): Promise<{ error?: string }> {
  await requireSession();
  const first = initial.trim();
  if (steps.length > MAX_STEPS) return { error: `No máximo ${MAX_STEPS} passos.` };
  let previous = 0;
  for (const [i, st] of steps.entries()) {
    const n = i + 1;
    if (!st.text.trim()) return { error: `O passo ${n} está sem texto.` };
    if (st.text.length > 2000 || first.length > 2000) return { error: "Cada texto pode ter até 2.000 caracteres." };
    if (!Number.isInteger(st.day) || st.day <= previous || st.day > 120) {
      return { error: `O passo ${n} precisa ser depois do anterior (dia maior que ${previous}, até 120).` };
    }
    if (st.channel && !CHANNELS.includes(st.channel)) return { error: `Canal inválido no passo ${n}.` };
    previous = st.day;
  }

  await prisma.$transaction([
    prisma.campaignStep.deleteMany({ where: { campaignId } }),
    prisma.campaignStep.createMany({
      data: [
        ...(first ? [{ campaignId, position: 0, day: 0, channel: null, text: first, notify: false }] : []),
        ...steps.map((st, i) => ({ campaignId, position: i + 1, day: st.day, channel: st.channel, text: st.text.trim(), notify: st.notify })),
      ],
    }),
  ]);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/cadence`);
  return {};
}
