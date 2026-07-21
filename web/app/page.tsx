import Link from "next/link";
import { listSubjectTags } from "@/models/question";

export const dynamic = "force-static";

/** 색인 허브(F4). 과목 → 유형 링크 트리. */
export default async function Home() {
  const tags = await listSubjectTags();
  const subjects = new Map<string, typeof tags>();
  for (const t of tags) {
    const list = subjects.get(t.subject) ?? [];
    list.push(t);
    subjects.set(t.subject, list);
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">전산회계 기출 유형별 문제은행</h1>
        <p className="text-gray-600 dark:text-gray-400">
          기출문제를 유형별로 모아 4지선다로 바로 풀고 채점합니다. 분개·결산
          실무 문제는 정답 분개와 해설로 확인하세요.
        </p>
        <Link
          href="/quiz"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          바로 문제풀기
        </Link>
      </section>

      {[...subjects.entries()].map(([subject, list]) => (
        <section key={subject} className="space-y-3">
          <h2 className="text-xl font-semibold">{subject}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((t) => (
              <li key={t.type_tag}>
                <Link
                  href={`/${encodeURIComponent(subject)}/${encodeURIComponent(t.type_tag)}`}
                  className="block rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {t.type_tag}
                  <span className="ml-1 text-xs text-gray-500">{t.count}문항</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
