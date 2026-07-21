"""확정답안 PDF → 문제 JSON 파서 (토큰 0).

세무사회 공식 확정답안 PDF는 이론 15문항의 문제·보기·정답·해설을 전부 포함한다.
이 파일 하나만 파싱한다. 상단 A형 정답표로 본문 [답] 파싱을 교차검증한다.

사용:
    python parse_questions.py                # raw/*확정답안*.pdf 전부 파싱
    python parse_questions.py --retry-failed # 규칙 수정 후 failed.json 만 재파싱
    python parse_questions.py --selftest     # 파서 단위 체크

출력:
    out/questions.json  성공분 (DB questions 스키마 필드 동일)
    out/failed.json     실패분 (원문 블록 + 사유) — 재파싱 재료
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent / "out"

GLYPHS = "①②③④"

# type_tag 키워드 규칙. 첫 매칭 승(구체적 유형 먼저). 커버리지 우선, 미매칭은 미분류.
TYPE_RULES: list[tuple[str, str]] = [
    ("부가세", r"부가가치세|세금계산서|매입세액|과세표준|간이과세|영세율"),
    ("원천징수", r"원천징수|연말정산|일용직|근로소득|퇴직소득|사업소득"),
    ("소득세", r"소득세법|종합소득|기타소득|이자소득|배당소득"),
    ("감가상각", r"감가상각"),
    ("유가증권", r"단기매매증권|매도가능증권|만기보유증권|유가증권|자기주식"),
    ("재고자산", r"재고자산|선입선출|후입선출|총평균|이동평균|소모품"),
    ("대손", r"대손"),
    ("어음", r"받을어음|지급어음|약속어음|어음"),
    ("퇴직급여", r"퇴직연금|퇴직급여"),
    ("급여", r"급여|임금|상여금"),
    ("가지급금", r"가지급금|가수금"),
    ("외화환산", r"외화|환율|외환차"),
    ("차입금", r"장기차입금|단기차입금|차입금"),
    ("채권채무", r"외상매출금|외상매입금|미수금|미지급금|선수금|선급금"),
    ("이자손익", r"미수수익|이자수익|이자비용|미지급비용|선급비용"),
    ("현금예금", r"현금및현금성|현금성자산|당좌예금|정기예금|현금과부족|당좌차월"),
    ("유형자산", r"유형자산|자본적 지출|취득원가"),
    ("무형자산", r"무형자산|개발비|영업권"),
    ("자본", r"자본금|자본잉여금|이익잉여금|주식발행|증자|배당"),
    ("부채", r"유동부채|비유동부채|사채|충당부채"),
    ("재무상태표", r"재무상태표"),
    ("손익계산서", r"손익계산서"),
    ("수익비용", r"수익의 인식|수익인식|발생주의|비용의 인식|수익비용"),
    ("원가", r"원가|노무비|제조간접비|가공비|공손|제조지시서|부문별|보조부문|당기총제조|당기제품제조"),
    ("회계원칙", r"회계의 순환|회계정보|재무제표|회계처리의 기본|회계상 거래"),
]

# 시험 영역(과목 내 대분류). type_tag의 함수 — 재무회계가 기본.
AREA_BY_TAG = {
    "원가": "원가회계",
    "부가세": "부가가치세",
    "소득세": "소득세",
    "원천징수": "소득세",
}


def area_of(tag: str) -> str:
    return AREA_BY_TAG.get(tag, "재무회계")


def classify(stem: str) -> str:
    for tag, pat in TYPE_RULES:
        if re.search(pat, stem):
            return tag
    return "미분류"


# ---------------------------------------------------------------------------
# PDF → 정제 텍스트
# ---------------------------------------------------------------------------
_JUNK_LINE = re.compile(
    r"^\[제\d+회 .*확정답안\]$"      # 페이지 머리글
    r"|^\d+/\d+\(뒷면 계속\)$"        # 페이지 번호
    r"|^\d+/\d+$"
    r"|^[이론시험실무형AB]$"          # 세로 섹션 글자(이/론/시/험/실/무) 및 A/B형 잔재
)


def _page_lines(page) -> list[str]:
    """페이지를 줄 단위로 뽑되, 보기 이어짐(줄바꿈된 보기)을 앞 줄에 합친다.

    보기 첫 줄은 마커(①~④)와 y 좌표가 일치하고, 이어지는 줄은 어떤 마커의
    y 와도 일치하지 않는다. 이를 이용해 이어짐 줄을 앞 줄에 병합한다.
    2단 조판 페이지(세무2급 일부 회차)는 좌/우 컬럼을 나눠 순서대로 처리한다.
    """
    raw: list[tuple[float, float, str]] = []  # (x, y, text)
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                x, y = line["bbox"][0], round(line["bbox"][1], 1)
                raw.append((x, y, text))

    def emit(lines: list[tuple[float, float, str]], indent_x: float) -> list[str]:
        lines = sorted(lines, key=lambda t: (t[1], t[0]))
        marker_ys = {y for _x, y, t in lines if t in tuple(GLYPHS)}
        out: list[str] = []
        prev_indented = False
        for x, y, text in lines:
            indented = x > indent_x  # 보기 텍스트 열. 마커/문항/[답]은 그보다 왼쪽.
            if indented and prev_indented and y not in marker_ys and out:
                out[-1] = out[-1] + " " + text  # 줄바꿈된 보기 이어붙임
            else:
                out.append(text)
            prev_indented = indented
        return out

    # 2단 감지: 페이지 중앙 이후에서 시작하는 줄이 30% 이상이면 좌→우 컬럼 순 처리
    # 가로 조판 페이지(세무2급 일부 회차)만 2단. 세로 페이지는 항상 1단.
    if page.rect.width > page.rect.height:
        mid = page.rect.width / 2
        left = [l for l in raw if l[0] < mid]
        right = [l for l in raw if l[0] >= mid]
        # 컬럼별 들여쓰기 기준: 컬럼 시작선 + 12pt (마커열과 보기열 사이)
        lx = min(l[0] for l in left) + 12 if left else 65
        rx = min(l[0] for l in right) + 12 if right else 65
        return emit(left, lx) + emit(right, rx)
    return emit(raw, 65)


def load_theory_text(pdf_path: Path) -> tuple[str, list[list[int]]]:
    """확정답안 PDF에서 (이론 섹션 텍스트, A형 정답 15개)를 얻는다.

    정답은 복수정답 인정 회차가 있어 문항당 인덱스 리스트로 반환한다.
    """
    import fitz

    doc = fitz.open(pdf_path)
    full = "\n".join("\n".join(_page_lines(page)) for page in doc)

    # A형 정답표는 원시 텍스트에서 추출 — 시각 줄 병합이 표 순서를 흐트릴 수 있음.
    raw_full = "\n".join(page.get_text() for page in doc)
    m = re.search(r"A형(.*?)B형", raw_full, re.DOTALL)
    if not m:
        raise ValueError("A형 정답표를 찾지 못함")
    entries = re.findall(rf"[{GLYPHS}](?:\s*,\s*[{GLYPHS}])*", m.group(1))
    key = [[GLYPHS.index(g) for g in re.findall(f"[{GLYPHS}]", e)] for e in entries]
    if len(key) != 15:
        raise ValueError(f"A형 정답표가 15개가 아님: {len(key)}개")

    # 이론 섹션: 첫 '1.' 문제부터 실무시험 헤더 전까지.
    sec = re.search(r"실\s*\n무\s*\n시\s*\n험", full)
    theory = full[: sec.start()] if sec else full
    start = re.search(r"^1\.\s", theory, re.MULTILINE)
    if not start:
        raise ValueError("이론 1번 문제 시작을 찾지 못함")
    theory = theory[start.start():]

    lines = [ln.strip() for ln in theory.split("\n")]
    lines = [ln for ln in lines if ln and not _JUNK_LINE.match(ln)]
    return "\n".join(lines), key


# ---------------------------------------------------------------------------
# 이론 텍스트 → 문제 블록 → 파싱
# ---------------------------------------------------------------------------
def split_blocks(theory: str) -> list[tuple[int, str]]:
    """문항번호 줄 경계로 블록 분리. [(번호, 블록텍스트), ...]"""
    marks = [
        (int(m.group(1)), m.start())
        for m in re.finditer(r"^(\d{1,2})\.\s", theory, re.MULTILINE)
        if 1 <= int(m.group(1)) <= 15
    ]
    # 번호가 오름차순으로 이어지는 것만 문항 경계로 인정(본문 속 '3.' 오탐 방지).
    blocks: list[tuple[int, str]] = []
    expected = 1
    starts: list[tuple[int, int]] = []
    for num, pos in marks:
        if num == expected:
            starts.append((num, pos))
            expected += 1
    for i, (num, pos) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(theory)
        blocks.append((num, theory[pos:end].strip()))
    return blocks


def parse_block(num: int, block: str) -> dict:
    """블록 하나 → {stem, choices, answer_idx, explanation}. 실패 시 ValueError."""
    ans = re.search(rf"\[답\]\s*([{GLYPHS}](?:\s*,\s*[{GLYPHS}])*)", block)
    if not ans:
        raise ValueError("[답] 마커 없음")
    answer_idx = GLYPHS.index(ans.group(1)[0])
    explanation = block[ans.end():].strip() or None

    body = block[: ans.start()]
    lines = [ln for ln in (l.strip() for l in body.split("\n")) if ln]

    # 보기 마커 줄(①~④ 단독)의 위치를 찾는다.
    marker_pos = [i for i, ln in enumerate(lines) if ln in tuple(GLYPHS)]

    if len(marker_pos) == 4 and marker_pos == list(
        range(marker_pos[0], marker_pos[0] + 4)
    ):
        # 레이아웃 A: ①②③④ 연속 → 이후 줄들이 보기 텍스트.
        stem_lines = lines[: marker_pos[0]]
        texts = lines[marker_pos[3] + 1 :]
        if len(texts) == 4:
            choices = texts
        elif len(texts) == 8:
            # ponytail: 2열 표 보기(가/나 조합)는 열별 4+4로 온다고 가정해 쌍으로 합침.
            # 3열 표 등 다른 형태가 나오면 실패 처리되고 failed.json 에서 규칙 보강.
            choices = [f"{texts[i]} / {texts[i + 4]}" for i in range(4)]
        else:
            raise ValueError(f"보기 텍스트 줄 수 이상: {len(texts)}줄")
    else:
        # 레이아웃 B: '① 텍스트' 인라인.
        inline = re.split(f"(?=[{GLYPHS}])", body)
        choices = [
            seg[1:].strip().replace("\n", " ")
            for seg in inline
            if seg[:1] in GLYPHS
        ]
        stem_lines = [inline[0].strip()] if inline and inline[0].strip() else []
        stem_lines = inline[0].strip().split("\n") if inline else []
        if len(choices) != 4:
            raise ValueError(f"인라인 보기 {len(choices)}개(4개 아님)")

    stem = re.sub(rf"^{num}\.\s*", "", "\n".join(stem_lines)).strip()
    if not stem:
        raise ValueError("stem 비어있음")
    if any(not c for c in choices):
        raise ValueError("빈 보기 존재")

    return {
        "stem": stem,
        "choices": choices,
        "answer_idx": answer_idx,
        "explanation": explanation,
    }


def parse_answer_pdf(pdf_path: Path) -> tuple[list[dict], list[dict]]:
    """확정답안 PDF 하나 → (성공 문제 리스트, 실패 리스트)."""
    m = re.search(r"제(\d+)회\s*(전산회계\d급|전산세무\d급)", pdf_path.name)
    source = f"{m.group(2)} {m.group(1)}회" if m else pdf_path.stem
    subject = m.group(2) if m else "미상"

    theory, key = load_theory_text(pdf_path)
    ok: list[dict] = []
    failed: list[dict] = []

    for num, block in split_blocks(theory):
        try:
            q = parse_block(num, block)
        except ValueError as e:
            failed.append(
                {"source": source, "number": num, "reason": str(e), "block": block}
            )
            continue
        # 교차검증: 본문 [답] vs 상단 A형 정답표. 다르면 공식 표를 믿는다.
        accepted = key[num - 1]
        if q["answer_idx"] not in accepted:
            q["answer_idx"] = accepted[0]
            q["explanation"] = (q["explanation"] or "") + " [주의: 본문 답과 정답표 불일치, 정답표 채택]"
        if len(accepted) > 1:
            note = "복수정답 인정: " + ",".join(GLYPHS[i] for i in accepted)
            q["explanation"] = ((q["explanation"] or "") + f" [{note}]").strip()
        tag = classify(q["stem"])
        ok.append(
            {
                "subject": subject,
                "category": "이론",
                "type_tag": tag,
                "area": area_of(tag),
                "stem": q["stem"],
                "choices": q["choices"],
                "answer_idx": q["answer_idx"],
                "explanation": q["explanation"],
                "source": source,
            }
        )
    return ok, failed


# ---------------------------------------------------------------------------
# 실무 섹션: 분개(일반전표입력)·결산만 추출. 프로그램 조작형(기초정보·매입매출
# 전표·오류수정·조회)은 제외 — 웹에서 재현 불가/무의미.
# ---------------------------------------------------------------------------
_SECTION_CHARS = set("이론시험실무형AB")


def _visual_lines(page) -> list[str]:
    """단어를 y좌표로 줄 단위 재구성. 어음·세금계산서 같은 서식(표)이
    읽기 순서가 아니라 눈에 보이는 행 순서로 나온다.
    가로 조판(2단) 페이지는 좌/우 컬럼을 나눠 차례로 처리한다."""
    all_words = page.get_text("words")
    if page.rect.width > page.rect.height:
        mid = page.rect.width / 2
        left = [w for w in all_words if w[0] < mid]
        right = [w for w in all_words if w[0] >= mid]
        return _vl_group(left) + _vl_group(right)
    return _vl_group(all_words)


def _vl_group(all_words) -> list[str]:
    words = sorted(all_words, key=lambda w: (w[1], w[0]))
    lines: list[str] = []
    row: list = []
    row_y = None
    for w in words:
        # 좌측 세로 섹션 라벨(이/론/시/험/실/무) 제거: x<50 단일 문자
        if w[0] < 50 and w[4] in _SECTION_CHARS and len(w[4]) == 1:
            continue
        if row_y is None or abs(w[1] - row_y) <= 3:
            row.append(w)
            row_y = w[1] if row_y is None else row_y
        else:
            lines.append(" ".join(x[4] for x in sorted(row, key=lambda x: x[0])))
            row, row_y = [w], w[1]
    if row:
        lines.append(" ".join(x[4] for x in sorted(row, key=lambda x: x[0])))
    return lines


def parse_practical(pdf_path: Path) -> list[dict]:
    import fitz

    m = re.search(r"제(\d+)회\s*(전산회계\d급|전산세무\d급)", pdf_path.name)
    source = f"{m.group(2)} {m.group(1)}회" if m else pdf_path.stem
    subject = m.group(2) if m else "미상"

    doc = fitz.open(pdf_path)
    all_lines: list[str] = []
    for page in doc:
        all_lines.extend(_visual_lines(page))
    # 문제N 헤더 키워드로만 골라내므로 섹션 분리 불필요(이론엔 문제N 없음)
    prac = "\n".join(
        ln.strip() for ln in all_lines if ln.strip() and not _JUNK_LINE.match(ln.strip())
    )

    # 문제N 블록 분리 후 헤더 키워드로 포함 여부 결정.
    heads = list(re.finditer(r"^문제(\d+)", prac, re.MULTILINE))
    out: list[dict] = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(prac)
        block = prac[h.start():end]
        header = block[: block.find("[1]")] if "[1]" in block else block[:200]
        if "오류" in header or "수정, 삭제" in header:
            continue  # 오류수정
        if "일반전표입력" in header:
            category = "실무분개"
        elif "결산" in header:
            category = "결산"
        else:
            continue  # 기초정보·매입매출전표·조회 등 프로그램 조작형

        # [n] 항목 분리: stem = [답] 전, answer = [답] 후. ㆍ로 시작하는 꼬리줄은 해설.
        items = list(re.finditer(r"^\[(\d+)\]", block, re.MULTILINE))
        for j, it in enumerate(items):
            iend = items[j + 1].start() if j + 1 < len(items) else len(block)
            body = block[it.end():iend]
            ans = re.search(r"\[답\]", body)
            if not ans:
                continue
            stem = body[: ans.start()].strip()
            # 지시문 뒤에 어음·계산서 등 서식이 붙는 경우: (N점) 뒤 잔여 텍스트를
            # [[서식]] 마커로 분리해 웹에서 박스로 렌더링한다.
            pm = re.search(r"\s*\((\d+)점\)", stem)
            if pm:
                instruction = stem[: pm.start()].strip()
                form = stem[pm.end():].strip()
                stem = f"{instruction}\n[[서식]]\n{form}" if form else instruction
            answer_body = body[ans.end():].strip()
            ans_lines = answer_body.split("\n")
            exp_start = next(
                (k for k, ln in enumerate(ans_lines) if ln.startswith("ㆍ")),
                len(ans_lines),
            )
            # 줄 구조 보존(차/대 분개 행 정렬). 시각 줄 기준이라 그대로 읽힌다.
            answer_text = "\n".join(ln.strip() for ln in ans_lines[:exp_start]).strip()
            # 표 레이아웃 잔재 정리: '12,540,000 원' → '12,540,000원'
            answer_text = re.sub(r"(\d)\s+원", r"\1원", answer_text)
            answer_text = re.sub(r"원(\s+원)+", "원", answer_text)
            explanation = "\n".join(ans_lines[exp_start:]).strip() or None
            if not stem or not answer_text:
                continue
            out.append(
                {
                    "subject": subject,
                    "category": category,
                    # 분개는 계정과목이 답에 있어 stem+답으로 분류(예: 단기매매증권 처분)
                    "type_tag": (tag := classify(stem + " " + answer_text)),
                    "area": area_of(tag),
                    "stem": stem,
                    "choices": None,       # 4지선다 보기 생성은 별도 단계
                    "answer_idx": None,
                    "answer_text": answer_text,
                    "explanation": explanation,
                    "source": source,
                }
            )
    return out


# ---------------------------------------------------------------------------
# 실행 모드
# ---------------------------------------------------------------------------
def run_all() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    pdfs = sorted(RAW_DIR.glob("*확정답안*.pdf"))
    if not pdfs:
        raise SystemExit("raw/ 에 확정답안 PDF 없음. fetch_comcbt.py 먼저 실행.")

    all_ok: list[dict] = []
    all_failed: list[dict] = []
    for pdf in pdfs:
        try:
            ok, failed = parse_answer_pdf(pdf)
        except ValueError as e:
            print(f"[{pdf.name}] 파일 단위 실패: {e}")
            all_failed.append({"source": pdf.name, "number": None, "reason": str(e), "block": ""})
            continue
        prac = parse_practical(pdf)
        n_exp = sum(1 for q in ok if q["explanation"])
        n_bunk = sum(1 for q in prac if q["category"] == "실무분개")
        n_close = sum(1 for q in prac if q["category"] == "결산")
        print(
            f"[{pdf.name}] 이론 {len(ok)}/15, 해설 {n_exp}/{len(ok)}, "
            f"분개 {n_bunk}, 결산 {n_close}, 실패 {len(failed)}"
        )
        for f in failed:
            print(f"    실패 {f['number']}번: {f['reason']}")
        all_ok.extend(ok)
        all_ok.extend(prac)
        all_failed.extend(failed)

    _write(all_ok, all_failed)


def run_retry() -> None:
    failed_path = OUT_DIR / "failed.json"
    if not failed_path.exists():
        raise SystemExit("failed.json 없음")
    prev_failed = json.loads(failed_path.read_text(encoding="utf-8"))
    questions = json.loads((OUT_DIR / "questions.json").read_text(encoding="utf-8"))

    still: list[dict] = []
    for f in prev_failed:
        if not f["block"]:
            still.append(f)
            continue
        try:
            q = parse_block(f["number"], f["block"])
        except ValueError as e:
            f["reason"] = str(e)
            still.append(f)
            continue
        subject = f["source"].split()[0]
        questions.append(
            {
                "subject": subject,
                "category": "이론",
                "type_tag": (tag := classify(q["stem"])),
                "area": area_of(tag),
                "stem": q["stem"],
                "choices": q["choices"],
                "answer_idx": q["answer_idx"],
                "explanation": q["explanation"],
                "source": f["source"],
            }
        )
        print(f"재파싱 성공: {f['source']} {f['number']}번")
    _write(questions, still)


def _write(questions: list[dict], failed: list[dict]) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "questions.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "failed.json").write_text(
        json.dumps(failed, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    tags = {}
    for q in questions:
        tags[q["type_tag"]] = tags.get(q["type_tag"], 0) + 1
    print(f"\n합계: 성공 {len(questions)}, 실패 {len(failed)}")
    print("type_tag 분포:", dict(sorted(tags.items(), key=lambda x: -x[1])))


def selftest() -> None:
    block = (
        "3. 다음 중 유형자산의 감가상각에 대한 설명으로 적절하지 않은 것은?\n"
        "①\n②\n③\n④\n"
        "가나다\n라마바\n사아자\n차카타\n"
        "[답] ① 해설입니다."
    )
    q = parse_block(3, block)
    assert q["stem"].startswith("다음 중 유형자산"), q["stem"]
    assert q["choices"] == ["가나다", "라마바", "사아자", "차카타"], q["choices"]
    assert q["answer_idx"] == 0
    assert q["explanation"] == "해설입니다."
    inline = "5. 질문?\n① 하나 ② 둘 ③ 셋 ④ 넷\n[답] ②"
    q2 = parse_block(5, inline)
    assert q2["choices"] == ["하나", "둘", "셋", "넷"], q2["choices"]
    assert q2["answer_idx"] == 1 and q2["explanation"] is None
    assert classify("감가상각 어쩌고") == "감가상각"
    assert classify("아무 관련 없는 문장") == "미분류"
    print("selftest OK")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--retry-failed", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        selftest()
    elif args.retry_failed:
        run_retry()
    else:
        run_all()
