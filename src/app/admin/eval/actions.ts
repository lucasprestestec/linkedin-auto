"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { conversationModel } from "@/lib/agent";
import { listNousModels, runScenario, type EvalResult, type ModelInfo } from "@/lib/agentEval/run";

export async function loadEvalSetup(): Promise<{ models: ModelInfo[]; current: string; error?: string }> {
  await requireAdmin();
  const current = await conversationModel();
  try {
    return { models: await listNousModels(), current };
  } catch (err) {
    return { models: [], current, error: err instanceof Error ? err.message : "Não foi possível listar os modelos." };
  }
}

export async function runEvalScenario(scenarioId: string, model: string, judgeModel: string | null): Promise<EvalResult> {
  await requireAdmin();
  return runScenario(scenarioId, model, judgeModel);
}

// Escolhe o modelo das conversas (null = volta pro NOUS_MODEL do ambiente).
export async function setAgentModel(model: string | null): Promise<{ current: string }> {
  await requireAdmin();
  await prisma.settings.update({ where: { id: "singleton" }, data: { agentModel: model?.trim() || null } });
  revalidatePath("/admin");
  return { current: await conversationModel() };
}
