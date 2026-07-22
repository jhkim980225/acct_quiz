import { supabase } from "@/lib/supabase";

export type Question = {
  id: string;
  subject: string;
  category: "이론" | "실무분개" | "결산";
  type_tag: string;
  area: string; // 재무회계 | 원가회계 | 부가가치세 | 소득세
  stem: string;
  choices: string[] | null; // 이론만 4개, 실무는 null
  answer_idx: number | null;
  answer_text: string | null; // 실무 정답(분개)
  explanation: string | null;
  source: string | null;
};

const COLS =
  "id,subject,category,type_tag,area,stem,choices,answer_idx,answer_text,explanation,source";

/** Supabase 일시 장애(522 등)로 빌드가 죽지 않게 3회 재시도. */
async function withRetry<T>(fn: () => Promise<{ data: T; error: unknown }>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const { data, error } = await fn();
      if (!error) return data;
      lastError = error;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError;
}

export type TagCount = { subject: string; area: string; type_tag: string; count: number };

/** 시험 영역 표시 순서 */
export const AREA_ORDER = ["재무회계", "원가회계", "부가가치세", "소득세"];
const areaRank = (a: string) => {
  const i = AREA_ORDER.indexOf(a);
  return i === -1 ? AREA_ORDER.length : i;
};

/** (subject, area, type_tag) 전 조합 + 문항수. DB 뷰 집계라 1000행 캡 무관. */
export async function listSubjectTags(): Promise<TagCount[]> {
  const data = await withRetry(async () =>
    supabase.from("question_tag_counts").select("subject,area,type_tag,count"),
  );
  return (data as TagCount[]).sort((a, b) => {
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    if (a.area !== b.area) return areaRank(a.area) - areaRank(b.area);
    return b.count - a.count;
  });
}

/** 과목 무관 유형별 합계(통합 믹스 모드용). 영역순 → 문항수순. */
export async function listMixedTags(): Promise<
  { type_tag: string; area: string; count: number; subjects: number }[]
> {
  const tags = await listSubjectTags();
  const map = new Map<string, { area: string; count: number; subjects: number }>();
  for (const t of tags) {
    const e = map.get(t.type_tag) ?? { area: t.area, count: 0, subjects: 0 };
    e.count += t.count;
    e.subjects += 1;
    map.set(t.type_tag, e);
  }
  return [...map.entries()]
    .map(([type_tag, v]) => ({ type_tag, ...v }))
    .sort((a, b) =>
      a.area !== b.area ? areaRank(a.area) - areaRank(b.area) : b.count - a.count,
    );
}

/** 키워드 검색: stem에 포함된 문제. */
export async function searchQuestions(keyword: string): Promise<Question[]> {
  const safe = keyword.replace(/[%_]/g, "\\$&").trim();
  if (!safe) return [];
  const data = await withRetry(async () =>
    supabase
      .from("questions")
      .select(COLS)
      .ilike("stem", `%${safe}%`)
      .limit(50),
  );
  return data as Question[];
}

/** 유형 페이지: 해당 조합 전체 문제. */
export async function getBySubjectTag(
  subject: string,
  typeTag: string,
): Promise<Question[]> {
  const data = await withRetry(async () =>
    supabase
      .from("questions")
      .select(COLS)
      .eq("subject", subject)
      .eq("type_tag", typeTag)
      .order("source")
      .order("created_at")
      .limit(1000),
  );
  return data as Question[];
}

/** 오답 다시풀기(F7): id 목록으로 4지선다 문제만. 100개씩 청크(URL 길이 한계). */
export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  const out: Question[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const data = await withRetry(async () =>
      supabase
        .from("questions")
        .select(COLS)
        .in("id", chunk)
        .not("choices", "is", null)
        .not("answer_idx", "is", null),
    );
    out.push(...(data as Question[]));
  }
  return out;
}

/** 퀴즈: 이론(4지선다)만. subject 없이 type_tag만 주면 3과목 통합 믹스. */
export async function getQuizSet(opts?: {
  subject?: string;
  typeTag?: string;
  area?: string;
  limit?: number;
}): Promise<Question[]> {
  const data = await withRetry(async () => {
    let q = supabase
      .from("questions")
      .select(COLS)
      .not("choices", "is", null) // 분류 오류 행 방어: 4지선다 성립 조건 강제
      .not("answer_idx", "is", null)
      .limit(1000); // ponytail: 전량 fetch 후 클라 셔플. 수천 문항 넘으면 RPC 샘플링으로
    if (opts?.subject) q = q.eq("subject", opts.subject);
    if (opts?.typeTag) q = q.eq("type_tag", opts.typeTag);
    if (opts?.area) q = q.eq("area", opts.area);
    return q;
  });
  const all = data as Question[];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, opts?.limit ?? 20);
}
