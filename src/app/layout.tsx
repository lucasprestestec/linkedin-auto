import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "./ds.css";
import { AppShell } from "@/components/AppShell";
import { COOKIE_NAME } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { getShellData } from "@/lib/shell";
import { PREFS_SCRIPT } from "@/lib/prefs";

// Uma fonte só em todo o sistema.
const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
  display: "swap",
});

const body = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Central Dors",
  description: "Conversas, acompanhamento e reuniões com seus contatos, por LinkedIn, e-mail e WhatsApp.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Central Dors",
  },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f6fa" }, { media: "(prefers-color-scheme: dark)", color: "#0e1016" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Os dados do menu (nome, notificações) só vão pra quem está logado.
  const session = await getSession();
  // Cookie assinado, mas a pessoa foi desativada (ou trocou a senha): volta ao login.
  const path = (await headers()).get("x-path") ?? "";
  const open = path === "/login" || path.startsWith("/convite/") || ["/sobre", "/privacidade", "/termos"].includes(path);
  if (!session && !open && path && (await cookies()).get(COOKIE_NAME)) redirect("/login");
  const base = session ? await getShellData() : null;
  const shell = base && session?.kind === "user" ? { ...base, ownerName: session.user.name } : base;

  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <AppShell data={shell}>{children}</AppShell>
      </body>
    </html>
  );
}
