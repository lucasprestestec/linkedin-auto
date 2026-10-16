import { redirect } from "next/navigation";

// A escolha e a gravação da voz agora ficam na área Assistente.
export default function VoicePage() {
  redirect("/assistente#voz");
}
