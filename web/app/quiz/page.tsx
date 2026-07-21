import QuizRunner from "@/views/QuizRunner";

export const metadata = { title: "문제풀기" };

/** 4지선다 CBT(F2). 익명 허용, 기록은 localStorage. */
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; type_tag?: string }>;
}) {
  const { subject, type_tag } = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        문제풀기
        {type_tag ? ` — ${type_tag}` : ""}
      </h1>
      <QuizRunner subject={subject} typeTag={type_tag} />
    </div>
  );
}
