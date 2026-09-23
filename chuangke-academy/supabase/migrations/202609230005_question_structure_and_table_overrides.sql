-- Extend teacher question overrides from copy-only edits to safe structural edits.
-- Source Markdown remains immutable; custom fields are stored here and merged at runtime.
alter table public.question_overrides add column if not exists is_deleted boolean not null default false;
alter table public.question_overrides add column if not exists is_custom boolean not null default false;
alter table public.question_overrides add column if not exists table_key text;
alter table public.question_overrides add column if not exists table_title text;
alter table public.question_overrides add column if not exists table_row text;
alter table public.question_overrides add column if not exists table_column text;

alter table public.question_override_history add column if not exists is_deleted boolean;
alter table public.question_override_history add column if not exists is_custom boolean;
alter table public.question_override_history add column if not exists table_key text;
alter table public.question_override_history add column if not exists table_title text;
alter table public.question_override_history add column if not exists table_row text;
alter table public.question_override_history add column if not exists table_column text;

create or replace function public.record_question_override_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_override_history
    (override_id, stage_key, task_key, field_key, prompt, description, options, field_type, multiple, sort_order,
     is_deleted, is_custom, table_key, table_title, table_row, table_column, changed_by, action)
  values
    (old.id, old.stage_key, old.task_key, old.field_key, old.prompt, old.description, old.options, old.field_type, old.multiple, old.sort_order,
     old.is_deleted, old.is_custom, old.table_key, old.table_title, old.table_row, old.table_column,
     coalesce(auth.uid(), old.updated_by), case when tg_op = 'DELETE' then 'delete' else 'update' end);
  return old;
end;
$$;

comment on column public.question_overrides.is_deleted is 'Soft-delete flag for source questions; preserves answer history and allows restore.';
comment on column public.question_overrides.is_custom is 'True when the row represents a teacher-created question not present in source Markdown.';
comment on column public.question_overrides.table_title is 'Teacher-editable title displayed above a table assignment.';

create index if not exists question_overrides_custom_idx on public.question_overrides(stage_key, task_key, is_custom, is_deleted, sort_order);
create index if not exists question_overrides_table_idx on public.question_overrides(stage_key, task_key, table_key);

-- Keep Realtime updates available to learner and teacher surfaces.
do $$
begin
  alter publication supabase_realtime add table public.question_override_history;
exception when duplicate_object then null;
end;
$$;
