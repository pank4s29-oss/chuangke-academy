-- Teacher-managed question copy. The Markdown source remains the baseline;
-- overrides are intentionally limited to learner-facing prompts, descriptions,
-- and option labels so question identity/answer keys remain stable.
create table if not exists public.question_overrides (
  id uuid primary key default gen_random_uuid(),
  stage_key text not null,
  task_key text not null,
  field_key text not null,
  prompt text,
  description text,
  options jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(stage_key, task_key, field_key)
);

create table if not exists public.question_override_history (
  id uuid primary key default gen_random_uuid(),
  override_id uuid,
  stage_key text not null,
  task_key text not null,
  field_key text not null,
  prompt text,
  description text,
  options jsonb,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('update','delete'))
);

alter table public.question_overrides enable row level security;
alter table public.question_override_history enable row level security;

drop policy if exists "everyone can read question overrides" on public.question_overrides;
create policy "everyone can read question overrides" on public.question_overrides
  for select to anon, authenticated using (true);
drop policy if exists "teachers manage question overrides" on public.question_overrides;
create policy "teachers manage question overrides" on public.question_overrides
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "teachers read question override history" on public.question_override_history;
create policy "teachers read question override history" on public.question_override_history
  for select to authenticated using (public.is_teacher());

create or replace function public.record_question_override_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_override_history
    (override_id, stage_key, task_key, field_key, prompt, description, options, changed_by, action)
  values
    (old.id, old.stage_key, old.task_key, old.field_key, old.prompt, old.description, old.options,
     coalesce(auth.uid(), old.updated_by), case when tg_op = 'DELETE' then 'delete' else 'update' end);
  return old;
end;
$$;

drop trigger if exists question_override_history_trigger on public.question_overrides;
create trigger question_override_history_trigger
before update or delete on public.question_overrides
for each row execute function public.record_question_override_history();

create index if not exists question_overrides_stage_idx on public.question_overrides(stage_key, task_key);
create index if not exists question_override_history_lookup_idx on public.question_override_history(stage_key, task_key, field_key, changed_at desc);
comment on table public.question_overrides is 'Teacher-editable learner-facing question copy; stable field keys remain in source content.';
comment on table public.question_override_history is 'Append-only prior versions of teacher question edits for audit and recovery.';
