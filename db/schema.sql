-- acct_quiz 스키마. Supabase SQL Editor에 통째로 붙여넣어 실행.
-- 재실행 안전(idempotent).

-- 문제 은행. 파이프라인(service_role)이 쓰고, 웹은 읽기만.
create table if not exists questions (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,                  -- 전산회계1급 | 전산회계2급 | 전산세무2급
  category     text not null,                  -- 이론 | 실무분개 | 결산
  type_tag     text not null default '미분류',
  area         text not null default '재무회계',  -- 재무회계 | 원가회계 | 부가가치세 | 소득세
  stem         text not null unique,           -- 중복 적재 방지. upsert 충돌 키
  choices      jsonb,                          -- 이론: ["보기1",...4개]. 실무: null
  answer_idx   int check (answer_idx between 0 and 3),  -- 실무: null
  answer_text  text,                           -- 실무 정답(분개). 이론: null
  explanation  text,
  source       text,                           -- 예: 전산회계1급 125회
  created_at   timestamptz default now(),
  -- 이론은 4지선다 필수, 실무는 answer_text 필수
  check (
    (choices is not null and answer_idx is not null)
    or answer_text is not null
  )
);

-- 풀이 기록. 오답노트 재료.
create table if not exists attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  question_id  uuid not null references questions on delete cascade,
  chosen_idx   int not null check (chosen_idx between 0 and 3),
  is_correct   bool not null,
  created_at   timestamptz default now()
);

-- 문제 신고 (F8)
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  question_id  uuid not null references questions on delete cascade,
  reason       text not null,   -- 정답오류 | 보기깨짐 | 해설오류 | 기타
  memo         text,
  created_at   timestamptz default now()
);

-- (subject, type_tag)별 문항수 집계. PostgREST 1000행 캡 회피용.
create or replace view question_tag_counts
with (security_invoker = true) as
select subject, area, type_tag, count(*)::int as count
from questions
group by subject, area, type_tag;

create index if not exists questions_subject_tag on questions (subject, type_tag);
create index if not exists attempts_user_correct on attempts (user_id, is_correct);

-- RLS
alter table questions enable row level security;
alter table attempts enable row level security;
alter table reports enable row level security;

drop policy if exists "public read" on questions;
create policy "public read" on questions for select using (true);
-- questions 쓰기 정책 없음 = anon/authenticated 쓰기 불가. service_role만 적재.

drop policy if exists "own read" on attempts;
create policy "own read" on attempts for select using (auth.uid() = user_id);
drop policy if exists "own write" on attempts;
create policy "own write" on attempts for insert with check (auth.uid() = user_id);

drop policy if exists "report write" on reports;
create policy "report write" on reports for insert with check (auth.uid() = user_id);
-- reports select 정책 없음 = 운영자만 대시보드(service_role)에서 확인.
