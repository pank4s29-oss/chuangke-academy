create table if not exists public.recall_target_overrides (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  target_stage_key text not null,
  target_task_key text not null,
  target_field_key text not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.recall_target_overrides enable row level security;
drop policy if exists "everyone can read recall target overrides" on public.recall_target_overrides;
create policy "everyone can read recall target overrides" on public.recall_target_overrides
  for select to anon, authenticated using (true);
drop policy if exists "teachers manage recall target overrides" on public.recall_target_overrides;
create policy "teachers manage recall target overrides" on public.recall_target_overrides
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

do $$
begin
  alter publication supabase_realtime add table public.recall_target_overrides;
exception when duplicate_object then null;
end;
$$;
