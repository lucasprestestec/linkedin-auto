"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, createUserToken } from "@/lib/auth";
import { fingerprint, normalizeLogin, verifyPassword } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";
import { hasIndividualAccess, startSession } from "@/lib/session";
import { headers } from "next/headers";
import { loginBlocked, loginFailed, loginSucceeded } from "@/lib/loginLimit";

export async function login(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const key = `${normalizeLogin(String(formData.get("login") ?? ""))}|${ip}`;
  if (loginBlocked(key)) return { error: "Muitas tentativas. Espere 15 minutos e tente de novo." };

  if (await hasIndividualAccess()) {
    const login = normalizeLogin(String(formData.get("login") ?? ""));
    const user = login ? await prisma.panelUser.findUnique({ where: { login } }) : null;
    // Confere a senha mesmo sem achar a pessoa, para não revelar quais logins existem.
    const ok = verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !user.active || !ok) {
      loginFailed(key);
      return { error: "Login ou senha incorretos." };
    }
    await startSession(createUserToken(user.id, fingerprint(user.passwordHash)));
  } else {
    if (!checkPassword(password)) {
      loginFailed(key);
      return { error: "Senha incorreta." };
    }
    await startSession(createSessionToken());
  }

  loginSucceeded(key);
  redirect("/");
}
