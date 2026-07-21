/** 보기 셔플(F11). 원본 answer_idx를 셔플 후 인덱스로 재매핑해 반환한다.
 *  seed를 주면 결정적(SSG 빌드 고정용), 없으면 랜덤(/quiz 렌더마다). */
export function shuffleChoices(
  choices: string[],
  answerIdx: number,
  seed?: string,
): { choices: string[]; answerIdx: number } {
  const rand = seed ? mulberry32(hash(seed)) : Math.random;
  const order = choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    choices: order.map((i) => choices[i]),
    answerIdx: order.indexOf(answerIdx),
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
