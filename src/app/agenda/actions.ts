"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { createBlock, deleteBlock } from "@/lib/gcalendar";
import { minutesOfDay } from "@/lib/slots";

const HOUR_MS = 60 * 60 * 1000;
// Até onde dá para bloquear: o assistente só oferece horários nos próximos 10 dias.
const MAX_AHEAD_MS = 14 * 24 * HOUR_MS;

// Bloqueia (ou libera) uma hora cheia nos horários que o assistente oferece.
// Bloquear cria um evento "ocupado" no Google; liberar apaga esse evento (só se for um bloqueio nosso).
export async function toggleHourBlock(startIso: string, blockId: string | null): Promise<{ error?: string }> {
  await requireSession();
  try {
    if (blockId) {
      await deleteBlock(blockId);
    } else {
      const start = new Date(startIso);
      const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { workStartHour: true, workEndHour: true } });
      const min = minutesOfDay(start);
      const now = Date.now();
      if (Number.isNaN(start.getTime()) || start.getMinutes() !== 0 || start.getTime() < now || start.getTime() > now + MAX_AHEAD_MS) return { error: "Horário inválido." };
      if (min < settings.workStartHour * 60 || min >= settings.workEndHour * 60) return { error: "Esse horário está fora do seu expediente." };
      await createBlock(start, new Date(start.getTime() + HOUR_MS));
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível mudar este horário." };
  }
  revalidatePath("/agenda");
  return {};
}
