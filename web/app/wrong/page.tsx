"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Question } from "@/models/question";
import { getSessionUser, onAuthChange } from "@/models/auth";
import {
  getWrongQuestions,
  getRecentAttempts,
  migrateLocalAttempts,
  type WrongEntry,
  type AttemptEntry,
} from "@/models/attempt";
import { shuffleChoices } from "@/models/shuffle";
import LoginCard from "@/views/LoginCard";
import QuestionCard from "@/views/QuestionCard";

/** "2026.07.23. 14:05" 형태 */
function fmt(at: string): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 접힌 풀이 행: 일시·뱃지·문제 첫 줄, 펼치면 문제 카드. */
function AttemptRow({
  q,
  at,
  badge,
  delay,
}: {
  q: Question;
  at: string;
  badge?: "정답" | "오답";
  delay: number;
}) {
  return (
    <details
      className="card rise group overflow-hidden"
      style={{ animationDelay: `${Math.min(delay, 8) * 40}ms` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted">
          {fmt(at)}
        </span>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              badge === "정답" ? "bg-green-soft text-green" : "bg-red-soft text-red"
            }`}
          >
            {badge}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          {q.stem.split("\n")[0]}
        </span>
        <span className="hidden shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">
          {q.type_tag}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-line">
        <QuestionCard
          bare
          q={q}
          shuffled={
            q.choices && q.answer_idx !== null
              ? shuffleChoices(q.choices, q.answer_idx, q.id)
              : undefined
          }
        />
      </div>
    </details>
  );
}

/** 오답노트(F6). 로그인 필요. 오답 목록(틀린 일시) + 최근 풀이 기록 타임라인. */
export default function WrongPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [items, setItems] = useState<WrongEntry[] | null>(null);
  const [recent, setRecent] = useState<AttemptEntry[]>([]);
  const [migrated, setMigrated] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getSessionUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setFailed(false);
        const n = await migrateLocalAttempts(user.id);
        setMigrated(n);
        const [wrong, rec] = await Promise.all([getWrongQuestions(), getRecentAttempts()]);
        setItems(wrong);
        setRecent(rec);
      } catch {
        setFailed(true);
      }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined)
    return <div className="card mx-auto max-w-2xl p-12 text-center text-muted">확인 중…</div>;

  if (user === null)
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="rise text-2xl font-bold tracking-tight">오답노트</h1>
        <LoginCard />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="rise flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">오답노트</h1>
          <p className="mt-1 text-[13px] text-muted">{user.email}</p>
        </div>
        {items && items.length > 0 && (
          <Link
            href="/quiz?mode=wrong"
            className="press rounded-xl bg-blue px-4 py-2.5 text-[14px] font-bold text-white hover:bg-blue-dark"
          >
            다시 풀기
          </Link>
        )}
      </header>

      {migrated > 0 && (
        <p className="pop rounded-xl bg-blue-soft p-3 text-[13px] font-semibold text-blue">
          이 기기의 익명 풀이 기록 {migrated}건을 가져왔어요.
        </p>
      )}

      {failed ? (
        <div className="card space-y-3 p-10 text-center">
          <p className="font-bold">오답노트를 불러오지 못했어요</p>
          <button
            onClick={() => location.reload()}
            className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
          >
            다시 시도
          </button>
        </div>
      ) : items === null ? (
        <div className="card p-12 text-center text-muted">불러오는 중…</div>
      ) : (
        <>
          {items.length === 0 ? (
            <div className="card space-y-3 p-10 text-center">
              <p className="text-lg font-bold">틀린 문제가 없어요 🎉</p>
              <p className="text-[14px] text-sub">
                문제를 풀다 틀리면 여기에 자동으로 모여요.
              </p>
              <Link
                href="/quiz"
                className="press inline-block rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
              >
                문제 풀러 가기
              </Link>
            </div>
          ) : (
            <section className="space-y-3">
              <h2 className="px-1 text-[15px] font-bold">
                틀린 문제{" "}
                <span className="text-[12px] font-semibold text-muted">
                  {items.length}건 · 틀린 일시 기준
                </span>
              </h2>
              {items.map((w, i) => (
                <AttemptRow key={w.q.id} q={w.q} at={w.at} badge="오답" delay={i} />
              ))}
            </section>
          )}

          {recent.length > 0 && (
            <section className="space-y-3">
              <h2 className="px-1 pt-2 text-[15px] font-bold">
                최근 풀이 기록{" "}
                <span className="text-[12px] font-semibold text-muted">
                  최근 {recent.length}건
                </span>
              </h2>
              {recent.map((a, i) => (
                <AttemptRow
                  key={`${a.q.id}-${a.at}`}
                  q={a.q}
                  at={a.at}
                  badge={a.is_correct ? "정답" : "오답"}
                  delay={i}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
