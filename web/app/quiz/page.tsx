import QuizRunner from "@/views/QuizRunner";

export const metadata = { title: "문제풀기" };

/** 4지선다 CBT(F2). 익명 허용, 기록은 localStorage. */
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    type_tag?: string;
    area?: string;
    mode?: string;
  }>;
}) {
  const { subject, type_tag, area, mode } = await searchParams;
  const label = type_tag ?? area;
  return (
    <div className="space-y-5">
      <header className="rise">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "wrong" ? "오답 다시풀기" : `문제풀기${label ? ` — ${label}` : ""}`}
        </h1>
        {label && !mode && (
          <p className="mt-1 text-[14px] text-sub">
            {subject ? subject : "전 과목 믹스"} · 랜덤 10문제
          </p>
        )}
      </header>
      <QuizRunner subject={subject} typeTag={type_tag} area={area} mode={mode} />
    </div>
  );
}
