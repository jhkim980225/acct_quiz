import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getByCategory, getBySubjectTag, listSubjectTags } from "@/models/question";
import { globalAvgCorrect } from "@/models/stats";
import { getTypeNote, PRACTICE_TIPS } from "@/models/typeNotes";
import { aggregateWrongStats } from "@/lib/wrongStats.server";
import MyStatsCard from "@/views/MyStatsCard";

export const revalidate = 3600; // 1시간 ISR
export const dynamicParams = true; // 새 type_tag도 재배포 없이 첫 요청 시 생성

type Params = Promise<{ subject: string; type_tag: string }>;

/** 예약 슬러그: /[subject]/분개, /[subject]/결산 은 유형이 아니라 실무 파트 페이지 */
const PRACTICE = { 분개: "실무분개", 결산: "결산" } as const;

/** 유형별 정리 페이지(F3). SSG. 구글 유입 + 애드센스 동선. */
export async function generateStaticParams() {
  const tags = await listSubjectTags();
  const subjects = [...new Set(tags.map((t) => t.subject))];
  return [
    ...tags.map((t) => ({ subject: t.subject, type_tag: t.type_tag })),
    ...subjects.flatMap((s) =>
      Object.keys(PRACTICE).map((p) => ({ subject: s, type_tag: p })),
    ),
  ];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject, type_tag } = await params;
  const s = decodeURIComponent(subject);
  const t = decodeURIComponent(type_tag);
  if (t in PRACTICE)
    return {
      title: `${s} ${t} 기출문제`,
      description: `${s} 실무 ${t} 기출문제 모음. 정답 분개와 해설 제공.`,
    };
  return {
    title: `${s} ${t} 기출문제`,
    description: `${s} ${t} 유형 기출문제 모음. 4지선다 즉시 채점과 해설 제공.`,
  };
}

/** 실무 파트 페이지: 과목별 분개/결산 허브. 키워드별 요령 정리 + 퀴즈 진입.
 *  문제은행 방식 — 목록을 깔지 않고 풀이는 한 문제씩 퀴즈(/quiz?practice=)로. */
async function PracticePage({ subject, slug }: { subject: string; slug: keyof typeof PRACTICE }) {
  const questions = await getByCategory(subject, PRACTICE[slug]);
  if (questions.length === 0) notFound();
  const other = slug === "분개" ? "결산" : "분개";
  const category = PRACTICE[slug];

  // 키워드별 문항수: 많은 순, 미분류(기타)는 맨 뒤
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.type_tag, (counts.get(q.type_tag) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => {
    if (a[0] === "미분류") return 1;
    if (b[0] === "미분류") return -1;
    return b[1] - a[1];
  });
  const label = (tag: string) => (tag === "미분류" ? "기타" : tag);
  const quizHref = (tag?: string) =>
    `/quiz?subject=${encodeURIComponent(subject)}&practice=${encodeURIComponent(category)}` +
    (tag ? `&type_tag=${encodeURIComponent(tag)}` : "");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="card rise space-y-3 p-6">
        <p className="text-[13px] font-semibold text-muted">{subject} · 실무</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {slug === "분개" ? "실무 분개" : "결산"}
        </h1>
        <p className="text-[14px] text-sub">
          {questions.length}문항 · 키워드 {ordered.length}개 · 한 문제씩 보기 중
          올바른 분개를 고르면 바로 채점돼요.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={quizHref()}
            className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
          >
            {slug === "분개" ? "실무 분개" : "결산"} 풀기{" "}
            <span className="opacity-70">{questions.length}</span>
          </Link>
          <Link
            href={`/${encodeURIComponent(subject)}/${other}`}
            className="press rounded-xl bg-blue-soft px-5 py-3 text-[14px] font-bold text-blue"
          >
            {other === "분개" ? "실무 분개" : "결산"} 풀러 가기
          </Link>
        </div>
      </header>

      {/* 키워드별: 요령 정리(콘텐츠) + 해당 키워드만 풀기 */}
      <section className="card space-y-4 p-6">
        <h2 className="text-[16px] font-bold">키워드별 풀기 · 분개 요령</h2>
        {ordered.map(([tag, n]) => {
          const tip = PRACTICE_TIPS[tag];
          return (
            <div key={tag} className="space-y-1.5 border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14.5px] font-bold">
                  {label(tag)}{" "}
                  <span className="text-[12px] font-semibold text-muted">{n}문항</span>
                </h3>
                <Link
                  href={quizHref(tag)}
                  className="press shrink-0 rounded-lg bg-blue-soft px-3.5 py-1.5 text-[12.5px] font-bold text-blue"
                >
                  풀기
                </Link>
              </div>
              {tip && (
                <p className="text-[13.5px] leading-relaxed text-sub">{tip}</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default async function TypeTagPage({ params }: { params: Params }) {
  const { subject, type_tag } = await params;
  const s = decodeURIComponent(subject);
  const t = decodeURIComponent(type_tag);

  if (t in PRACTICE)
    return <PracticePage subject={s} slug={t as keyof typeof PRACTICE} />;

  // 유형 페이지는 이론(4지선다)만. 실무 분개·결산은 /[subject]/분개, /[subject]/결산 으로 분리.
  const [all, stats] = await Promise.all([getBySubjectTag(s, t), aggregateWrongStats()]);
  if (all.length === 0) notFound(); // 존재하지 않는 조합 URL 방어
  const theory = all.filter((q) => q.category === "이론");
  const globalAvg = globalAvgCorrect(stats);

  const note = getTypeNote(t); // 유형별 핵심 정리(토큰0 큐레이션). 없으면 카드 생략.

  // 관련 유형 내부링크(F10): 같은 과목의 다른 유형 상위 6개
  const related = (await listSubjectTags())
    .filter((x) => x.subject === s && x.type_tag !== t)
    .slice(0, 6);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-5">
        <header className="card rise space-y-3 p-6">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-blue-soft px-2.5 py-1 text-[11.5px] font-bold text-blue">
              {s}
            </span>
            <span className="rounded-full bg-background px-2.5 py-1 text-[11.5px] font-bold text-sub">
              {all[0].area}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t}</h1>
          <p className="text-[14px] text-sub">이론 {theory.length}문항</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {theory.length > 0 && (
              <Link
                href={`/quiz?subject=${encodeURIComponent(s)}&type_tag=${encodeURIComponent(t)}`}
                className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
              >
                이론 풀기 <span className="opacity-70">{theory.length}</span>
              </Link>
            )}
            {(["분개", "결산"] as const).map((p) => (
              <Link
                key={p}
                href={`/${encodeURIComponent(s)}/${p}`}
                className="press rounded-xl bg-blue-soft px-5 py-3 text-[14px] font-bold text-blue"
              >
                {p === "분개" ? "실무 분개" : "결산"} 풀러 가기
              </Link>
            ))}
          </div>
        </header>

        {note && (
          <section className="card rise space-y-3 p-6">
            <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
              📌 핵심 정리
            </h2>
            <p className="text-[14px] leading-relaxed text-sub">{note.intro}</p>
            <ul className="space-y-2">
              {note.points.map((line, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-sub">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 문제 목록은 유형 페이지에 안 깐다 — 풀이는 퀴즈(이론 풀기)로만 */}
        {note && note.detail.length > 0 && (
          <section className="card space-y-4 p-6">
            <h2 className="text-[16px] font-bold">{t} 상세 정리</h2>
            {note.detail.map((d) => (
              <div key={d.h} className="space-y-1.5">
                <h3 className="text-[14.5px] font-bold text-blue">{d.h}</h3>
                <p className="text-[14px] leading-relaxed text-sub">{d.body}</p>
              </div>
            ))}
            <p className="border-t border-line pt-3 text-[12px] text-muted">
              일반기업회계기준·현행 세법 기준으로 정리한 학습용 요약입니다. 오류
              제보는 문제 신고 버튼이나 하단 문의로 보내주세요.
            </p>
          </section>
        )}

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

      <div className="space-y-5">
        <MyStatsCard globalAvg={globalAvg} />
      </div>
    </div>
  );
}
