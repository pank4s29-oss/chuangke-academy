-- A teacher can answer several independent copies of the same course.
-- A workspace is the named container for one complete course attempt.
create table if not exists public.assignment_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_key text not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assignment_workspaces enable row level security;
drop policy if exists "users manage own assignment workspaces" on public.assignment_workspaces;
create policy "users manage own assignment workspaces" on public.assignment_workspaces
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

alter table public.submissions add column if not exists workspace_id uuid references public.assignment_workspaces(id) on delete cascade;
create index if not exists submissions_workspace_idx on public.submissions(workspace_id, stage_key, task_key);
create index if not exists assignment_workspaces_owner_idx on public.assignment_workspaces(owner_id, updated_at desc);

-- The original contract had UNIQUE(user_id, stage_key, task_key), which
-- would prevent one owner from creating a second named copy of a stage.
-- Replace it with separate legacy and workspace-scoped uniqueness rules.
do $$
declare
  old_constraint text;
begin
  select conname into old_constraint
  from pg_constraint
  where conrelid = 'public.submissions'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (user_id, stage_key, task_key)'
  limit 1;
  if old_constraint is not null then
    execute format('alter table public.submissions drop constraint %I', old_constraint);
  end if;
end;
$$;

create unique index if not exists submissions_legacy_user_task_unique
  on public.submissions(user_id, stage_key, task_key)
  where workspace_id is null;

drop trigger if exists assignment_workspaces_updated_at on public.assignment_workspaces;
create trigger assignment_workspaces_updated_at before update on public.assignment_workspaces
  for each row execute function public.touch_updated_at();

-- New workspace-scoped rows must be unique. Existing legacy rows remain usable
-- until the owner creates a named workspace, so this migration is non-destructive.
create unique index if not exists submissions_workspace_task_unique
  on public.submissions(workspace_id, stage_key, task_key)
  where workspace_id is not null;

comment on table public.assignment_workspaces is 'Named independent course attempts owned by a teacher or learner.';
comment on column public.submissions.workspace_id is 'Named assignment workspace that owns this task submission.';
