"use client";

import { useEffect, useState } from "react";
import type { Question } from "@/models/question";
import ReportButton from "@/views/ReportButton";

const NUM = "①②③④";

/** 분개 텍스트 렌더: 날짜는 제 줄로, (차)…(대)… 는 세로 구분선 있는 2단으로. */
function JournalText({ text }: { text: string }) {
  return (
    <span className="block space-y-1">
      {text.split("\n").map((raw, i) => {
        let line = raw.trim();
        if (!line) return null;
        const dm = line.match(/^(\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\.?)\s*(.*)$/);
        const date = dm?.[1];
        if (dm) line = dm[2];
        const di = line.indexOf("(대)");
        const twoCol = line.includes("(차)") && di > 0;
        return (
          <span key={i} className="block">
            {date && (
              <span className="mb-0.5 block text-[12px] font-semibold text-muted">
                {date}
              </span>
            )}
            {twoCol ? (
              <span className="grid grid-cols-2">
                <span className="whitespace-pre-wrap break-words pr-3">
                  {line.slice(0, di).trim()}
                </span>
                <span className="whitespace-pre-wrap break-words border-l border-line pl-3">
                  {line.slice(di).trim()}
                </span>
              </span>
            ) : (
              line && <span className="block whitespace-pre-wrap break-words">{line}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** 문제 카드(토스 스타일). 유형 페이지·퀴즈 공용.
 *  이론: 보기 클릭 → 즉시 채점. 실무: "정답 보기" 토글(answer_text). */
export default function QuestionCard({
  q,
  shuffled,
  onAnswer,
  hotkeys = false,
  bare = false,
}: {
  q: Question;
  shuffled?: { choices: string[]; answerIdx: number };
  onAnswer?: (chosenIdx: number, isCorrect: boolean) => void;
  hotkeys?: boolean; // 퀴즈 모드: 1~4 키로 보기 선택
  bare?: boolean; // 아코디언 안에서 카드 스타일 없이 렌더
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

  useEffect(() => {
    if (!hotkeys || done) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !(e.target instanceof HTMLInputElement)) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, done]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={bare ? "p-5 sm:p-6" : "card p-5 sm:p-6"}>
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
          {/* 서식은 행 정렬 유지가 생명 — 줄바꿈 대신 가로 스크롤 */}
          <p className="overflow-x-auto whitespace-pre bg-surface px-4 py-3 text-[13px] leading-relaxed text-sub">
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
              "press w-full rounded-xl border px-4 py-3 text-left text-[14px] leading-snug break-words whitespace-pre-wrap ";
            if (isAnswer) cls += "pop border-green bg-green-soft font-bold text-green";
            else if (isWrongPick) cls += "shake border-red bg-red-soft font-bold text-red";
            else if (done) cls += "border-transparent bg-background text-muted";
            else cls += "border-transparent bg-background hover:bg-blue-soft cursor-pointer";
            return (
              <li key={i}>
                <button className={cls} onClick={() => pick(i)} disabled={done}>
                  <span className="mr-1.5 font-bold">{NUM[i]}</span>
                  {c.includes("(차)") ? <JournalText text={c} /> : c}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* 실무 정답 열람은 선택형(shuffled 제공) 아닐 때만 — 선택형은 보기로 채점 */}
      {q.answer_text && !shuffled && (
        <div className="mt-1">
          <button
            className="press rounded-xl bg-blue-soft px-4 py-2.5 text-[14px] font-bold text-blue"
            onClick={() => setShowAnswer((v) => !v)}
          >
            {showAnswer ? "정답 접기" : "정답 보기"}
          </button>
          {showAnswer && (
            <div className="pop mt-3 overflow-x-auto rounded-xl bg-background p-4 text-[13.5px] leading-relaxed">
              {q.answer_text.includes("(차)") ? (
                <JournalText text={q.answer_text} />
              ) : (
                <p className="whitespace-pre-wrap break-words">{q.answer_text}</p>
              )}
            </div>
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
