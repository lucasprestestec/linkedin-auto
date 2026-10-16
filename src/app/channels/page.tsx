import { redirect } from "next/navigation";

// Os canais agora ficam em Ajustes › Por onde o assistente fala. Links antigos (inclusive a volta do login do Google, ?email=) continuam valendo.
export default async function ChannelsPage({ searchParams }: PageProps<"/channels">) {
  const { email } = await searchParams;
  redirect(typeof email === "string" ? `/settings?email=${encodeURIComponent(email)}#email` : "/settings#canais");
}
