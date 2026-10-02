import { redirect } from "next/navigation";

// A tela Conversas agora é a tela principal. Endereços antigos (e links com ?status= ou ?q=) continuam funcionando.
export default async function ConversationsPage({ searchParams }: PageProps<"/conversations">) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["status", "q"] as const) {
    const v = params[key];
    if (typeof v === "string" && v) next.set(key, v);
  }
  redirect(next.size ? `/?${next.toString()}` : "/");
}
