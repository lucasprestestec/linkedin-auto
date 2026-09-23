import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("Settings inicial criada (automação pausada por padrão).");
}

main().finally(() => prisma.$disconnect());
