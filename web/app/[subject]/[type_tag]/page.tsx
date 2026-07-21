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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">
          {s} — {t}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {questions.length}문항 · 보기를 클릭하면 바로 채점됩니다
        </p>
        <Link
          href={`/quiz?subject=${encodeURIComponent(s)}&type_tag=${encodeURIComponent(t)}`}
          className="inline-block rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          이 유형만 랜덤 풀기
        </Link>
      </header>

      <div className="space-y-4">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            shuffled={
              q.choices && q.answer_idx !== null
                ? shuffleChoices(q.choices, q.answer_idx, q.id) // 빌드 타임 고정 셔플(F11)
                : undefined
            }
          />
        ))}
      </div>

      {related.length > 0 && (
        <nav className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">관련 유형</h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.type_tag}>
                <Link
                  href={`/${encodeURIComponent(s)}/${encodeURIComponent(r.type_tag)}`}
                  className="rounded border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {r.type_tag} ({r.count})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
