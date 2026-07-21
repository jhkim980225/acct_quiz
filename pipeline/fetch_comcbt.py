"""comcbt 게시판에서 회차 기출 첨부(zip/hwp)를 내려받아 raw/ 에 저장.

사용:
    python fetch_comcbt.py            # 전산회계1급(h1) 최신 2개 회차
    python fetch_comcbt.py --board h1 --count 2

이미 받은 파일은 스킵. zip 이면 풀어서 .hwp 만 남긴다.
"""

from __future__ import annotations

import argparse
import re
import zipfile
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.comcbt.com"
RAW_DIR = Path(__file__).parent / "raw"
HEADERS = {"User-Agent": "Mozilla/5.0 (acct-quiz pipeline; personal study tool)"}

BOARDS = {  # 게시판 코드 → subject 라벨
    "h1": "전산회계1급",
    "h2": "전산회계2급",
    "h3": "전산세무2급",
}


def list_posts(session: requests.Session, board: str) -> list[tuple[str, str]]:
    """게시판 첫 페이지의 (제목, 글URL) 목록. 최신순."""
    resp = session.get(f"{BASE}/xe/{board}", timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    posts: list[tuple[str, str]] = []
    seen: set[str] = set()
    # XE 게시판 글 링크: /xe/<board>/<숫자>
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        m = re.search(rf"/xe/{board}/(\d+)$", href)
        title = a.get_text(strip=True)
        if m and title and m.group(1) not in seen:
            seen.add(m.group(1))
            posts.append((title, urljoin(BASE, href)))
    return posts


def find_attachment(session: requests.Session, post_url: str) -> tuple[str, str] | None:
    """글 페이지에서 (파일명, 다운로드URL) 하나 추출. 없으면 None."""
    resp = session.get(post_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for a in soup.select("a[href*='procFileDownload']"):
        name = a.get_text(strip=True)
        if name:
            return name, urljoin(BASE, a["href"])
    return None


def download(session: requests.Session, url: str, dest: Path) -> None:
    resp = session.get(url, timeout=120)
    resp.raise_for_status()
    if len(resp.content) < 1000:  # 에러 페이지 방어
        raise RuntimeError(f"다운로드 실패(응답 {len(resp.content)}B): {url}")
    dest.write_bytes(resp.content)


def extract_hwp_from_zip(zip_path: Path, dest_dir: Path) -> list[Path]:
    """zip 에서 .hwp/.hwpx/.pdf 를 꺼낸다(한글 파일명 cp437→cp949 보정)."""
    out: list[Path] = []
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename
            if info.flag_bits & 0x800 == 0:  # UTF-8 플래그 없으면 cp949 추정
                try:
                    name = name.encode("cp437").decode("cp949")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass
            suffix = Path(name).suffix.lower()
            if suffix not in (".hwp", ".hwpx", ".pdf"):
                continue
            target = dest_dir / Path(name).name
            if not target.exists():
                target.write_bytes(zf.read(info))
            out.append(target)
    return out


def sanitize(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--board", default="h1", choices=BOARDS)
    ap.add_argument("--count", type=int, default=2, help="최신 N개 회차")
    args = ap.parse_args()

    RAW_DIR.mkdir(exist_ok=True)
    session = requests.Session()
    session.headers.update(HEADERS)

    posts = list_posts(session, args.board)
    if not posts:
        raise SystemExit("글 목록을 못 찾음. 게시판 구조 변경 여부 확인 필요.")

    picked = posts[: args.count]
    print(f"[{BOARDS[args.board]}] 대상 {len(picked)}개:")
    for title, post_url in picked:
        att = find_attachment(session, post_url)
        if att is None:
            print(f"  SKIP (첨부 없음): {title}")
            continue
        fname, dl_url = att
        dest = RAW_DIR / sanitize(fname)
        if dest.exists():
            print(f"  캐시: {dest.name}")
        else:
            print(f"  다운로드: {fname} ...")
            download(session, dl_url, dest)
        if dest.suffix.lower() == ".zip":
            files = extract_hwp_from_zip(dest, RAW_DIR)
            for f in files:
                print(f"    -> {f.name}")


if __name__ == "__main__":
    main()
