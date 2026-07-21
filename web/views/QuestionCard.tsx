"use client";

import { useState } from "react";
import type { Question } from "@/models/question";
import ReportButton from "@/views/ReportButton";

const NUM = "①②③④";

/** 문제 카드(토스 스타일). 유형 페이지·퀴즈 공용.
 *  이론: 보기 클릭 → 즉시 채점. 실무: "정답 보기" 토글(answer_text). */
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

  // 실무 문제: "[[서식]]" 마커 뒤는 어음·계산서 등 첨부 서식 → 박스로 구분 렌더
  const [stemMain, stemForm] = q.stem.split("\n[[서식]]\n");

  const choices = shuffled?.choices ?? q.choices;
  const answerIdx = shuffled?.answerIdx ?? q.answer_idx;
  const done = chosen !== null;
  const correct = done && chosen === answerIdx;

  function pick(i: number) {
    if (done || answerIdx === null) return;
    setChosen(i);
    onAnswer?.(i, i === answerIdx);
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed">
          {stemMain}
        </p>
        {q.source && (
          <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted">
            {q.source}
          </span>
        )}
      </div>

      {stemForm && (
        <div className="mb-4 overflow-hidden rounded-xl border border-line">
          <p className="border-b border-line bg-background px-4 py-2 text-[11px] font-bold tracking-wide text-muted">
            첨부 서식
          </p>
          <p className="whitespace-pre-wrap break-words bg-surface px-4 py-3 text-[13px] leading-relaxed text-sub">
            {stemForm}
          </p>
        </div>
      )}

      {choices && answerIdx !== null && (
        <ol className="space-y-2">
          {choices.map((c, i) => {
            const isAnswer = done && i === answerIdx;
            const isWrongPick = done && i === chosen && i !== answerIdx;
            let cls =
              "press w-full rounded-xl border px-4 py-3 text-left text-[14px] leading-snug break-words ";
            if (isAnswer) cls += "pop border-green bg-green-soft font-bold text-green";
            else if (isWrongPick) cls += "shake border-red bg-red-soft font-bold text-red";
            else if (done) cls += "border-transparent bg-background text-muted";
            else cls += "border-transparent bg-background hover:bg-blue-soft cursor-pointer";
            return (
              <li key={i}>
                <button className={cls} onClick={() => pick(i)} disabled={done}>
                  <span className="mr-1.5 font-bold">{NUM[i]}</span>
                  {c}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {q.answer_text && (
        <div className="mt-1">
          <button
            className="press rounded-xl bg-blue-soft px-4 py-2.5 text-[14px] font-bold text-blue"
            onClick={() => setShowAnswer((v) => !v)}
          >
            {showAnswer ? "정답 접기" : "정답 보기"}
          </button>
          {showAnswer && (
            <p className="pop mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-background p-4 text-[13.5px] leading-relaxed">
              {q.answer_text}
            </p>
          )}
        </div>
      )}

      {done && (
        <p
          className={`pop mt-4 text-[15px] font-bold ${correct ? "text-green" : "text-red"}`}
        >
          {correct ? "정답이에요 🎉" : `아쉬워요, 정답은 ${NUM[answerIdx!]}`}
        </p>
      )}

      {(done || (showAnswer && q.answer_text)) && q.explanation && (
        <div className="rise mt-3 rounded-xl bg-amber-soft p-4 text-[13.5px] leading-relaxed text-sub">
          <span className="mb-1 block font-bold text-foreground">해설</span>
          <span className="whitespace-pre-wrap break-words">{q.explanation}</span>
        </div>
      )}

      {(done || showAnswer) && (
        <div className="mt-3 flex justify-end">
          <ReportButton questionId={q.id} />
        </div>
      )}
    </div>
  );
}
