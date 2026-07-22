import type { Metadata } from "next";
import { searchQuestions } from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import QuestionCard from "@/views/QuestionCard";

export const metadata: Metadata = {
  title: "문제 검색",
  robots: { index: false }, // 검색 결과는 thin content — 색인 제외
};

/** 키워드로 문제 검색. 네이티브 GET 폼이라 JS 없이 동작. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const keyword = (q ?? "").trim();
  const results = keyword ? await searchQuestions(keyword) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="rise space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">문제 검색</h1>
        <form action="/search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={keyword}
            placeholder="키워드 입력 (예: 대손충당금, 세금계산서)"
            className="w-full max-w-md rounded-xl border border-line bg-surface px-4 py-3 text-[14px] outline-none focus:border-blue"
          />
          <button
            type="submit"
            className="press shrink-0 rounded-xl bg-blue px-5 py-3 font-bold text-white hover:bg-blue-dark"
          >
            검색
          </button>
        </form>
        {keyword && (
          <p className="text-[13px] text-muted">
            “{keyword}” 검색 결과 {results.length}건
            {results.length === 50 && " (상위 50건만 표시)"}
          </p>
        )}
      </header>

      {keyword && results.length === 0 && (
        <div className="card p-10 text-center text-sub">
          검색 결과가 없어요. 다른 키워드로 시도해보세요.
        </div>
      )}

      <div className="space-y-3">
        {results.map((q2, i) => (
          <details
            key={q2.id}
            className="card rise group overflow-hidden"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {q2.stem.split("\n")[0]}
              </span>
              <span className="hidden shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted sm:inline">
                {q2.subject} · {q2.category}
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-line">
              <QuestionCard
                bare
                q={q2}
                shuffled={
                  q2.choices && q2.answer_idx !== null
                    ? shuffleChoices(q2.choices, q2.answer_idx, q2.id)
                    : undefined
                }
              />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
