import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉토리의 stray package-lock.json 때문에 Turbopack이 워크스페이스 루트를
  // 잘못 추론하는 문제 방지 — 이 프로젝트 폴더로 고정
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
