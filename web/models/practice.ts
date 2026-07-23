import { getByCategory, type Question } from "@/models/question";
import { shuffleChoices } from "@/models/shuffle";

export type PracticeCategory = "실무분개" | "결산";

/** 실무 문제를 4지선다로: 정답 분개 + 같은 유형(부족하면 전체 풀)에서 뽑은
 *  오답 분개 3개. 토큰 0 — 다른 문제의 실제 정답을 오답 보기로 재사용.
 *  seed 주면 결정적(SSG), 없으면 랜덤(퀴즈 매 세트). */
export function practiceChoices(
  q: Question,
  pool: Question[],
  seed?: string,
): { choices: string[]; answerIdx: number } | undefined {
  if (!q.answer_text) return undefined;
  const others = pool.filter(
    (o) => o.id !== q.id && o.answer_text && o.answer_text !== q.answer_text,
  );
  const sameTag = others.filter((o) => o.type_tag === q.type_tag);
  const texts = [
    ...new Set((sameTag.length >= 3 ? sameTag : others).map((o) => o.answer_text!)),
  ];
  if (texts.length < 3) return undefined;
  const distractors = shuffleChoices(texts, 0, seed).choices.slice(0, 3);
  return shuffleChoices([q.answer_text, ...distractors], 0, seed && `${seed}#c`);
}

export type PracticeItem = {
  q: Question;
  shuffled: { choices: string[]; answerIdx: number };
};

/** 실무 퀴즈 세트: 과목+카테고리(+유형) 풀에서 랜덤 N개, 보기 합성까지. */
export async function getPracticeSet(opts: {
  subject: string;
  category: PracticeCategory;
  typeTag?: string;
  limit?: number;
}): Promise<PracticeItem[]> {
  const pool = await getByCategory(opts.subject, opts.category);
  let targets = opts.typeTag ? pool.filter((q) => q.type_tag === opts.typeTag) : pool;
  // 랜덤 셔플 후 잘라내기
  targets = [...targets];
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  const out: PracticeItem[] = [];
  for (const q of targets) {
    if (out.length >= (opts.limit ?? 10)) break;
    const shuffled = practiceChoices(q, pool); // 시드 없음 = 매 세트 다른 보기
    if (shuffled) out.push({ q, shuffled });
  }
  return out;
}
