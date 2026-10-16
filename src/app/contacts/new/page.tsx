import { redirect } from "next/navigation";

// "Adicionar contato" agora é a aba "Adicionar à mão" da área Contatos.
export default function NewContactPage() {
  redirect("/contacts?aba=mao");
}
