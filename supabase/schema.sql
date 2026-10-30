create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0 and xp < 100),
  completed_count integer not null default 0 check (completed_count >= 0),
  badges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null check (category_id in ('indonesia', 'ipas', 'matematika')),
  package_number smallint not null check (package_number in (1, 2, 3)),
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  correct_count integer not null check (correct_count >= 0),
  incorrect_count integer not null check (incorrect_count >= 0),
  partial_count integer not null default 0 check (partial_count >= 0),
  question_count integer not null check (question_count > 0),
  coins_earned integer not null default 50 check (coins_earned >= 0),
  created_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "Users read own progress" on public.user_progress;
create policy "Users read own progress" on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own progress" on public.user_progress;
create policy "Users insert own progress" on public.user_progress for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own progress" on public.user_progress;
create policy "Users update own progress" on public.user_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users read own attempts" on public.quiz_attempts;
create policy "Users read own attempts" on public.quiz_attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users add own attempts" on public.quiz_attempts;
create policy "Users add own attempts" on public.quiz_attempts for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_progress to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant usage, select on sequence public.quiz_attempts_id_seq to authenticated;
