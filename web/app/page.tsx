import Link from "next/link";
import { listSubjectTags } from "@/models/question";

export const dynamic = "force-static";

/** 홈(F4). 사이드바가 색인을 담당하므로 홈은 요약 대시보드. */
export default async function Home() {
  const tags = await listSubjectTags();
  const totalQ = tags.reduce((s, t) => s + t.count, 0);
  const subjects = [...new Set(tags.map((t) => t.subject))];
  const top = [...tags].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="space-y-5">
      {/* 히어로 */}
      <section className="card rise space-y-4 p-7" style={{ animationDelay: "0ms" }}>
        <h1 className="text-2xl font-bold leading-snug tracking-tight">
          기출을 유형별로,
          <br />
          <span className="text-blue">풀면서</span> 외우세요
        </h1>
        <p className="text-[15px] leading-relaxed text-sub">
          전산회계 기출 {totalQ}문제를 유형별 4지선다로. 보기 클릭하면 바로
          채점되고 해설까지 보여드려요.
        </p>
        <Link
          href="/quiz"
          className="press inline-block rounded-xl bg-blue px-6 py-3.5 font-bold text-white hover:bg-blue-dark"
        >
          바로 문제풀기
        </Link>
      </section>

      {/* 통계 */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "기출 문제", value: `${totalQ}`, unit: "문" },
          { label: "유형", value: `${tags.length}`, unit: "개" },
          { label: "과목", value: `${subjects.length}`, unit: "과목" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card rise p-4 text-center"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <p className="text-xl font-bold">
              {s.value}
              <span className="ml-0.5 text-[13px] font-semibold text-muted">
                {s.unit}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      {/* 인기 유형 */}
      <section className="card rise space-y-3 p-6" style={{ animationDelay: "260ms" }}>
        <h2 className="text-[15px] font-bold">문제 많은 유형부터</h2>
        <ul className="space-y-1">
          {top.map((t) => (
            <li key={`${t.subject}-${t.type_tag}`}>
              <Link
                href={`/${encodeURIComponent(t.subject)}/${encodeURIComponent(t.type_tag)}`}
                className="press flex items-center justify-between rounded-xl px-3 py-3 hover:bg-background"
              >
                <span className="text-[14.5px] font-semibold">{t.type_tag}</span>
                <span className="text-[13px] text-muted">
                  {t.subject} · {t.count}문항
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
