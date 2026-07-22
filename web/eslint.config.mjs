import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 콘솔 출력 전면 금지 — 유저 이메일/uid 등 개인정보가 브라우저·서버 로그에
  // 남는 경로를 원천 차단. 디버깅 출력은 커밋 전에 지워야 lint 통과.
  {
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["tests/**"], // 테스트 하네스 리포트는 콘솔이 출력 수단
    rules: { "no-console": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
