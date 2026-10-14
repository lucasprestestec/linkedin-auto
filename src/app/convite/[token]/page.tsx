import type { Metadata } from "next";
import { MIN_PASSWORD, fingerprint, readInviteToken } from "@/lib/panelUsers";
import { prisma } from "@/lib/prisma";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = readInviteToken(token);
  const user = invite ? await prisma.panelUser.findUnique({ where: { id: invite.userId } }) : null;
  if (!invite || !user || !user.active || fingerprint(user.passwordHash) !== invite.fp) {
    return (
      <main className="solo">
        <div className="solo-form">
          <h1 className="t-title">Link vencido</h1>
          <p className="t-sub">Este link já foi usado ou passou do prazo. Peça um novo a quem cuida do sistema.</p>
        </div>
      </main>
    );
  }
  return <InviteForm token={token} name={user.name} min={MIN_PASSWORD} />;
}
