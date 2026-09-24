import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "./theme.css";
import { AppShell } from "@/components/AppShell";
import { COOKIE_NAME, isValidSessionToken } from "@/lib/auth";
import { getShellData } from "@/lib/shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Títulos: Archivo condensada e pesada (eixo de largura), como nos mockups.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LinkedIn Leads",
  description: "Conversas e leads do LinkedIn",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Leads",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a16" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Os dados do menu (nome, notificações) só vão pra quem está logado.
  const authed = isValidSessionToken((await cookies()).get(COOKIE_NAME)?.value);
  const shell = authed ? await getShellData() : null;

  return (
    <html lang="pt-BR" className={`${inter.variable} ${archivo.variable}`}>
      <body>
        <AppShell data={shell}>{children}</AppShell>
      </body>
    </html>
  );
}
