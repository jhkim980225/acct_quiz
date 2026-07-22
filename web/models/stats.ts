import { supabase } from "@/lib/supabase";
import { loadLocal } from "@/models/localAttempts";
import { getSessionUser } from "@/models/auth";

/** 오답률 노출 최소 표본. 이보다 적으면 % 숨김(1~2건으로 100% 뜨는 노이즈 방지). */
export const MIN_ATTEMPTS = 3;

export type WrongStat = { question_id: string; attempts: number; wrong_pct: number };

/** 문제별 전체 오답률(question_wrong_stats 뷰). 뷰 미생성·무데이터면 빈 배열 → 기능 자동 숨김. */
export async function listWrongStats(): Promise<WrongStat[]> {
  try {
    const { data, error } = await supabase
      .from("question_wrong_stats")
      .select("question_id,attempts,wrong_pct")
      .limit(5000);
    if (error) return [];
    return data as WrongStat[];
  } catch {
    return [];
  }
}

/** 전체 평균 정답률(%). 표본 없으면 null. */
export function globalAvgCorrect(stats: WrongStat[]): number | null {
  const total = stats.reduce((s, x) => s + x.attempts, 0);
  if (total === 0) return null;
  const wrong = stats.reduce((s, x) => s + (x.attempts * x.wrong_pct) / 100, 0);
  return Math.round(100 - (100 * wrong) / total);
}

export type MyStats = {
  solved: number; // 푼 문제(중복 제외)
  wrong: number; // 틀린 문제(문제별 최신 시도 기준)
  pctCorrect: number | null; // 시도 기준 정답률
  topWrongTags: { type_tag: string; wrong: number; pct: number }[]; // 오답 많은 유형 TOP 5
};

type Row = { question_id: string; is_correct: boolean; at: number; type_tag?: string };

/** 내 학습 현황. 로그인=attempts, 익명=localStorage(+유형은 questions 조회로 보강). */
export async function getMyStats(): Promise<MyStats> {
  const user = await getSessionUser();
  let rows: Row[];
  if (user) {
    const { data, error } = await supabase
      .from("attempts")
      .select("question_id,is_correct,created_at,questions(type_tag)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    rows = (
      data as unknown as {
        question_id: string;
        is_correct: boolean;
        created_at: string;
        questions: { type_tag: string } | null;
      }[]
    ).map((a) => ({
      question_id: a.question_id,
      is_correct: a.is_correct,
      at: Date.parse(a.created_at),
      type_tag: a.questions?.type_tag,
    }));
  } else {
    const local = loadLocal();
    rows = local.map((a) => ({ ...a }));
    // 익명 기록엔 type_tag가 없어 questions에서 채움 (100개씩 청크)
    const ids = [...new Set(rows.map((r) => r.question_id))];
    const tagOf = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase
        .from("questions")
        .select("id,type_tag")
        .in("id", ids.slice(i, i + 100));
      for (const q of (data ?? []) as { id: string; type_tag: string }[])
        tagOf.set(q.id, q.type_tag);
    }
    for (const r of rows) r.type_tag = tagOf.get(r.question_id);
  }

  if (rows.length === 0)
    return { solved: 0, wrong: 0, pctCorrect: null, topWrongTags: [] };

  // 문제별 최신 시도
  const latest = new Map<string, Row>();
  for (const r of [...rows].sort((a, b) => b.at - a.at))
    if (!latest.has(r.question_id)) latest.set(r.question_id, r);

  const correct = rows.filter((r) => r.is_correct).length;
  const wrongLatest = [...latest.values()].filter((r) => !r.is_correct);

  // 유형별: 오답수 / 그 유형에서 푼 문제수
  const perTag = new Map<string, { wrong: number; total: number }>();
  for (const r of latest.values()) {
    if (!r.type_tag || r.type_tag === "미분류") continue;
    const e = perTag.get(r.type_tag) ?? { wrong: 0, total: 0 };
    e.total += 1;
    if (!r.is_correct) e.wrong += 1;
    perTag.set(r.type_tag, e);
  }
  const topWrongTags = [...perTag.entries()]
    .filter(([, v]) => v.wrong > 0)
    .map(([type_tag, v]) => ({
      type_tag,
      wrong: v.wrong,
      pct: Math.round((100 * v.wrong) / v.total),
    }))
    .sort((a, b) => b.wrong - a.wrong || b.pct - a.pct)
    .slice(0, 5);

  return {
    solved: latest.size,
    wrong: wrongLatest.length,
    pctCorrect: Math.round((100 * correct) / rows.length),
    topWrongTags,
  };
}
