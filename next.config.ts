import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3은 native addon이므로 서버 사이드에서만 사용.
  // webpack에서 번들링 대신 외부 모듈로 처리.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
