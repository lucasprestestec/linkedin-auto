"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, createUserToken } from "@/lib/auth";
import { fingerprint, normalizeLogin, verifyPassword } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";
import { hasIndividualAccess, startSession } from "@/lib/session";

export async function login(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (await hasIndividualAccess()) {
    const login = normalizeLogin(String(formData.get("login") ?? ""));
    const user = login ? await prisma.panelUser.findUnique({ where: { login } }) : null;
    // Confere a senha mesmo sem achar a pessoa, para não revelar quais logins existem.
    const ok = verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !user.active || !ok) return { error: "Login ou senha incorretos." };
    await startSession(createUserToken(user.id, fingerprint(user.passwordHash)));
  } else {
    if (!checkPassword(password)) return { error: "Senha incorreta." };
    await startSession(createSessionToken());
  }

  redirect("/");
}
