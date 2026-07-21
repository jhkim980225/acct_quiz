"use client";

import { useEffect, useState } from "react";
import { getQuizSet, type Question } from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import { recordLocal } from "@/models/localAttempts";
import QuestionCard from "@/views/QuestionCard";

type Item = { q: Question; shuffled: { choices: string[]; answerIdx: number } };

export default function QuizRunner({
  subject,
  typeTag,
}: {
  subject?: string;
  typeTag?: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    getQuizSet({ subject, typeTag, limit: 10 }).then((qs) =>
      setItems(
        qs.map((q) => ({
          q,
          shuffled: shuffleChoices(q.choices!, q.answer_idx!),
        })),
      ),
    );
  }, [subject, typeTag]);

  if (items === null) return <p className="text-gray-500">문제 불러오는 중…</p>;
  if (items.length === 0) return <p>해당 조건의 문제가 없습니다.</p>;

  const finished = idx >= items.length;
  if (finished)
    return (
      <div className="space-y-4 text-center">
        <p className="text-2xl font-bold">
          {items.length}문제 중 {correct}개 정답
        </p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => location.reload()}
        >
          다시 풀기
        </button>
      </div>
    );

  const item = items[idx];
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {idx + 1} / {items.length} · 정답 {correct}
      </p>
      <QuestionCard
        key={item.q.id}
        q={item.q}
        shuffled={item.shuffled}
        onAnswer={(chosenIdx, isCorrect) => {
          setAnswered(true);
          if (isCorrect) setCorrect((c) => c + 1);
          recordLocal({
            question_id: item.q.id,
            chosen_idx: chosenIdx,
            is_correct: isCorrect,
          });
        }}
      />
      {answered && (
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
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
