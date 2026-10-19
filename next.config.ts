import type { NextConfig } from "next";

// Este app é inteiro autenticado (cada página lê a sessão do usuário), então
// não usamos Cache Components: as páginas são dinâmicas por padrão.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
