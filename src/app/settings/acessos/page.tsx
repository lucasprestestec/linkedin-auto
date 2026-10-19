import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { OWNER_LOGINS } from "@/lib/panelUsers";
import { UserForm } from "./UserForm";
import { UserActions } from "./UserActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Quem entra no painel, cada um com o próprio e-mail e a própria senha.
export default async function AccessPage() {
  if (!(await getSession())) redirect("/login");
  // O acesso do suporte não aparece para a equipe do cliente.
  const users = (await prisma.panelUser.findMany({ orderBy: { createdAt: "asc" } })).filter((u) => !OWNER_LOGINS.includes(u.login));
  const withPassword = users.filter((u) => u.passwordHash).length;

  return (
    <main className="page">
      <Link href="/settings" className="btn-text" style={{ alignSelf: "flex-start" }}>
        ← Ajustes
      </Link>
      <header className="p-head">
        <div>
          <h1 className="t-title">Acessos ao painel</h1>
          <p className="t-sub">
            {withPassword === 0
              ? "Hoje todos entram com a senha única. Quando a primeira pessoa escolher a própria senha, a senha única deixa de valer."
              : "A senha única já não vale: cada pessoa entra com o próprio login e a própria senha."}
          </p>
        </div>
      </header>

      {users.length > 0 && (
        <ul className="list">
          {users.map((u) => (
            <li key={u.id}>
              <div className="item">
                <div className="item-main">
                  <span className="item-title">
                    {u.name} · {u.active ? (u.passwordHash ? "Com acesso" : "Aguardando escolher a senha") : "Desativada"}
                  </span>
                  <span className="item-sub">login: {u.login}</span>
                </div>
                <UserActions id={u.id} active={u.active} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="sec">
        <UserForm />
        <p className="hint" style={{ margin: 0 }}>
          Depois de cadastrar, gere o link de senha e envie à pessoa. Ela abre o link e escolhe a senha: você nunca vê nem digita a senha de ninguém. Quem esqueceu a senha usa o mesmo caminho: novo link. O login é o nome de entrada (ex.: maria), sem acento.
        </p>
      </section>
    </main>
  );
}
