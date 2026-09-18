# 創客學院｜Codex 開發 Task Board

## Epic 0｜Repository Foundation

- [ ] T0.1 Audit repository
- [ ] T0.2 Confirm framework / package manager
- [ ] T0.3 Create/update `AGENTS.md`
- [ ] T0.4 Establish folder structure
- [ ] T0.5 Add `.env.example`
- [ ] T0.6 Add README architecture overview

## Epic 1｜Supabase Foundation

- [ ] T1.1 Create course content schema
- [ ] T1.2 Create student answer schema
- [ ] T1.3 Create progress schema
- [ ] T1.4 Create artifact schema
- [ ] T1.5 Create content version schema
- [ ] T1.6 Create RLS policies
- [ ] T1.7 Create migrations
- [ ] T1.8 Verify with test queries

## Epic 2｜Content Engine

- [ ] T2.1 Define canonical content JSON model
- [ ] T2.2 Build Markdown AST parser
- [ ] T2.3 Build canonical normalizer
- [ ] T2.4 Build import warning system
- [ ] T2.5 Store source Markdown + hash
- [ ] T2.6 Build draft content import
- [ ] T2.7 Build preview rendering
- [ ] T2.8 Build publish workflow

## Epic 3｜Question Engine

- [ ] T3.1 Question schema
- [ ] T3.2 QuestionRenderer
- [ ] T3.3 single_select
- [ ] T3.4 multi_select
- [ ] T3.5 text / textarea
- [ ] T3.6 number
- [ ] T3.7 checkbox
- [ ] T3.8 matrix
- [ ] T3.9 drag_and_drop (future-ready)
- [ ] T3.10 sentence_builder (future-ready)

## Epic 4｜Rules Engine

- [ ] T4.1 Validation rule schema
- [ ] T4.2 Navigation rule schema
- [ ] T4.3 Conditional visibility
- [ ] T4.4 Redirect / retry path
- [ ] T4.5 Completion rule evaluator

## Epic 5｜Answer Engine

- [ ] T5.1 Autosave
- [ ] T5.2 Save state indicator
- [ ] T5.3 Retry on transient failure
- [ ] T5.4 Answer version compatibility
- [ ] T5.5 Answer dependency loader
- [ ] T5.6 Source reference UI

## Epic 6｜Progress Engine

- [ ] T6.1 Course progress
- [ ] T6.2 Stage progress
- [ ] T6.3 Task progress
- [ ] T6.4 Step progress
- [ ] T6.5 Last location
- [ ] T6.6 Resume learning

## Epic 7｜Student UI

- [ ] T7.1 `/app`
- [ ] T7.2 Course page
- [ ] T7.3 Stage map
- [ ] T7.4 Stage dashboard
- [ ] T7.5 Learning workspace
- [ ] T7.6 Practice workspace
- [ ] T7.7 Review screen
- [ ] T7.8 Result screen
- [ ] T7.9 Blueprint screen
- [ ] T7.10 Responsive mobile UI

## Epic 8｜Stage 1 / Stage 2 Import

### Stage 1

- [ ] T8.1 Place lecture Markdown into `content/source/stage-01/`
- [ ] T8.2 Place assignment Markdown into `content/source/stage-01/`
- [ ] T8.3 Parse
- [ ] T8.4 Review warnings
- [ ] T8.5 Preview
- [ ] T8.6 Publish

### Stage 2

- [x] T8.7 Place lecture Markdown into `content/source/stage-02/`
- [x] T8.8 Place assignment Markdown into `content/source/stage-02/`
- [ ] T8.9 Parse
- [ ] T8.10 Review warnings
- [ ] T8.11 Preview
- [ ] T8.12 Publish
- [ ] T8.13 Verify complete Stage 2 flow

## Epic 9｜Blueprint / Artifacts

- [ ] T9.1 Artifact schema
- [ ] T9.2 Blueprint data mapping
- [ ] T9.3 Automatic blueprint generation
- [ ] T9.4 Export / print-friendly view

## Epic 10｜Admin

- [ ] T10.1 Admin authorization
- [ ] T10.2 Content list
- [ ] T10.3 Import screen
- [ ] T10.4 Draft preview
- [ ] T10.5 Validation report
- [ ] T10.6 Publish
- [ ] T10.7 Version history
- [ ] T10.8 Import warnings

## Epic 11｜QA

- [ ] T11.1 Unit tests
- [ ] T11.2 Integration tests
- [ ] T11.3 E2E student flow
- [ ] T11.4 E2E admin import flow
- [ ] T11.5 Mobile verification
- [ ] T11.6 Production build
- [ ] T11.7 Vercel preview verification

## Epic 12｜Future Content Operations

- [ ] T12.1 Document “How to add a new stage”
- [ ] T12.2 Add a new stage using Markdown only
- [ ] T12.3 Verify no application code changes
- [ ] T12.4 Verify published stage appears automatically
- [ ] T12.5 Verify old content versions remain accessible to existing attempts

## Epic 13｜GitHub Content Sync → Supabase Draft

> 這個 Epic 是 Starter Pack v2 新增的自動化能力。Starter Pack 提供 workflow 與規格；下列 Task 需要在實際 application repository 中由 Codex 完成。

- [ ] T13.1 Define `content:import` CLI contract
- [ ] T13.2 Build / extend `content_import_jobs` persistence
- [ ] T13.3 Build change manifest parser
- [ ] T13.4 Detect affected Stage from A/M/D/R/C changes
- [ ] T13.5 Rebuild full Stage source set on partial file change
- [ ] T13.6 Deterministic source hashing
- [ ] T13.7 Idempotent Draft upsert
- [ ] T13.8 Draft-only guard; never auto-publish
- [ ] T13.9 Warning / fatal error reporting
- [ ] T13.10 Delete / rename handling
- [ ] T13.11 GitHub Actions secrets and permissions
- [ ] T13.12 `workflow_dispatch` Stage re-import
- [ ] T13.13 Import report artifact
- [ ] T13.14 Admin import-job / draft history
- [ ] T13.15 Unit / integration / E2E tests
- [ ] T13.16 Verify “Markdown push → Supabase Draft” end-to-end
