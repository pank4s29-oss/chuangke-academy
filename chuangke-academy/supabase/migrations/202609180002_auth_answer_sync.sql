-- Allows the current static/content-engine MVP to sync answers before
-- published content_versions are wired to the Markdown importer.
alter table public.answers alter column content_version_id drop not null;
alter table public.answers add column if not exists stage_key text;
create unique index if not exists answers_user_stage_question_key on public.answers(user_id, stage_key, question_key);

-- Keep the original version-aware RLS and make the new stage key available to
-- the authenticated student's own rows only.
comment on column public.answers.stage_key is 'Canonical stage key used by the student workspace until published content versions are connected.';
