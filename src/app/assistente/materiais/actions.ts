"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { MAX_MATERIALS, MAX_TOTAL_BYTES, checkFile, newMaterialToken, parseLink } from "@/lib/materials";

const text = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;

// Acrescenta um material: arquivo enviado ou link externo.
export async function addMaterial(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  await requireSession();
  const title = text(formData.get("title"), 80);
  if (!title) return { error: "Dê um nome ao material (é o que você vai ver na hora de enviar)." };
  const whenToUse = text(formData.get("whenToUse"), 200);
  if ((await prisma.material.count()) >= MAX_MATERIALS) return { error: `A biblioteca aceita até ${MAX_MATERIALS} materiais. Apague algum que não usa mais.` };

  const file = formData.get("file");
  const rawLink = text(formData.get("link"), 500);
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkFile(file.name, bytes);
    if (!check.ok) return { error: check.error };
    const used = await prisma.material.aggregate({ _sum: { size: true } });
    if ((used._sum.size ?? 0) + bytes.length > MAX_TOTAL_BYTES) return { error: "A biblioteca encheu. Apague arquivos que não usa mais ou use links (Drive, site)." };
    await prisma.material.create({
      data: { title, whenToUse, kind: "FILE", fileName: check.fileName, mimeType: check.mime, size: bytes.length, data: bytes, token: newMaterialToken() },
    });
  } else if (rawLink) {
    const url = parseLink(rawLink);
    if (!url) return { error: "Esse link não parece válido. Cole o endereço completo (começa com https://)." };
    await prisma.material.create({ data: { title, whenToUse, kind: "LINK", url, token: newMaterialToken() } });
  } else {
    return { error: "Envie um arquivo ou cole um link." };
  }
  revalidatePath("/assistente/materiais");
  return { ok: "Material guardado." };
}

export async function saveMaterial(id: string, title: string, whenToUse: string) {
  await requireSession();
  const t = title.trim().slice(0, 80);
  if (!t) return { error: "O nome não pode ficar vazio." };
  await prisma.material.update({ where: { id }, data: { title: t, whenToUse: whenToUse.trim().slice(0, 200) || null } });
  revalidatePath("/assistente/materiais");
  return { ok: true };
}

// Desligado: o endereço já enviado deixa de abrir e o material some do seletor.
export async function setMaterialActive(id: string, active: boolean) {
  await requireSession();
  await prisma.material.update({ where: { id }, data: { active } });
  revalidatePath("/assistente/materiais");
  return { ok: true };
}

export async function deleteMaterial(id: string) {
  await requireSession();
  await prisma.material.deleteMany({ where: { id } });
  revalidatePath("/assistente/materiais");
  return { ok: true };
}
