-- Admin is a separate role from teacher. Existing student/teacher accounts remain valid.
do $$
declare
  role_constraint text;
begin
  select conname into role_constraint
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%';
  if role_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', role_constraint);
  end if;
end;
$$;
alter table public.profiles add constraint profiles_role_check check (role in ('student','teacher','admin'));

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_admin_or_teacher()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or public.is_teacher();
$$;
revoke all on function public.is_admin_or_teacher() from public;
grant execute on function public.is_admin_or_teacher() to authenticated;

-- Any authenticated account may delete its own workspace and its own submissions.
-- Imported/teacher-owned records continue to be protected by their existing owner
-- rules; this applies to newly created user-owned assignment workspaces.
drop policy if exists "users delete own assignment workspaces" on public.assignment_workspaces;
create policy "users delete own assignment workspaces" on public.assignment_workspaces
  for delete to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "users delete own submissions" on public.submissions;
create policy "users delete own submissions" on public.submissions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The starter schema already contains these normalized content tables. This
-- migration adds the policies and seeds the two filesystem-backed stages so
-- the Admin workflow has stable rows to manage.
insert into public.courses (course_key, title) values ('maker-academy', '創客學院')
on conflict (course_key) do nothing;
insert into public.stages (course_id, stage_key, title, position)
select c.id, v.stage_key, v.title, v.position
from public.courses c
cross join (values ('stage-01','階段一',1), ('stage-02','階段二',2)) as v(stage_key,title,position)
where c.course_key = 'maker-academy'
on conflict (course_id, stage_key) do nothing;

alter table public.content_versions enable row level security;
alter table public.content_import_jobs enable row level security;
alter table public.content_import_jobs add column if not exists stage_key text;
drop policy if exists "admins manage content versions" on public.content_versions;
create policy "admins manage content versions" on public.content_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage import jobs" on public.content_import_jobs;
create policy "admins manage import jobs" on public.content_import_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "everyone reads published content versions" on public.content_versions;
create policy "everyone reads published content versions" on public.content_versions
  for select to anon, authenticated using (status = 'published');

-- Published content is deliberately append-only by version: Admin publishes a
-- new row and archives the previous row instead of mutating history.
create index if not exists content_versions_stage_status_idx on public.content_versions(stage_id, status, version_number desc);
create index if not exists content_import_jobs_created_idx on public.content_import_jobs(started_at desc);

-- Let the learner UI receive an override update while a task is open.
do $$
begin
  alter publication supabase_realtime add table public.question_overrides;
exception when duplicate_object then null;
end;
$$;
