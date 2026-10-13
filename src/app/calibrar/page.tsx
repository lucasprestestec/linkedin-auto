import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MobileHeader } from "@/components/MobileHeader";
import { parseWritingStyle } from "@/lib/writingStyle";
import { CalibrationWizard } from "./CalibrationWizard";

export const dynamic = "force-dynamic";

export default async function CalibratePage() {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" }, select: { writingStyle: true } });
  const style = parseWritingStyle(settings.writingStyle);

  return (
    <main className="page">
      <MobileHeader />
      <header className="p-head">
        <div>
          <h1 className="t-title">Calibrar o assistente</h1>
          <p className="t-sub">Ensine o assistente a escrever do seu jeito.</p>
        </div>
        <Link href="/settings#jeito" className="btn-text">
          Sair
        </Link>
      </header>
      <section className="sec">
        <CalibrationWizard initial={style} />
      </section>
    </main>
  );
}
