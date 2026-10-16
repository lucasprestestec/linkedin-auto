import { redirect } from "next/navigation";

// "Importar planilha" agora é uma aba da área Contatos.
export default function ImportContactsPage() {
  redirect("/contacts?aba=planilha");
}
