import Link from "next/link";
import { listSubjectTags, getQuestionsByIds } from "@/models/question";
import { listWrongStats, globalAvgCorrect, MIN_ATTEMPTS } from "@/models/stats";
import MyStatsCard from "@/views/MyStatsCard";

export const revalidate = 3600; // 1시간 ISR

const RANK_STYLE = [
  "bg-red text-white",
  "bg-orange-400 text-white",
  "bg-yellow-400 text-white",
  "bg-background text-sub",
  "bg-background text-sub",
];

type HardItem = {
  subject: string;
  type_tag: string;
  wrong_pct: number | null; // null = 표본 부족 → 문항수 표시
  count: number;
  snippet: string | null;
  source: string | null;
};

/** 전 유저 오답률 기준 '많이 틀린 유형' TOP 5. 표본 부족 시 문항수 순 폴백. */
async function listHardItems(): Promise<{ items: HardItem[]; hasData: boolean }> {
  const stats = (await listWrongStats()).filter((s) => s.attempts >= MIN_ATTEMPTS);
  if (stats.length > 0) {
    const qs = await getQuestionsByIds(stats.map((s) => s.question_id));
    const byId = new Map(qs.map((q) => [q.id, q]));
    const groups = new Map<
      string,
      { subject: string; type_tag: string; attempts: number; wrong: number; top: { attempts: number; snippet: string; source: string | null } }
    >();
    for (const s of stats) {
      const q = byId.get(s.question_id);
      if (!q || q.type_tag === "미분류") continue;
      const key = `${q.subject}|${q.type_tag}`;
      const g =
        groups.get(key) ??
        { subject: q.subject, type_tag: q.type_tag, attempts: 0, wrong: 0, top: { attempts: -1, snippet: "", source: null } };
      g.attempts += s.attempts;
      g.wrong += (s.attempts * s.wrong_pct) / 100;
      if (s.attempts > g.top.attempts)
        g.top = { attempts: s.attempts, snippet: q.stem.split("\n")[0], source: q.source };
      groups.set(key, g);
    }
    const items = [...groups.values()]
      .map((g) => ({
        subject: g.subject,
        type_tag: g.type_tag,
        wrong_pct: Math.round((100 * g.wrong) / g.attempts),
        count: g.attempts,
        snippet: g.top.snippet,
        source: g.top.source,
      }))
      .sort((a, b) => (b.wrong_pct ?? 0) - (a.wrong_pct ?? 0))
      .slice(0, 5);
    if (items.length > 0) return { items, hasData: true };
  }
  // 폴백: 아직 풀이 데이터가 없으면 문항 많은 유형부터
  const tags = (await listSubjectTags()).filter((t) => t.type_tag !== "미분류");
  return {
    items: tags
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => ({
        subject: t.subject,
        type_tag: t.type_tag,
        wrong_pct: null,
        count: t.count,
        snippet: null,
        source: null,
      })),
    hasData: false,
  };
}

/** 홈(F4). 취약점 집중 공략 콘셉트 랜딩 (design/메인.png). */
export default async function Home() {
  const [{ items, hasData }, stats] = await Promise.all([listHardItems(), listWrongStats()]);
  const globalAvg = globalAvgCorrect(stats);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        {/* 히어로 */}
        <section className="hero-glow card rise relative overflow-hidden p-7">
          <div className="max-w-md space-y-4">
            <span className="inline-block rounded-full bg-blue-soft px-3 py-1 text-[12px] font-bold text-blue">
              취약점 집중 공략
            </span>
            <h1 className="text-[27px] font-bold leading-snug tracking-tight sm:text-3xl">
              사람들이 많이 틀리는 문제로
              <br />
              <span className="text-blue">실력을 확실히 잡으세요</span>
            </h1>
            <p className="text-[14.5px] leading-relaxed text-sub">
              많은 수험생들이 자주 틀리는 문제들을 모았습니다.
              <br />
              오답 원인을 이해하고 개념을 확실히 정리해보세요.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/quiz?mode=hard"
                className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
              >
                오답률 높은 문제 풀기
              </Link>
              <Link
                href="/wrong"
                className="press rounded-xl bg-surface px-5 py-3 text-[14px] font-bold text-sub shadow-sm hover:text-blue"
              >
                맞춤 취약점 분석
              </Link>
            </div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-4 hidden rotate-6 rounded-3xl bg-blue-soft p-6 text-6xl sm:block"
          >
            📋
          </span>
        </section>

        {/* 많이 틀린 항목 TOP 5 */}
        <section className="card rise space-y-4 p-6" style={{ animationDelay: "120ms" }}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[16px] font-bold">사람들이 많이 틀린 항목</h2>
            <span className="text-[11.5px] text-muted">
              {hasData ? "전 유저 풀이 데이터 기준" : "풀이 데이터 쌓이는 중 · 문항수 기준"}
            </span>
          </div>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.subject}-${it.type_tag}`}>
                <Link
                  href={`/${encodeURIComponent(it.subject)}/${encodeURIComponent(it.type_tag)}`}
                  className="press flex items-center gap-3 rounded-xl border border-line px-4 py-3.5 hover:border-blue"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${RANK_STYLE[i]}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold">{it.type_tag}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {it.snippet ?? `${it.subject} 기출 ${it.count}문항`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {it.wrong_pct !== null ? (
                      <span className="block text-[13.5px] font-bold text-red">
                        오답률 {it.wrong_pct}%
                      </span>
                    ) : (
                      <span className="block text-[13.5px] font-bold text-blue">
                        {it.count}문항
                      </span>
                    )}
                    <span className="block text-[11.5px] text-muted">
                      {it.source ?? it.subject}
                    </span>
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className="shrink-0 text-muted"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/quiz?mode=hard"
            className="block pt-1 text-center text-[13px] font-bold text-blue hover:underline"
          >
            더 많은 취약 항목 풀기 ↓
          </Link>
        </section>
      </div>

      {/* 우측 레일 */}
      <div className="space-y-5">
        <MyStatsCard globalAvg={globalAvg} />

        <section className="card rise space-y-3 p-5" style={{ animationDelay: "180ms" }}>
          <h2 className="text-[15px] font-bold">왜 틀릴까요?</h2>
          <ul className="space-y-3">
            {[
              { icon: "💡", title: "개념 혼동", desc: "비슷한 개념의 차이를 헷갈려요" },
              { icon: "🧮", title: "계산 실수", desc: "공식은 알지만 계산 과정에서 실수해요" },
              { icon: "⏰", title: "시기 착각", desc: "계상 시기, 결산일 기준을 헷갈려요" },
              { icon: "📋", title: "조건 누락", desc: "문제 조건을 제대로 읽지 못했어요" },
            ].map((r) => (
              <li key={r.title} className="flex items-start gap-3">
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-[15px]">
                  {r.icon}
                </span>
                <span>
                  <span className="block text-[13.5px] font-bold">{r.title}</span>
                  <span className="block text-[12.5px] text-muted">{r.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/wrong"
            className="block pt-1 text-[12.5px] font-bold text-blue hover:underline"
          >
            오답 줄이는 방법 — 오답노트 →
          </Link>
        </section>
      </div>
    </div>
  );
}
