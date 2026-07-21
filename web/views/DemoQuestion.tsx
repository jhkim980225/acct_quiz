"use client";

import { useState } from "react";
import Link from "next/link";
import type { Question } from "@/models/question";
import QuestionCard from "@/views/QuestionCard";

/** 랜딩 히어로의 라이브 데모 문제. 풀면 바로 채점되고 CTA가 등장한다. */
export default function DemoQuestion({
  q,
  shuffled,
  total,
}: {
  q: Question;
  shuffled: { choices: string[]; answerIdx: number };
  total: number;
}) {
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue" />
        </span>
        <p className="text-[12px] font-bold tracking-wide text-blue">
          지금 바로 한 문제 — 회원가입 없이
        </p>
      </div>

      <QuestionCard q={q} shuffled={shuffled} onAnswer={() => setDone(true)} />

      {done && (
        <Link
          href="/quiz"
          className="press pop block rounded-xl bg-blue px-4 py-3.5 text-center font-bold text-white hover:bg-blue-dark"
        >
          방금처럼 {total.toLocaleString()}문제 계속 풀기 →
        </Link>
      )}
    </div>
  );
}
