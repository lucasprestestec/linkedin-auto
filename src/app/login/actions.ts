"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, createUserToken } from "@/lib/auth";
import { fingerprint, verifyPassword } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";
import { hasIndividualAccess, startSession } from "@/lib/session";

export async function login(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (await hasIndividualAccess()) {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const user = email ? await prisma.panelUser.findUnique({ where: { email } }) : null;
    // Confere a senha mesmo sem achar a pessoa, para não revelar quais e-mails existem.
    const ok = verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !user.active || !ok) return { error: "E-mail ou senha incorretos." };
    await startSession(createUserToken(user.id, fingerprint(user.passwordHash)));
  } else {
    if (!checkPassword(password)) return { error: "Senha incorreta." };
    await startSession(createSessionToken());
  }

  redirect("/");
}
