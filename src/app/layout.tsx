import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import { cookies } from "next/headers";
import "./ds.css";
import { AppShell } from "@/components/AppShell";
import { COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
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
  const authed = isValidSessionToken((await cookies()).get(COOKIE_NAME)?.value);
  const shell = authed ? await getShellData() : null;

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
