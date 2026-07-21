import Link from "next/link";
import {
  listSubjectTags,
  listMixedTags,
  getQuizSet,
  AREA_ORDER,
} from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";
import DemoQuestion from "@/views/DemoQuestion";

export const revalidate = 3600; // 1시간 ISR: 데모 문제도 1시간마다 교체

/** 홈(F4). 히어로에서 바로 한 문제 풀게 하는 즉시 체험형 랜딩. */
export default async function Home() {
  const tags = await listSubjectTags();
  const mixed = (await listMixedTags()).filter((t) => t.type_tag !== "미분류");
  const totalQ = tags.reduce((s, t) => s + t.count, 0);
  const subjects = [...new Set(tags.map((t) => t.subject))];
  const top = tags
    .filter((t) => t.type_tag !== "미분류")
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  // 데모는 짧고 깔끔한 문제로 — 후보 8개 중 stem 최단. ISR 주기마다 교체
  const demo = (await getQuizSet({ limit: 8 })).sort(
    (a, b) => a.stem.length - b.stem.length,
  )[0];

  return (
    <div className="space-y-5">
      {/* 히어로: 카피 + 라이브 데모 문제 */}
      <section className="hero-glow rise relative -mx-4 px-4 pb-2 pt-4 lg:-mx-10 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {["무료", "회원가입 없이 바로", "공식 해설 포함"].map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-blue-soft px-3 py-1 text-[12px] font-bold text-blue"
                >
                  ✓ {b}
                </span>
              ))}
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              전산회계 기출 {totalQ.toLocaleString()}문제,
              <br />
              <span className="text-blue">지금 바로</span> 풀어보세요
            </h1>
            <p className="text-[15px] leading-relaxed text-sub">
              전산회계 1급·2급, 전산세무 2급 기출을 유형별로. 보기를 누르는
              순간 채점되고, 공식 해설이 바로 따라와요. 오른쪽 문제로 지금
              시험해보세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/quiz"
                className="press rounded-xl bg-blue px-6 py-3.5 font-bold text-white hover:bg-blue-dark"
              >
                바로 문제풀기
              </Link>
              <Link
                href="/wrong"
                className="press rounded-xl bg-surface px-6 py-3.5 font-bold text-sub shadow-sm hover:text-blue"
              >
                오답노트
              </Link>
            </div>
          </div>

          {demo && demo.choices && demo.answer_idx !== null && (
            <div className="rise" style={{ animationDelay: "150ms" }}>
              <DemoQuestion
                q={demo}
                shuffled={shuffleChoices(demo.choices, demo.answer_idx, demo.id)}
                total={totalQ}
              />
            </div>
          )}
        </div>
      </section>

      {/* 통계 */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "기출 문제", value: `${totalQ}`, unit: "문" },
          { label: "유형", value: `${tags.length}`, unit: "개" },
          { label: "과목", value: `${subjects.length}`, unit: "과목" },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card rise p-3 text-center sm:p-4"
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

      {/* 3과목 통합 믹스: 영역(재무/원가/부가세/소득세)별로 같은 유형을 전 과목에서 섞어 출제 */}
      <section className="card rise space-y-4 p-6" style={{ animationDelay: "200ms" }}>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold">영역별 통합 풀기</h2>
          <span className="text-[12px] text-muted">전산회계 1·2급 + 전산세무 2급 믹스</span>
        </div>
        {AREA_ORDER.map((area) => {
          const items = mixed.filter((t) => t.area === area);
          if (items.length === 0) return null;
          const total = items.reduce((s, t) => s + t.count, 0);
          return (
            <div key={area} className="space-y-3 rounded-xl bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-bold">
                  {area}
                  <span className="ml-1.5 text-[12px] font-semibold text-muted">
                    {total}문항
                  </span>
                </p>
                <Link
                  href={`/quiz?area=${encodeURIComponent(area)}`}
                  className="press shrink-0 rounded-lg bg-blue px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-dark"
                >
                  전체 풀기
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.slice(0, 8).map((t) => (
                  <Link
                    key={t.type_tag}
                    href={`/quiz?type_tag=${encodeURIComponent(t.type_tag)}`}
                    className="press rounded-full bg-surface px-4 py-2 text-[13.5px] font-bold text-blue shadow-sm"
                  >
                    {t.type_tag} <span className="font-medium text-muted">{t.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
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
