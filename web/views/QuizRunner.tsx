"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  getQuizSet,
  getQuestionsByIds,
  type Question,
} from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import { recordLocal } from "@/models/localAttempts";
import { getSessionUser } from "@/models/auth";
import { getWrongQuestions, recordAttempt } from "@/models/attempt";
import QuestionCard from "@/views/QuestionCard";

type Item = { q: Question; shuffled: { choices: string[]; answerIdx: number } };

export default function QuizRunner({
  subject,
  typeTag,
  mode,
}: {
  subject?: string;
  typeTag?: string;
  mode?: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getSessionUser();
      setUser(u);
      let qs: Question[];
      if (mode === "wrong") {
        if (!u) return setNeedLogin(true);
        // 오답 다시풀기(F7): 4지선다만 (분개·결산은 오답노트에서 열람)
        const wrong = await getWrongQuestions();
        qs = await getQuestionsByIds(wrong.map((q) => q.id));
      } else {
        qs = await getQuizSet({ subject, typeTag, limit: 10 });
      }
      setItems(
        qs.map((q) => ({
          q,
          shuffled: shuffleChoices(q.choices!, q.answer_idx!),
        })),
      );
    })();
  }, [subject, typeTag, mode]);

  if (needLogin)
    return (
      <div className="card space-y-4 p-10 text-center">
        <p className="font-bold">오답 다시풀기는 로그인이 필요해요</p>
        <Link
          href="/wrong"
          className="press inline-block rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
        >
          로그인하러 가기
        </Link>
      </div>
    );

  if (items === null)
    return (
      <div className="card flex items-center justify-center p-12 text-muted">
        문제 불러오는 중…
      </div>
    );
  if (items.length === 0)
    return (
      <div className="card p-12 text-center text-sub">
        {mode === "wrong" ? "다시 풀 오답이 없어요 🎉" : "해당 조건의 문제가 없어요."}
      </div>
    );

  const finished = idx >= items.length;
  if (finished) {
    const pct = Math.round((correct / items.length) * 100);
    return (
      <div className="card rise space-y-6 p-8 text-center">
        <p className="text-[15px] font-semibold text-muted">오늘의 결과</p>
        <p className="text-5xl font-bold tracking-tight">
          {correct}
          <span className="text-2xl text-muted"> / {items.length}</span>
        </p>
        <div className="mx-auto h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-background">
          <div
            className="fillbar h-full rounded-full bg-blue"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[15px] text-sub">
          {pct === 100
            ? "완벽해요! 다음 유형으로 넘어가세요 🎉"
            : pct >= 60
              ? "좋아요, 틀린 문제만 다시 보면 합격권이에요"
              : "기초 유형부터 차근차근 다시 풀어봐요"}
        </p>
        <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
          <button
            className="press rounded-xl bg-blue px-4 py-3.5 font-bold text-white hover:bg-blue-dark"
            onClick={() => location.reload()}
          >
            다시 풀기
          </button>
          {!user && correct < items.length && (
            <Link
              href="/wrong"
              className="press rounded-xl bg-blue-soft px-4 py-3.5 font-bold text-blue"
            >
              로그인하고 오답 저장하기
            </Link>
          )}
          {user && (
            <Link
              href="/wrong"
              className="press rounded-xl bg-blue-soft px-4 py-3.5 font-bold text-blue"
            >
              오답노트 보기
            </Link>
          )}
        </div>
      </div>
    );
  }

  const item = items[idx];
  const progress = (idx / items.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-blue transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[13px] font-bold text-muted">
          {idx + 1}/{items.length}
        </span>
      </div>

      <div key={item.q.id} className="rise">
        <QuestionCard
          q={item.q}
          shuffled={item.shuffled}
          onAnswer={(chosenIdx, isCorrect) => {
            setAnswered(true);
            if (isCorrect) setCorrect((c) => c + 1);
            if (user) {
              recordAttempt(user.id, item.q.id, chosenIdx, isCorrect);
            } else {
              recordLocal({
                question_id: item.q.id,
                chosen_idx: chosenIdx,
                is_correct: isCorrect,
              });
            }
          }}
        />
      </div>

      {answered && (
        <button
          className="press rise w-full rounded-xl bg-blue px-4 py-3.5 font-bold text-white hover:bg-blue-dark"
          onClick={() => {
            setIdx((i) => i + 1);
            setAnswered(false);
          }}
        >
          다음 문제
        </button>
      )}
    </div>
  );
}
