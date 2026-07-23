"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  getQuizSet,
  getQuestionsByIds,
  type Question,
} from "@/models/question";
import { fetchWrongStats, MIN_ATTEMPTS } from "@/models/stats";
import { getPracticeSet, type PracticeCategory } from "@/models/practice";
import { shuffleChoices } from "@/models/shuffle";
import { recordLocal } from "@/models/localAttempts";
import { getSessionUser } from "@/models/auth";
import { getWrongQuestions, recordAttempt } from "@/models/attempt";
import QuestionCard from "@/views/QuestionCard";

type Item = { q: Question; shuffled: { choices: string[]; answerIdx: number } };

export default function QuizRunner({
  subject,
  typeTag,
  area,
  mode,
  practice,
}: {
  subject?: string;
  typeTag?: string;
  area?: string;
  mode?: string;
  practice?: string; // "실무분개" | "결산" — 실무 4지선다(합성 보기) 모드
}) {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wrongTags, setWrongTags] = useState<Set<string>>(new Set());
  const [count, setCount] = useState<string>("10"); // "3"~"15" | "random"

  const load = useCallback(async () => {
    setItems(null);
    setFailed(false);
    setIdx(0);
    setCorrect(0);
    setAnswered(false);
    setWrongTags(new Set());
    try {
      const u = await getSessionUser();
      setUser(u);
      // 실무 분개·결산: 합성 4지선다 세트
      if (practice && subject) {
        const limit =
          count === "random" ? 3 + Math.floor(Math.random() * 13) : Number(count);
        const set = await getPracticeSet({
          subject,
          category: practice as PracticeCategory,
          typeTag,
          limit,
        });
        setItems(set);
        return;
      }
      let qs: Question[];
      if (mode === "wrong") {
        if (!u) return setNeedLogin(true);
        // 오답 다시풀기(F7): 4지선다만 (분개·결산은 오답노트에서 열람)
        const wrong = await getWrongQuestions();
        qs = await getQuestionsByIds(wrong.map((q) => q.id));
      } else {
        const limit =
          count === "random"
            ? 3 + Math.floor(Math.random() * 13) // 3~15 랜덤
            : Number(count);
        if (mode === "hard") {
          // 오답률 높은 문제(전 유저 통계) 순. 표본 없으면 랜덤 폴백
          const stats = (await fetchWrongStats())
            .filter((s) => s.attempts >= MIN_ATTEMPTS && s.wrong_pct > 0)
            .sort((a, b) => b.wrong_pct - a.wrong_pct)
            .slice(0, limit);
          const rank = new Map(stats.map((s, i) => [s.question_id, i]));
          const hard = (await getQuestionsByIds(stats.map((s) => s.question_id))).sort(
            (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
          );
          qs = hard.length > 0 ? hard : await getQuizSet({ limit });
        } else {
          qs = await getQuizSet({ subject, typeTag, area, limit });
        }
      }
      setItems(
        qs.map((q) => ({
          q,
          shuffled: shuffleChoices(q.choices!, q.answer_idx!),
        })),
      );
    } catch {
      setFailed(true);
    }
  }, [subject, typeTag, area, mode, practice, count]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 데이터 fetch
    load();
  }, [load]);

  // Enter → 다음 문제
  useEffect(() => {
    if (!answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        setIdx((i) => i + 1);
        setAnswered(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered]);

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

  if (failed)
    return (
      <div className="card space-y-4 p-10 text-center">
        <p className="font-bold">문제를 불러오지 못했어요</p>
        <p className="text-[14px] text-sub">네트워크 상태를 확인하고 다시 시도해주세요.</p>
        <button
          onClick={load}
          className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
        >
          다시 시도
        </button>
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

        {wrongTags.size > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted">틀린 유형 복습하기</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[...wrongTags].map((tag) => (
                <Link
                  key={tag}
                  href={`/quiz?type_tag=${encodeURIComponent(tag)}`}
                  className="press rounded-full bg-red-soft px-4 py-2 text-[13px] font-bold text-red"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
          <button
            className="press rounded-xl bg-blue px-4 py-3.5 font-bold text-white hover:bg-blue-dark"
            onClick={load}
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
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-blue transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[13px] font-bold text-muted">
          {idx + 1}/{items.length}
        </span>
        {mode !== "wrong" && (
          <select
            aria-label="문제 수"
            value={count}
            onChange={(e) => setCount(e.target.value)} // 변경 시 새 세트로 재시작
            className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px] font-semibold text-sub outline-none focus:border-blue"
          >
            {Array.from({ length: 13 }, (_, i) => i + 3).map((n) => (
              <option key={n} value={n}>
                {n}문제
              </option>
            ))}
            <option value="random">랜덤</option>
          </select>
        )}
      </div>

      <div key={item.q.id} className="rise">
        <QuestionCard
          q={item.q}
          shuffled={item.shuffled}
          hotkeys
          onAnswer={(chosenIdx, isCorrect) => {
            setAnswered(true);
            if (isCorrect) setCorrect((c) => c + 1);
            else setWrongTags((s) => new Set(s).add(item.q.type_tag));
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
          다음 문제 <span className="ml-1 text-[12px] font-medium opacity-70">Enter</span>
        </button>
      )}
    </div>
  );
}
