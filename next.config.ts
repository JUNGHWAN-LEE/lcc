import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3은 native addon이므로 서버 사이드에서만 사용.
  // webpack에서 번들링 대신 외부 모듈로 처리.
  serverExternalPackages: ["better-sqlite3"],
  // .next 빌드 폴더를 iCloud 경로 밖으로 빼서 동기화 간섭 방지
  distDir: `${process.env.HOME}/.next-builds/lcc`,
  // ~/package-lock.json 존재로 인해 Turbopack이 workspace root를 잘못 인식하는 문제 방지.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
