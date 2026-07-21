import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/views/AppShell";
import { listSubjectTags } from "@/models/question";

export const metadata: Metadata = {
  title: {
    default: "전산회계 기출 문제은행 — 유형별 4지선다 연습",
    template: "%s | 전산회계 문제은행",
  },
  description:
    "전산회계 1급·2급 기출문제를 유형별로 풀고 자동 채점. 분개·결산 실무 문제와 해설 제공.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nav = await listSubjectTags();
  return (
    <html lang="ko">
      <body>
        <AppShell nav={nav}>{children}</AppShell>
      </body>
    </html>
  );
}
