import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getByCategory,
  getBySubjectTag,
  listSubjectTags,
  type Question,
} from "@/models/question";
import { globalAvgCorrect, MIN_ATTEMPTS } from "@/models/stats";
import { getTypeNote, PRACTICE_TIPS } from "@/models/typeNotes";
import { aggregateWrongStats } from "@/lib/wrongStats.server";
import { shuffleChoices } from "@/models/shuffle";
import QuestionCard from "@/views/QuestionCard";
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

/** 접힌 문제 행. 오답률 있으면 빨간 칩으로 표시 (design/문제.png). */
function QuestionRow({
  q,
  index,
  wrongPct,
  shuffled,
}: {
  q: Question;
  index: number;
  wrongPct?: number;
  shuffled?: { choices: string[]; answerIdx: number }; // 실무 선택형: 사전 합성 보기
}) {
  return (
    <details
      className="card rise group overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-soft text-[12.5px] font-bold text-blue">
          Q{index + 1}
        </span>
        {wrongPct !== undefined && (
          <span className="shrink-0 rounded-full bg-red-soft px-2.5 py-1 text-[11.5px] font-bold text-red">
            오답률 {wrongPct}%
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
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
            shuffled ??
            (q.choices && q.answer_idx !== null
              ? shuffleChoices(q.choices, q.answer_idx, q.id) // 빌드 타임 고정 셔플(F11)
              : undefined)
          }
        />
      </div>
    </details>
  );
}

/** 실무 문제를 4지선다로: 정답 분개 + 같은 유형(부족하면 전체 풀)에서 뽑은
 *  오답 분개 3개. 토큰 0 — 다른 문제의 실제 정답을 오답 보기로 재사용. */
function practiceChoices(
  q: Question,
  pool: Question[],
): { choices: string[]; answerIdx: number } | undefined {
  if (!q.answer_text) return undefined;
  const others = pool.filter(
    (o) => o.id !== q.id && o.answer_text && o.answer_text !== q.answer_text,
  );
  const sameTag = others.filter((o) => o.type_tag === q.type_tag);
  const texts = [
    ...new Set((sameTag.length >= 3 ? sameTag : others).map((o) => o.answer_text!)),
  ];
  if (texts.length < 3) return undefined; // 풀 부족 시 기존 '정답 보기' 폴백
  const distractors = shuffleChoices(texts, 0, q.id).choices.slice(0, 3);
  return shuffleChoices([q.answer_text, ...distractors], 0, `${q.id}#c`);
}

/** 실무 파트 페이지: 과목별 분개/결산 전용. 키워드(type_tag)별 그룹 + 분개 요령. */
async function PracticePage({ subject, slug }: { subject: string; slug: keyof typeof PRACTICE }) {
  const questions = await getByCategory(subject, PRACTICE[slug]);
  if (questions.length === 0) notFound();
  const other = slug === "분개" ? "결산" : "분개";

  // 키워드별 그룹: 문항 많은 순, 미분류(기타)는 맨 뒤
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const list = groups.get(q.type_tag) ?? [];
    list.push(q);
    groups.set(q.type_tag, list);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (a[0] === "미분류") return 1;
    if (b[0] === "미분류") return -1;
    return b[1].length - a[1].length;
  });
  const label = (tag: string) => (tag === "미분류" ? "기타" : tag);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="card rise space-y-3 p-6">
        <p className="text-[13px] font-semibold text-muted">{subject} · 실무</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {slug === "분개" ? "실무 분개" : "결산"}
        </h1>
        <p className="text-[14px] text-sub">
          {questions.length}문항 · 키워드 {ordered.length}개 · 보기 중 올바른
          분개를 고르면 바로 채점돼요.
        </p>
        {/* 키워드 내비: 앵커 점프 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ordered.map(([tag, list]) => (
            <a
              key={tag}
              href={`#${encodeURIComponent(tag)}`}
              className="press rounded-full bg-background px-3 py-1.5 text-[12.5px] font-bold text-sub hover:bg-blue-soft hover:text-blue"
            >
              {label(tag)} <span className="font-medium text-muted">{list.length}</span>
            </a>
          ))}
        </div>
        <div className="pt-1">
          <Link
            href={`/${encodeURIComponent(subject)}/${other}`}
            className="press inline-block rounded-xl bg-blue-soft px-5 py-3 text-[14px] font-bold text-blue"
          >
            {other === "분개" ? "실무 분개" : "결산"} 풀러 가기
          </Link>
        </div>
      </header>

      {ordered.map(([tag, list]) => {
        const tip = PRACTICE_TIPS[tag];
        return (
          <section key={tag} id={encodeURIComponent(tag)} className="scroll-mt-20 space-y-3">
            <div className="px-1">
              <h2 className="flex items-baseline gap-2 text-lg font-bold">
                {label(tag)}
                <span className="text-[13px] font-semibold text-muted">{list.length}문항</span>
              </h2>
              {tip && (
                <p className="mt-1 rounded-xl bg-amber-soft px-4 py-3 text-[13.5px] leading-relaxed text-sub">
                  <b className="text-foreground">분개 요령</b> · {tip}
                </p>
              )}
            </div>
            {list.map((q, i) => (
              <QuestionRow key={q.id} q={q} index={i} shuffled={practiceChoices(q, questions)} />
            ))}
          </section>
        );
      })}
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
  const pctOf = new Map(
    stats.filter((x) => x.attempts >= MIN_ATTEMPTS).map((x) => [x.question_id, x.wrong_pct]),
  );
  // 오답률 높은 순 → 표본 없는 문제는 원래 순서(회차순) 유지
  const theory = all
    .filter((q) => q.category === "이론")
    .sort((a, b) => (pctOf.get(b.id) ?? -1) - (pctOf.get(a.id) ?? -1));
  const globalAvg = globalAvgCorrect(stats);
  const hasPct = theory.some((q) => pctOf.has(q.id));

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
          <p className="text-[14px] text-sub">
            이론 {theory.length}문항
            {hasPct && " · 오답률 높은 문제로 학습효과 UP!"}
          </p>
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
