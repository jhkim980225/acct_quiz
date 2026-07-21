import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "전산회계 기출 문제은행 — 유형별 4지선다 연습",
    template: "%s | 전산회계 문제은행",
  },
  description:
    "전산회계 1급·2급 기출문제를 유형별로 풀고 자동 채점. 분개·결산 실무 문제와 해설 제공.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-gray-200 dark:border-gray-800">
          <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
            <a href="/" className="font-bold">전산회계 문제은행</a>
            <a href="/quiz" className="text-sm text-blue-600 dark:text-blue-400">문제풀기</a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-gray-200 dark:border-gray-800 py-4 text-center text-xs text-gray-500">
          기출 출처: 한국세무사회 전산세무회계 자격시험
        </footer>
      </body>
    </html>
  );
}
