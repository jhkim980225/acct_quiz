"""out/questions.json → Supabase questions 테이블 upsert (중복 stem 스킵).

준비:
    1. supabase.com 프로젝트 생성
    2. SQL Editor에서 db/schema.sql 실행
    3. 프로젝트 루트 .env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 기입

사용:
    python load_supabase.py
"""

from __future__ import annotations

import json
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT = Path(__file__).parent / "out" / "questions.json"


def load_env() -> dict[str, str]:
    env_path = ROOT / ".env"
    if not env_path.exists():
        raise SystemExit(".env 없음. .env.example 참고해서 만들 것.")
    env: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.split("#")[0].strip()
    return env


def main() -> None:
    env = load_env()
    url = env.get("SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key or "xxxxx" in url:
        raise SystemExit(".env 의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인.")

    rows = json.loads(OUT.read_text(encoding="utf-8"))
    # 회차 간 동일 문제 재출제 → 배치 내 중복 stem 제거(첫 항목 유지)
    seen: set[str] = set()
    deduped = []
    for r in rows:
        if r["stem"] not in seen:
            seen.add(r["stem"])
            deduped.append(r)
    if len(deduped) < len(rows):
        print(f"배치 내 중복 stem {len(rows) - len(deduped)}건 제거")
    rows = deduped
    # 테이블 컬럼만, 전 행 동일 키로 (PostgREST 일괄 insert 요건)
    cols = ("subject", "category", "type_tag", "stem", "choices",
            "answer_idx", "answer_text", "explanation", "source")
    payload = [{k: r.get(k) for k in cols} for r in rows]

    resp = requests.post(
        f"{url}/rest/v1/questions?on_conflict=stem",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            # merge: 같은 stem 재적재 시 type_tag·해설 등 갱신 반영
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=payload,
        timeout=60,
    )
    if resp.status_code >= 300:
        raise SystemExit(f"업로드 실패 {resp.status_code}: {resp.text[:500]}")

    # 적재 후 카운트 확인
    cnt = requests.get(
        f"{url}/rest/v1/questions?select=id",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Prefer": "count=exact", "Range": "0-0"},
        timeout=30,
    )
    total = cnt.headers.get("content-range", "?").split("/")[-1]
    print(f"업로드 시도 {len(payload)}건, 테이블 총 {total}건 (중복 stem 스킵됨)")


if __name__ == "__main__":
    main()
