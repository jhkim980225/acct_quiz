# CLAUDE.md — acct_quiz 프로젝트 컨텍스트

Claude Code가 이 저장소에서 작업할 때 항상 참고하는 기준 문서.

## 프로젝트 한 줄 요약
전산회계 1급·2급, 세무 2급 기출을 **토큰 0으로 파싱**해 4지선다 연습 툴로 제공하는 웹앱.
차별점은 텍스트가 아니라 **기능**(실무분개 4지선다 채점 · 유형별 필터 · 오답노트).
수익은 유형별 정리 페이지 애드센스(목표 하루 약 1,000원).

설계 원문: `docs/superpowers/specs/2026-07-21-전산회계-문제은행-design.md`

## 하드 룰 (절대)
1. **토큰 0**: 문제·해설을 LLM으로 생성/재작성 금지. 오직 추출 → 규칙분류 → 발행.
2. **comcbt 클론 금지**: 기출 원문 통짜 나열로 SEO 노리지 않는다. 개별 문제는 comcbt가 원본이라 복사본은 구글 중복 필터에서 짐.
3. **오리지널리티는 기능·구조**: 유형별 재구성 + 인터랙티브 채점 + 오답노트. 애드센스는 "기능성 퀴즈 툴"로 통과 노림.
4. **비밀정보 커밋 금지**: Supabase 키·서비스롤·세션은 `.env`, `.gitignore` 준수.

## 스택
- Next.js (App Router) + Supabase(Postgres/Auth/RLS) + Vercel 무료 배포.

## 데이터 모델
- `questions(id, subject, category, type_tag, area, stem unique, choices jsonb null, answer_idx null, answer_text null, explanation, source)` — 이론은 choices+answer_idx, 실무(분개·결산)는 answer_text. area = 재무회계|원가회계|부가가치세|소득세 (type_tag의 함수)
- `attempts(id, user_id, question_id, chosen_idx, is_correct, created_at)` — 오답노트 재료. RLS: 본인 행만.
- `reports(id, user_id, question_id, reason, memo)` — 문제 신고. insert만 본인.
- 뷰 `question_tag_counts(subject, type_tag, count)` — 집계용(PostgREST 1000행 캡 회피)

## 현황 (2026-07-21)
- 배포: https://acct-quiz.vercel.app (Vercel, `web/` 루트). main 푸시 후 `vercel --prod --yes`로 배포.
- 데이터: 3과목(전산회계1·2급, 전산세무2급) × 86~125회 = **2,065문항** 적재.
  108회 이후=공식 PDF(이론+분개+결산), 86~110회=HWP(이론만 — 실무는 자동번호 소실로 제외.
  86~98회는 정답표가 숫자형·보기 인라인형 구형식이라 전용 폴백으로 파싱).
- SEO: 서치콘솔 등록·sitemap 제출 완료(2026-07-21). 다음 = 색인 확인 후 애드센스 신청(M4).
- 구글 OAuth 라이브 (GCP mychat 프로젝트의 acct-quiz 클라이언트, In production).
- 파이프라인 실행: `pipeline/` 에서 `python fetch_comcbt.py --board h1|h2|h3 --count N` → `python parse_questions.py` → `python load_supabase.py` (merge upsert, stem 충돌 시 갱신).
- QA 하네스: `qa_gate.py`가 파싱 끝·업로드 전 이중 게이트(깨진 문항 있으면 exit 2 / 업로드 거부, `--selftest` 있음). 웹은 `npm run lint`(no-console 강제)·`npm test`·`npm run perf`(배포 속도 임계)·`npm run soak`(로컬 RSS·지연 드리프트 = 누수 증상).

4개 기능 매핑:
- 실무분개/이론 = `category` 필터
- 유형별 = `type_tag` 필터
- 오답정리 = `attempts where is_correct=false`

## 페이지 (수익 동선)
- `/[subject]/[type_tag]` (SSG, 익명) — 유형별 정리. **구글 유입+애드센스 = 돈줄.**
- `/quiz` (익명 허용) — 4지선다 채점, 익명은 localStorage.
- `/wrong` (로그인 필요) — 오답노트.
- `/` (SSG) — 색인 허브.
- 로그인은 **오답노트에만.** 풀이·정리는 익명 허용(유입 안 막음).

## 콘텐츠 파이프라인 (토큰 0)
추출(comcbt/기출PDF 파싱) → 분류(키워드 규칙으로 type_tag) → Supabase upsert(중복 stem 스킵).
분류는 정확도보다 커버리지 우선, 미매칭은 `type_tag=미분류`.

## 작업 원칙
- 작은 단위·명확한 인터페이스. 파일 커지면 책임 분리.
- 비trivial 로직(채점·파싱·RLS)엔 실행 가능한 체크 하나 남긴다.
- 애드센스·저작권 리스크는 설계 문서 4장 참고. 원문 통짜 노출 피하고 유형 재구성으로.
