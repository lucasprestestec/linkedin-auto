"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME } from "@/lib/auth";

export async function toggleAutomation() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { automationPaused: !settings.automationPaused },
  });
  revalidatePath("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
