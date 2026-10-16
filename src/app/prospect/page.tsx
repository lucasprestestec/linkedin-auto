import { redirect } from "next/navigation";

// Prospectar agora é a aba "Buscar no LinkedIn" da área Contatos. Links antigos (inclusive com ?campaign=) continuam valendo.
export default async function ProspectPage({ searchParams }: PageProps<"/prospect">) {
  const { campaign } = await searchParams;
  redirect(typeof campaign === "string" && campaign ? `/contacts?campaign=${encodeURIComponent(campaign)}` : "/contacts");
}
