-- Teachers can create a submission on behalf of a selected learner after importing a filled assignment.
create policy "teachers create submissions" on public.submissions
  for insert to authenticated
  with check (public.is_teacher());

-- Keep imported files attributable to the teacher while assigning them to a learner.
create index if not exists assignment_imports_stage_user_idx on public.assignment_imports(stage_key, user_id);
