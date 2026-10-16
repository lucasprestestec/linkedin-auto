import { redirect } from "next/navigation";

// As mensagens para aprovar agora ficam na tela Hoje ("Aguardando você"); a chave de aprovação e a revisão de
// campanha nova, em Assistente › O que passa por você. Links antigos (inclusive dos avisos no celular) vão para Hoje.
export default function ApprovalsPage() {
  redirect("/");
}
