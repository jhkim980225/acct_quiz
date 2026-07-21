// 실행: node tests/shuffle.test.ts  (Node 22 타입 스트리핑)
import assert from "node:assert";
import { shuffleChoices } from "../models/shuffle.ts";

const choices = ["A", "B", "C", "D"];

// 1) 재매핑: 셔플 후에도 answerIdx가 가리키는 값은 원본 정답과 동일
for (let orig = 0; orig < 4; orig++) {
  for (let i = 0; i < 50; i++) {
    const r = shuffleChoices(choices, orig, `seed-${i}`);
    assert.equal(r.choices[r.answerIdx], choices[orig], "정답 재매핑 깨짐");
    assert.deepEqual([...r.choices].sort(), [...choices].sort(), "보기 유실");
  }
}

// 2) 시드 결정성: 같은 시드 = 같은 순서 (SSG 빌드 고정)
const a = shuffleChoices(choices, 2, "q-123");
const b = shuffleChoices(choices, 2, "q-123");
assert.deepEqual(a, b, "시드 결정성 깨짐");

// 3) 시드 없으면 랜덤이어도 재매핑 유지
const c = shuffleChoices(choices, 3);
assert.equal(c.choices[c.answerIdx], "D");

console.log("shuffle test OK");
