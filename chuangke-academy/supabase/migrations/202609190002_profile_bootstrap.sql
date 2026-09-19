-- Ensure every authenticated user has an application profile. This is required by
-- the teacher dashboard, which authorizes through public.profiles.role.
-- Prerequisite: run 202609180003_task_submissions_contract.sql first.
do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing public.profiles. Run 202609180003_task_submissions_contract.sql first.';
  end if;
end;
$$;

alter table public.profiles add column if not exists role text not null default 'student' check (role in ('student','teacher'));

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Backfill accounts that were created before this trigger was installed.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', email)
from auth.users
on conflict (id) do nothing;
