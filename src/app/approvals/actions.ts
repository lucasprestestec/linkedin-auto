"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { approveDraft, discardDraft, type ApproveResult } from "@/lib/outbox";

function refresh() {
  revalidatePath("/approvals");
  revalidatePath("/conversations");
  revalidatePath("/");
}

// Aprova (com o texto editado, se o corretor mudou). Fora do horário de
// trabalho a mensagem fica aprovada e sai quando a janela abrir.
export async function approve(id: string, content: string): Promise<ApproveResult> {
  const result = await approveDraft(id, content);
  refresh();
  return result;
}

export async function discard(id: string): Promise<{ error?: string }> {
  const result = await discardDraft(id);
  refresh();
  return result;
}

export async function setApprovalMode(on: boolean) {
  await prisma.settings.update({ where: { id: "singleton" }, data: { approvalMode: on } });
  refresh();
}
