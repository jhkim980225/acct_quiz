"use client";

import { useState } from "react";
import type { Question } from "@/models/question";

/** 문제 카드. 유형 페이지·퀴즈 공용.
 *  이론: 보기 클릭 → 즉시 채점. 실무: "정답 보기" 토글(answer_text).
 *  shuffled: 셔플된 보기와 재매핑된 정답(부모가 shuffleChoices로 만들어 전달). */
export default function QuestionCard({
  q,
  shuffled,
  onAnswer,
}: {
  q: Question;
  shuffled?: { choices: string[]; answerIdx: number };
  onAnswer?: (chosenIdx: number, isCorrect: boolean) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const choices = shuffled?.choices ?? q.choices;
  const answerIdx = shuffled?.answerIdx ?? q.answer_idx;
  const done = chosen !== null;

  function pick(i: number) {
    if (done || answerIdx === null) return;
    setChosen(i);
    onAnswer?.(i, i === answerIdx);
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap font-medium">{q.stem}</p>
        <span className="shrink-0 text-xs text-gray-500">{q.source}</span>
      </div>

      {choices && answerIdx !== null && (
        <ol className="space-y-1.5">
          {choices.map((c, i) => {
            let cls =
              "w-full text-left rounded border px-3 py-2 text-sm transition-colors ";
            if (!done) {
              cls += "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer";
            } else if (i === answerIdx) {
              cls += "border-green-500 bg-green-50 dark:bg-green-950";
            } else if (i === chosen) {
              cls += "border-red-500 bg-red-50 dark:bg-red-950";
            } else {
              cls += "border-gray-200 dark:border-gray-700 opacity-60";
            }
            return (
              <li key={i}>
                <button className={cls} onClick={() => pick(i)} disabled={done}>
                  {"①②③④"[i]} {c}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {q.answer_text && (
        <div>
          <button
            className="text-sm text-blue-600 dark:text-blue-400 underline"
            onClick={() => setShowAnswer((v) => !v)}
          >
            {showAnswer ? "정답 접기" : "정답 보기"}
          </button>
          {showAnswer && (
            <p className="mt-2 whitespace-pre-wrap rounded bg-gray-100 dark:bg-gray-800 p-3 text-sm">
              {q.answer_text}
            </p>
          )}
        </div>
      )}

      {(done || (showAnswer && q.answer_text)) && q.explanation && (
        <p className="whitespace-pre-wrap rounded bg-amber-50 dark:bg-amber-950 p-3 text-sm">
          <span className="font-semibold">해설</span> {q.explanation}
        </p>
      )}

      {done && (
        <p className={`text-sm font-semibold ${chosen === answerIdx ? "text-green-600" : "text-red-600"}`}>
          {chosen === answerIdx ? "정답!" : `오답 — 정답은 ${"①②③④"[answerIdx!]}`}
        </p>
      )}
    </div>
  );
}
