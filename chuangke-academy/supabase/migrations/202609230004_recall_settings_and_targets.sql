-- Teacher-controlled recall configuration. One learner field may recall many target fields.
create table if not exists public.recall_settings (
  stage_key text not null,
  task_key text not null,
  field_key text not null,
  enabled boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (stage_key, task_key, field_key)
);

create table if not exists public.recall_targets (
  stage_key text not null,
  task_key text not null,
  field_key text not null,
  target_stage_key text not null,
  target_task_key text not null,
  target_field_key text not null,
  position integer not null default 0,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (stage_key, task_key, field_key, target_stage_key, target_task_key, target_field_key)
);

alter table public.recall_settings enable row level security;
alter table public.recall_targets enable row level security;

drop policy if exists "everyone can read recall settings" on public.recall_settings;
create policy "everyone can read recall settings" on public.recall_settings for select to anon, authenticated using (true);
drop policy if exists "teachers manage recall settings" on public.recall_settings;
create policy "teachers manage recall settings" on public.recall_settings for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "everyone can read recall targets" on public.recall_targets;
create policy "everyone can read recall targets" on public.recall_targets for select to anon, authenticated using (true);
drop policy if exists "teachers manage recall targets" on public.recall_targets;
create policy "teachers manage recall targets" on public.recall_targets for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

do $$
begin
  alter publication supabase_realtime add table public.recall_settings;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.recall_targets;
exception when duplicate_object then null;
end;
$$;
