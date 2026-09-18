-- Teacher review support. Set selected profiles.role to 'teacher' after migration.
alter table public.profiles add column if not exists role text not null default 'student' check (role in ('student','teacher'));
alter table public.submissions add column if not exists review_status text not null default 'pending' check (review_status in ('pending','approved','needs_revision'));
alter table public.submissions add column if not exists teacher_feedback text;
alter table public.submissions add column if not exists graded_at timestamptz;
alter table public.submissions add column if not exists graded_by uuid references auth.users(id);

-- The original profile policy was intentionally broad for the student MVP. Remove
-- it here so a student cannot update their own role to become a teacher.
drop policy if exists "users manage own profile" on public.profiles;
create policy "students read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));

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

create policy "teachers read profiles" on public.profiles for select to authenticated using (public.is_teacher());
create policy "teachers read all submissions" on public.submissions for select to authenticated using (public.is_teacher() or user_id = (select auth.uid()));
create policy "teachers grade submissions" on public.submissions for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy "teachers read student answers" on public.answers for select to authenticated using (public.is_teacher() or user_id = (select auth.uid()));
