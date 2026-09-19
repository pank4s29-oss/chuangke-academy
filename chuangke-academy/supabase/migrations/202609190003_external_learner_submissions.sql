-- Imported assignments may belong to a learner who does not have an account.
-- Teachers identify that learner by a private display name instead of auth.users.
alter table public.submissions alter column user_id drop not null;
alter table public.submissions add column if not exists learner_name text;
alter table public.assignment_imports add column if not exists learner_name text;

-- Existing student submissions remain account-owned. Teacher-created imports may
-- use learner_name with a null user_id and are protected by teacher RLS.
drop policy if exists "teachers delete submissions" on public.submissions;
create policy "teachers delete submissions" on public.submissions
  for delete to authenticated using (public.is_teacher());

drop policy if exists "teachers delete imports" on public.assignment_imports;
create policy "teachers delete imports" on public.assignment_imports
  for delete to authenticated using (public.is_teacher());

create index if not exists submissions_learner_name_idx on public.submissions(learner_name);
