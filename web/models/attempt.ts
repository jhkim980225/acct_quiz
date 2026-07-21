import { supabase } from "@/lib/supabase";
import { loadLocal, type LocalAttempt } from "@/models/localAttempts";
import type { Question } from "@/models/question";

/** 로그인 유저 풀이 기록. RLS로 본인 행만. 실패는 조용히 무시(풀이 흐름 우선). */
export async function recordAttempt(
  userId: string,
  questionId: string,
  chosenIdx: number,
  isCorrect: boolean,
): Promise<void> {
  await supabase.from("attempts").insert({
    user_id: userId,
    question_id: questionId,
    chosen_idx: chosenIdx,
    is_correct: isCorrect,
  });
}

/** 오답노트: 문제별 최신 시도가 오답인 것만, 최신순. */
export async function getWrongQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("question_id, is_correct, created_at, questions(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const latest = new Map<string, { is_correct: boolean; q: Question }>();
  for (const a of data as unknown as {
    question_id: string;
    is_correct: boolean;
    questions: Question;
  }[]) {
    if (!latest.has(a.question_id))
      latest.set(a.question_id, { is_correct: a.is_correct, q: a.questions });
  }
  return [...latest.values()].filter((x) => !x.is_correct).map((x) => x.q);
}

/** 익명(localStorage) 기록을 attempts로 이관 후 비움. 로그인 직후 1회. */
export async function migrateLocalAttempts(userId: string): Promise<number> {
  const list: LocalAttempt[] = loadLocal();
  if (list.length === 0) return 0;
  const rows = list.map((a) => ({
    user_id: userId,
    question_id: a.question_id,
    chosen_idx: a.chosen_idx,
    is_correct: a.is_correct,
  }));
  const { error } = await supabase.from("attempts").insert(rows);
  if (!error) localStorage.removeItem("acct_quiz_attempts");
  return error ? 0 : rows.length;
}

/** 문제 신고(F8). 로그인 필요(RLS). */
export async function reportQuestion(
  userId: string,
  questionId: string,
  reason: string,
  memo?: string,
): Promise<boolean> {
  const { error } = await supabase.from("reports").insert({
    user_id: userId,
    question_id: questionId,
    reason,
    memo: memo ?? null,
  });
  return !error;
}
