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
create policy "students manage own imports" on public.assignment_imports for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "teachers manage imports" on public.assignment_imports for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

alter table public.submissions add column if not exists consultant_advice text;
alter table public.submissions add column if not exists imported_file_id uuid references public.assignment_imports(id) on delete set null;

create policy "teachers update advice" on public.submissions for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
