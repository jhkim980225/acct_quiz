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

## 데이터 모델 (핵심 2 테이블)
- `questions(id, subject, category, type_tag, stem, choices jsonb, answer_idx, explanation, source)`
- `attempts(id, user_id, question_id, chosen_idx, is_correct, created_at)` — 오답노트 재료. RLS: 본인 행만.

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
