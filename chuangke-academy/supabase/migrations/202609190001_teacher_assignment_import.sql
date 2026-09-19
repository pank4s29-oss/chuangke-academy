-- Teachers can create a submission on behalf of a selected learner after importing a filled assignment.
-- Prerequisites: run 202609180003_task_submissions_contract.sql and
-- 202609180005_imports_and_advice.sql first.
do $$
begin
  if to_regclass('public.submissions') is null then
    raise exception 'Missing public.submissions. Run 202609180003_task_submissions_contract.sql first.';
  end if;
  if to_regclass('public.assignment_imports') is null then
    raise exception 'Missing public.assignment_imports. Run 202609180005_imports_and_advice.sql first.';
  end if;
  if to_regprocedure('public.is_teacher()') is null then
    raise exception 'Missing public.is_teacher(). Run 202609180004_teacher_review.sql or 202609180005_imports_and_advice.sql first.';
  end if;
end;
$$;

drop policy if exists "teachers create submissions" on public.submissions;
create policy "teachers create submissions" on public.submissions
  for insert to authenticated
  with check (public.is_teacher());

-- Keep imported files attributable to the teacher while assigning them to a learner.
create index if not exists assignment_imports_stage_user_idx on public.assignment_imports(stage_key, user_id);
