import { prisma } from "@/lib/prisma";
import { parseWritingStyle, type WritingStyle } from "@/lib/writingStyle";

// Lê o "jeito de escrever" das configurações (só no servidor: writingStyle.ts é usado também nas telas).
export async function loadWritingStyle(): Promise<WritingStyle | null> {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { writingStyle: true } });
  return s?.writingStyle ? parseWritingStyle(s.writingStyle) : null;
}
