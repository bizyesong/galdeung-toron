import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** 폰·다른 기기에서 http://192.0.0.2:3000 등으로 접속할 때 dev 경고 완화 */
  allowedDevOrigins: ["192.0.0.2"],
  /** 상위 디렉터리의 lockfile이 있을 때 추적 루트를 이 프로젝트로 고정 (로컬·Vercel 빌드 일관성) */
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
