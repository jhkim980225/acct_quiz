# -*- coding: utf-8 -*-
"""수집 QA 게이트: 파싱 산출물의 깨짐을 적재 전에 잡는다.

- parse_questions.py 가 마지막에 호출해 위반 요약을 출력하고 exit 2
- load_supabase.py 가 업로드 전에 재검증, 위반 있으면 거부 (--force 로 무시)
- 단독 실행: python qa_gate.py  (out/questions.json 검사)

과거 실제로 터진 패턴 전부를 룰로 고정:
  · 이전 문제 해설(①~④/＝계산식/분개표)이 stem 머리에 붙음
  · 해설 꼬리에 페이지 푸터·실무시험 섹션 혼입
  · 이론 문항 보기/정답 불량, 깨진 문자
"""
import json
import re
import sys
from pathlib import Path

CIRC = "①②③④⑤"

# stem 이 문제 본문이 아니라 이전 해설 잔재로 시작
_STEM_SPILL = re.compile(
    rf"^[{CIRC}＝=ㆍ·※▶＋+]"
    r"|^\((차|대)\)"
    r"|^(따라서|그러므로|즉,)"
)

# 해설/정답 텍스트에 남으면 안 되는 페이지 푸터·다음 섹션 헤더
_TAIL_JUNK = re.compile(
    r"\d+\s*/\s*\d+\s*\(뒷면\s*계속\)|\(뒷면\s*계속\)"
    r"|\[제\s*\d+\s*회[^\]]*\]"
    r"|실\s?무\s?시\s?험.{0,60}(회사코드|물음에 답하시오)"
)


def validate(questions: list[dict]) -> list[dict]:
    """위반 목록 반환. 비면 통과."""
    violations: list[dict] = []

    def bad(q: dict, rule: str) -> None:
        violations.append(
            {"source": q.get("source"), "rule": rule, "stem": (q.get("stem") or "")[:80]}
        )

    for q in questions:
        stem = q.get("stem") or ""
        expl = q.get("explanation") or ""
        ans_text = q.get("answer_text") or ""

        if _STEM_SPILL.match(stem.lstrip()):
            bad(q, "stem이 해설 잔재로 시작")
        if not 10 <= len(stem) <= 2000:
            bad(q, f"stem 길이 이상({len(stem)})")
        if _TAIL_JUNK.search(expl):
            bad(q, "해설에 푸터/다음 섹션 혼입")
        if _TAIL_JUNK.search(ans_text):
            bad(q, "정답 텍스트에 푸터/다음 섹션 혼입")
        if "�" in stem + expl + ans_text:
            bad(q, "깨진 문자(U+FFFD)")

        if q.get("category") == "이론":
            ch = q.get("choices")
            if not ch or len(ch) != 4:
                bad(q, f"이론인데 choices {len(ch) if ch else 0}개")
            elif any(not (c or "").strip() for c in ch):
                bad(q, "빈 choice")
            ai = q.get("answer_idx")
            if ai is None or not 0 <= ai <= 3:
                bad(q, f"answer_idx 이상({ai})")
        else:
            if not ans_text.strip():
                bad(q, "실무인데 answer_text 없음")

    return violations


def report(violations: list[dict], total: int) -> None:
    print(f"[QA] {total}문항 검사, 위반 {len(violations)}건")
    from collections import Counter

    for rule, n in Counter(v["rule"] for v in violations).most_common():
        print(f"  {rule}: {n}")
    for v in violations[:10]:
        print(f"    [{v['source']}] {v['stem'][:60]}")


def selftest() -> None:
    ok = {
        "category": "이론", "source": "t", "stem": "다음 중 옳지 않은 것은? 충분히 긴 본문",
        "choices": ["a", "b", "c", "d"], "answer_idx": 0, "explanation": "해설", "answer_text": None,
    }
    assert validate([ok]) == []
    broken = [
        {**ok, "stem": "① 원가관리회계의 목적이다.\n다음 중 옳은 것은?"},
        {**ok, "stem": "＝기초자본 1,000,000원\n다음 중 옳은 것은?"},
        {**ok, "explanation": "해설 5/21(뒷면 계속)"},
        {**ok, "explanation": "해설 [제111회 전산세무2급 확정답안]"},
        {**ok, "choices": ["a", "b", "c"]},
        {**ok, "answer_idx": 7},
        {**ok, "category": "결산", "choices": None, "answer_idx": None, "answer_text": ""},
    ]
    for b in broken:
        assert validate([b]), f"미검출: {b}"
    print("qa_gate selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
        sys.exit(0)
    path = Path(__file__).parent / "out" / "questions.json"
    qs = json.loads(path.read_text(encoding="utf-8"))
    vio = validate(qs)
    report(vio, len(qs))
    sys.exit(2 if vio else 0)
