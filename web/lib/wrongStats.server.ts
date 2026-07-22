import "server-only";

export type WrongStat = { question_id: string; attempts: number; wrong_pct: number };

/** 전 유저 오답률 집계. attempts는 RLS로 본인 행만 보이므로 service role로 서버에서만 집계.
 * user_id는 노출하지 않는다(익명 집계). 키 미설정/장애 시 빈 배열 → 오답률 UI 자동 숨김.
 * ponytail: 전량 fetch 후 JS 집계. attempts 수만 건 넘으면 SQL 뷰/RPC로 교체. */
export async function aggregateWrongStats(): Promise<WrongStat[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const rows: { question_id: string; is_correct: boolean }[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const res = await fetch(
        `${url}/rest/v1/attempts?select=question_id,is_correct&offset=${off}&limit=1000`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          next: { revalidate: 300 }, // 5분 캐시
        },
      );
      if (!res.ok) return [];
      const batch = (await res.json()) as typeof rows;
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    const agg = new Map<string, { attempts: number; wrong: number }>();
    for (const r of rows) {
      const e = agg.get(r.question_id) ?? { attempts: 0, wrong: 0 };
      e.attempts += 1;
      if (!r.is_correct) e.wrong += 1;
      agg.set(r.question_id, e);
    }
    return [...agg.entries()].map(([question_id, e]) => ({
      question_id,
      attempts: e.attempts,
      wrong_pct: Math.round((100 * e.wrong) / e.attempts),
    }));
  } catch {
    return [];
  }
}
