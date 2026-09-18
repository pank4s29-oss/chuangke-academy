-- Auth users live in Supabase's managed auth.users table. This public profile
-- table is the safe application-facing extension and has the same primary key.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The static task engine identifies stages by stable keys. Keep the original
-- stage_id for published content, but allow task progress before publishing.
alter table public.progress alter column stage_id drop not null;
alter table public.progress add column if not exists course_key text;
alter table public.progress add column if not exists stage_key text;
create unique index if not exists progress_user_stage_key on public.progress(user_id, stage_key);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_key text not null,
  stage_key text not null,
  task_key text not null,
  status text not null default 'draft' check (status in ('draft','completed')),
  answer_json jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, stage_key, task_key)
);
alter table public.submissions enable row level security;
drop policy if exists "students manage own submissions" on public.submissions;
create policy "students manage own submissions" on public.submissions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists progress_updated_at on public.progress;
create trigger progress_updated_at before update on public.progress for each row execute function public.touch_updated_at();
drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at before update on public.submissions for each row execute function public.touch_updated_at();
