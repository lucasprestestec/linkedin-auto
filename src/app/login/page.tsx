import { hasIndividualAccess } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <LoginForm individual={await hasIndividualAccess()} />;
}
