"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Question } from "@/models/question";
import { getSessionUser, onAuthChange, signOut } from "@/models/auth";
import { getWrongQuestions, migrateLocalAttempts } from "@/models/attempt";
import { shuffleChoices } from "@/models/shuffle";
import LoginCard from "@/views/LoginCard";
import QuestionCard from "@/views/QuestionCard";

/** 오답노트(F6). 로그인 필요. 로그인 시 localStorage 기록 자동 이관. */
export default function WrongPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [items, setItems] = useState<Question[] | null>(null);
  const [migrated, setMigrated] = useState(0);

  useEffect(() => {
    getSessionUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const n = await migrateLocalAttempts(user.id);
      setMigrated(n);
      setItems(await getWrongQuestions());
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined)
    return <div className="card p-12 text-center text-muted">확인 중…</div>;

  if (user === null)
    return (
      <div className="space-y-5">
        <h1 className="rise text-2xl font-bold tracking-tight">오답노트</h1>
        <LoginCard />
      </div>
    );

  return (
    <div className="space-y-5">
      <header className="rise flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">오답노트</h1>
          <p className="mt-1 text-[13px] text-muted">
            {user.email} ·{" "}
            <button onClick={() => signOut()} className="underline">
              로그아웃
            </button>
          </p>
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

      {items === null ? (
        <div className="card p-12 text-center text-muted">불러오는 중…</div>
      ) : items.length === 0 ? (
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
        <div className="space-y-4">
          {items.map((q, i) => (
            <div key={q.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <QuestionCard
                q={q}
                shuffled={
                  q.choices && q.answer_idx !== null
                    ? shuffleChoices(q.choices, q.answer_idx)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
