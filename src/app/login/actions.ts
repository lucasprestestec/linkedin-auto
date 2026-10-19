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
  // Com acesso individual a chave inclui o login; com senha única, só o aparelho (o campo login seria um atalho).
  const individual = await hasIndividualAccess();
  const key = individual ? `${normalizeLogin(String(formData.get("login") ?? ""))}|${ip}` : `unica|${ip}`;
  if (loginBlocked(key)) return { error: "Muitas tentativas. Espere 15 minutos e tente de novo." };

  if (individual) {
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
