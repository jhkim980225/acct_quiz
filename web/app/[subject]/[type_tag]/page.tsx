import Link from "next/link";
import type { Metadata } from "next";
import { getBySubjectTag, listSubjectTags } from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import QuestionCard from "@/views/QuestionCard";

export const dynamic = "force-static";
export const dynamicParams = false;

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

  // 관련 유형 내부링크(F10): 같은 과목의 다른 유형 상위 6개
  const related = (await listSubjectTags())
    .filter((x) => x.subject === s && x.type_tag !== t)
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <header className="card rise space-y-3 p-6">
        <p className="text-[13px] font-semibold text-muted">{s}</p>
        <h1 className="text-2xl font-bold tracking-tight">{t}</h1>
        <p className="text-[14px] text-sub">
          {questions.length}문항 · 보기를 누르면 바로 채점돼요
        </p>
        <Link
          href={`/quiz?subject=${encodeURIComponent(s)}&type_tag=${encodeURIComponent(t)}`}
          className="press inline-block rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
        >
          이 유형만 랜덤 풀기
        </Link>
      </header>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className="rise"
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <QuestionCard
              q={q}
              shuffled={
                q.choices && q.answer_idx !== null
                  ? shuffleChoices(q.choices, q.answer_idx, q.id) // 빌드 타임 고정 셔플(F11)
                  : undefined
              }
            />
          </div>
        ))}
      </div>

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
