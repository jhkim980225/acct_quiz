import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBySubjectTag, listSubjectTags } from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import QuestionCard from "@/views/QuestionCard";

export const revalidate = 3600; // 1시간 ISR
export const dynamicParams = true; // 새 type_tag도 재배포 없이 첫 요청 시 생성

type Params = Promise<{ subject: string; type_tag: string }>;

/** 유형별 정리 페이지(F3). SSG. 구글 유입 + 애드센스 동선. */
export async function generateStaticParams() {
  const tags = await listSubjectTags();
  return tags.map((t) => ({ subject: t.subject, type_tag: t.type_tag }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, type_tag } = await params;
  const s = decodeURIComponent(subject);
  const t = decodeURIComponent(type_tag);
  return {
    title: `${s} ${t} 기출문제`,
    description: `${s} ${t} 유형 기출문제 모음. 4지선다 즉시 채점과 해설 제공.`,
  };
}

export default async function TypeTagPage({ params }: { params: Params }) {
  const { subject, type_tag } = await params;
  const s = decodeURIComponent(subject);
  const t = decodeURIComponent(type_tag);
  const questions = await getBySubjectTag(s, t);
  if (questions.length === 0) notFound(); // 존재하지 않는 조합 URL 방어

  // 관련 유형 내부링크(F10): 같은 과목의 다른 유형 상위 6개
  const related = (await listSubjectTags())
    .filter((x) => x.subject === s && x.type_tag !== t)
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <header className="card rise space-y-3 p-6">
        <p className="text-[13px] font-semibold text-muted">
          {s} · {questions[0].area}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t}</h1>
        <p className="text-[14px] text-sub">
          {(["이론", "실무분개", "결산"] as const)
            .map((c) => ({ c, n: questions.filter((q) => q.category === c).length }))
            .filter((x) => x.n > 0)
            .map((x) => `${x.c} ${x.n}`)
            .join(" · ")}
          문항 · 보기를 누르면 바로 채점돼요
        </p>
        {/* 진입점 단추: 이론은 퀴즈로, 분개·결산은 아래 목록으로 */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(() => {
            const nTheory = questions.filter((q) => q.category === "이론").length;
            const nPrac = questions.filter((q) => q.category !== "이론").length;
            return (
              <>
                {nTheory > 0 && (
                  <Link
                    href={`/quiz?subject=${encodeURIComponent(s)}&type_tag=${encodeURIComponent(t)}`}
                    className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
                  >
                    이론 풀기 <span className="opacity-70">{nTheory}</span>
                  </Link>
                )}
                {nPrac > 0 && (
                  <a
                    href="#practice"
                    className="press rounded-xl bg-blue-soft px-5 py-3 text-[14px] font-bold text-blue"
                  >
                    분개·결산 풀기 <span className="opacity-70">{nPrac}</span>
                  </a>
                )}
              </>
            );
          })()}
        </div>
      </header>

      {(["실무분개", "결산"] as const).map((cat, _i, cats) => {
        const list = questions.filter((q) => q.category === cat);
        if (list.length === 0) return null;
        // 분개가 없고 결산만 있는 유형도 #practice 앵커가 잡히게 첫 실무 섹션에 부여
        const firstPrac = cats.find((c) =>
          questions.some((q) => q.category === c),
        );
        return (
          <section key={cat} id={cat === firstPrac ? "practice" : undefined} className="scroll-mt-20 space-y-4">
            <h2 className="flex items-baseline gap-2 border-b border-line pb-2 text-lg font-bold">
              {cat === "실무분개" ? "실무 분개" : "결산"}
              <span className="text-[13px] font-semibold text-muted">
                {list.length}문항
              </span>
            </h2>
            {/* 문제는 접힌 목록으로 — 클릭 시 펼쳐서 풀기 (stem은 HTML에 있어 색인 유지) */}
            {list.map((q, i) => (
              <details
                key={q.id}
                className="card rise group overflow-hidden"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    <span className="mr-2 text-muted">Q{i + 1}.</span>
                    {q.stem.split("\n")[0]}
                  </span>
                  {q.source && (
                    <span className="hidden shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted sm:inline">
                      {q.source}
                    </span>
                  )}
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
                    q={q}
                    shuffled={
                      q.choices && q.answer_idx !== null
                        ? shuffleChoices(q.choices, q.answer_idx, q.id) // 빌드 타임 고정 셔플(F11)
                        : undefined
                    }
                  />
                </div>
              </details>
            ))}
          </section>
        );
      })}

      {related.length > 0 && (
        <nav className="card p-5">
          <h2 className="mb-3 text-[13px] font-bold text-muted">관련 유형</h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.type_tag}>
                <Link
                  href={`/${encodeURIComponent(s)}/${encodeURIComponent(r.type_tag)}`}
                  className="press inline-block rounded-full bg-background px-4 py-2 text-[13.5px] font-semibold text-sub hover:bg-blue-soft hover:text-blue"
                >
                  {r.type_tag} {r.count}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
