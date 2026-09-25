import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Endereços antigos (antes da simplificação) continuam funcionando.
  async redirects() {
    return [
      { source: "/messages", destination: "/conversations", permanent: false },
      { source: "/stats", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
