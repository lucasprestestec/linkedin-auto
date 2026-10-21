import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Planilha de contatos vai como texto numa ação do servidor (o aviso da tela fala em 2 MB).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Cabeçalhos de segurança: ninguém embute o painel em outro site, e o navegador não "adivinha" tipos de arquivo.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Endereços antigos (antes da simplificação) continuam funcionando.
  async redirects() {
    return [
      { source: "/messages", destination: "/conversations", permanent: false },
      { source: "/stats", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
