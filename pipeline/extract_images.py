"""기출 PDF(A형)에서 '그림 자료가 있는 문제'를 찾아 그 자료 영역을 PNG로 캡처.

왜 영역 캡처인가: PDF 속 증빙(현금영수증·사업자등록증 등)은 표·텍스트·로고 이미지의
합성이라 임베디드 이미지만 뽑으면 로고 조각만 나온다. 문제 블록부터 다음 문제 전까지를
페이지 렌더로 잘라야 사람이 보던 그림 그대로 나온다.

사용:
    python extract_images.py --pdf "raw/제111회 전산회계2급 A형.pdf" --source "전산회계2급 111회"

출력:
    out/images/<source>/q_p<페이지>_<n>.png   (2배 해상도)
    out/images/<source>.json → [{file, page, q_text}]  (q_text = 문제 블록 첫 200자 — DB stem 매칭용)

대상 선별: 본문 영역에 '콘텐츠 이미지'(장식 아닌 임베디드 이미지)가 있는 문제만.
  장식 = 여러 페이지 반복 xref / 높이 25pt·폭 100pt 미만 / 머리글·꼬리글 위치.

적재는 acct_rag 쪽 scripts/import-bank-images.ts (규칙: docs/문제은행-적재-규칙.md).
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(__file__).parent / "out" / "images"
ZOOM = 2  # 캡처 해상도 배율


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--source", required=True, help='예: "전산회계2급 111회"')
    args = ap.parse_args()

    doc = fitz.open(args.pdf)
    out_dir = OUT / args.source
    out_dir.mkdir(parents=True, exist_ok=True)

    xref_pages: Counter[int] = Counter()
    for page in doc:
        for im in page.get_images(full=True):
            xref_pages[im[0]] += 1
    decorative = {x for x, n in xref_pages.items() if n >= 3}

    results = []
    n_out = 0
    for pno, page in enumerate(doc):
        # 문제 시작 블록 (이론 "N." / 실무 "[N]") — y 오름차순
        blocks = [(b[1], b[3], (b[4] or "").strip()) for b in page.get_text("blocks")]
        qblocks = sorted(
            (y0, y1, t) for y0, y1, t in blocks
            if re.match(r"^(\d{1,2}\.|\[\d{1,2}\])\s", t)
        )
        choiceys = sorted(y0 for y0, _, t in blocks if t.startswith("①"))

        # 이 페이지의 콘텐츠 이미지 위치
        content_rects = []
        for im in page.get_images(full=True):
            if im[0] in decorative:
                continue
            for r in page.get_image_rects(im[0]):
                if r.height < 25 or r.width < 100:
                    continue
                if r.y0 > 745 or r.y1 < 135:
                    continue
                content_rects.append(r)

        # 이미지가 속한 문제 영역을 캡처 (문제 블록 y ~ 다음 문제 블록 y)
        done_q = set()
        for r in content_rects:
            above = [q for q in qblocks if q[0] <= r.y0]
            if not above:
                continue  # 문제 블록을 못 찾으면 스킵 (페이지 걸침 등 — 수동 확인)
            q_y, q_y1, q_text = above[-1]
            if q_y in done_q:
                continue
            done_q.add(q_y)
            # 캡처는 자료(증빙)만: 문제 문장 끝 ~ 선택지(①) 시작. 텍스트는 stem에 이미 있다.
            next_q = [y0 for y0, _, _ in qblocks if y0 > q_y]
            limit = next_q[0] if next_q else 760
            chs = [y for y in choiceys if q_y1 < y < limit]
            end_y = (chs[0] - 2) if chs else limit
            clip = fitz.Rect(30, q_y1 + 2, page.rect.width - 30, min(max(end_y, r.y1 + 8), 760))
            pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=clip)
            n_out += 1
            fname = f"q_p{pno + 1}_{n_out}.png"
            pix.save(out_dir / fname)
            results.append({
                "file": fname,
                "page": pno + 1,
                "q_text": re.sub(r"\s+", " ", q_text)[:200],
            })

    (OUT / f"{args.source}.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{args.source}: 캡처 {len(results)}개 → {out_dir}")
    for x in results:
        print(f"  p{x['page']} {x['file']}  <- {x['q_text'][:60]}")


if __name__ == "__main__":
    main()
