"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyStats, type MyStats } from "@/models/stats";

/** 우측 레일: 나의 학습 현황 + 오답 많은 카테고리 TOP 5. 익명은 localStorage 기준. */
export default function MyStatsCard({ globalAvg }: { globalAvg: number | null }) {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    getMyStats()
      .then(setStats)
      .catch(() => setStats({ solved: 0, wrong: 0, pctCorrect: null, topWrongTags: [] }));
  }, []);

  return (
    <>
      <section className="card rise space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">나의 학습 현황</h2>
          <span className="text-[11px] text-muted">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}{" "}
            기준
          </span>
        </div>
        {stats === null ? (
          <p className="py-4 text-center text-[13px] text-muted">불러오는 중…</p>
        ) : stats.solved === 0 ? (
          <div className="space-y-2 py-2 text-center">
            <p className="text-[13.5px] text-sub">아직 푼 문제가 없어요</p>
            <Link
              href="/quiz"
              className="press inline-block rounded-lg bg-blue px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-dark"
            >
              첫 문제 풀러 가기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "📄", label: "푼 문제", value: `${stats.solved}` },
              { icon: "❌", label: "틀린 문제", value: `${stats.wrong}` },
              { icon: "✅", label: "정답률", value: `${stats.pctCorrect ?? 0}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-background p-3 text-center">
                <p aria-hidden className="text-[15px]">{s.icon}</p>
                <p className="mt-1 text-lg font-bold tracking-tight">{s.value}</p>
                <p className="text-[11.5px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        {globalAvg !== null && (
          <p className="border-t border-line pt-3 text-[12.5px] font-semibold text-blue">
            📊 전체 평균 정답률 {globalAvg}%
          </p>
        )}
      </section>

      {stats && stats.topWrongTags.length > 0 && (
        <section className="card rise space-y-3 p-5">
          <h2 className="text-[15px] font-bold">오답 많은 카테고리 TOP {stats.topWrongTags.length}</h2>
          <ul className="space-y-2.5">
            {stats.topWrongTags.map((t) => (
              <li key={t.type_tag}>
                <Link href={`/quiz?type_tag=${encodeURIComponent(t.type_tag)}`} className="group block">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold group-hover:text-blue">{t.type_tag}</span>
                    <span className="font-bold text-red">{t.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-blue"
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/wrong"
            className="block pt-1 text-[12.5px] font-bold text-blue hover:underline"
          >
            전체 오답 보기 →
          </Link>
        </section>
      )}
    </>
  );
}
