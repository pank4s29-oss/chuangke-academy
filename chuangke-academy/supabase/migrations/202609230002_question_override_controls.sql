alter table public.question_overrides add column if not exists field_type text check (field_type in ('checkboxes','single_choice','text','textarea'));
alter table public.question_overrides add column if not exists multiple boolean;
alter table public.question_overrides add column if not exists sort_order integer;

alter table public.question_override_history add column if not exists field_type text;
alter table public.question_override_history add column if not exists multiple boolean;
alter table public.question_override_history add column if not exists sort_order integer;

create or replace function public.record_question_override_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_override_history
    (override_id, stage_key, task_key, field_key, prompt, description, options, field_type, multiple, sort_order, changed_by, action)
  values
    (old.id, old.stage_key, old.task_key, old.field_key, old.prompt, old.description, old.options, old.field_type, old.multiple, old.sort_order,
     coalesce(auth.uid(), old.updated_by), case when tg_op = 'DELETE' then 'delete' else 'update' end);
  return old;
end;
$$;

comment on column public.question_overrides.field_type is 'Teacher-selected presentation type; maps to the stable AssignmentField type at runtime.';
comment on column public.question_overrides.sort_order is 'Zero-based order within the task; stable field keys remain unchanged.';
