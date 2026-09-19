-- Assignment file imports and consultant advice.
-- Prerequisite: run 202609180003_task_submissions_contract.sql first.
-- This migration also creates the teacher helper if 202609180004_teacher_review.sql
-- has not been applied yet, so it can be safely retried after a partial setup.
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing public.profiles. Run 202609180003_task_submissions_contract.sql first.';
  end if;
  if to_regclass('public.submissions') is null then
    raise exception 'Missing public.submissions. Run 202609180003_task_submissions_contract.sql first.';
  end if;
end;
$$;

alter table public.profiles add column if not exists role text not null default 'student' check (role in ('student','teacher'));

create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

create table if not exists public.assignment_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  stage_key text not null,
  file_name text not null,
  file_type text not null,
  source_text text not null,
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.assignment_imports enable row level security;

drop policy if exists "students manage own imports" on public.assignment_imports;
create policy "students manage own imports" on public.assignment_imports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "teachers manage imports" on public.assignment_imports;
create policy "teachers manage imports" on public.assignment_imports
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

alter table public.submissions add column if not exists consultant_advice text;
alter table public.submissions add column if not exists imported_file_id uuid references public.assignment_imports(id) on delete set null;

drop policy if exists "teachers update advice" on public.submissions;
create policy "teachers update advice" on public.submissions
  for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());
