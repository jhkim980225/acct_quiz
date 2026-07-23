import QuizRunner from "@/views/QuizRunner";

export const metadata = { title: "문제풀기" };

/** 4지선다 CBT(F2). 익명 허용, 기록은 localStorage. 실무 분개·결산도 합성 보기로 동일 UI. */
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    type_tag?: string;
    area?: string;
    mode?: string;
    practice?: string; // 실무분개 | 결산
  }>;
}) {
  const { subject, type_tag, area, mode, practice } = await searchParams;
  const label = type_tag ?? area;
  const title =
    mode === "wrong"
      ? "오답 다시풀기"
      : mode === "hard"
        ? "오답률 높은 문제"
        : practice
          ? `${practice === "결산" ? "결산" : "실무 분개"} 풀기${label ? ` — ${label}` : ""}`
          : `문제풀기${label ? ` — ${label}` : ""}`;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="rise">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {(label || practice) && !mode && (
          <p className="mt-1 text-[14px] text-sub">
            {subject ? subject : "전 과목 믹스"} · 랜덤 10문제
            {practice && " · 보기 중 올바른 분개 고르기"}
          </p>
        )}
      </header>
      <QuizRunner
        subject={subject}
        typeTag={type_tag}
        area={area}
        mode={mode}
        practice={practice}
      />
    </div>
  );
}
