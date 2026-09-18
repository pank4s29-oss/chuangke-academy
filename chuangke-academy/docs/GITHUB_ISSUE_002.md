# GitHub Issue #002｜Content Sync：GitHub Markdown 自動建立 Supabase Draft

## Objective

把課程內容日常維護流程正式自動化：

```text
GitHub Markdown
→ push main
→ GitHub Actions
→ Change Manifest
→ Content Importer
→ Supabase Draft
```

正式 Publish 仍由 Admin 明確執行。

## Context

創客學院採 Content-driven Architecture。

新增／修改 Stage、Lesson、Task、Step、Question 時，不應要求建立新的 React Page。

目前 Starter Pack v2 已包含：

```text
.github/workflows/content-sync.yml
docs/CONTENT_SYNC_SPEC.md
docs/CODEX_CONTENT_SYNC_PROMPT.md
docs/CONTENT_SYNC_SETUP.md
```

本 Issue 的工作是讓實際 application repository 完成 workflow 所需要的 runtime importer 與 Supabase persistence。

## Requirements

### 1. Import CLI

提供：

```bash
npm run content:import -- \
  --manifest .content-sync/manifest.json \
  --mode draft \
  --report .content-sync/import-report.json
```

### 2. Affected Stage

Workflow 可能傳入：

- A
- M
- D
- R
- C

Importer 必須推導 affected Stage。

只要 Stage 的任一 source 改變，就重新載入該 Stage 完整 source set。

### 3. Draft Persistence

Importer 必須建立／更新 Draft Content Version。

不得修改目前 Published Version。

### 4. Idempotency

同一：

```text
stage_id + source_hash + parser_version
```

不可因 workflow retry 產生無限重複 Draft。

### 5. Audit

保留：

- repository
- commit_sha
- workflow_run_id
- workflow_run_url
- source_file_set
- source_hash
- parser_version
- warnings
- errors
- status

### 6. Failure

Fatal import error：

```text
Action = failed
Draft = not publishable
Report = retained
```

不可 catch 後回傳 exit 0。

### 7. Security

使用：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Secret key 只能 server-side / GitHub Actions 使用。

Workflow permission：

```text
contents: read
```

不得把 secret 寫入 log。

### 8. Manual Re-import

`workflow_dispatch` 支援：

```text
stage-02
```

重新從 GitHub 當前 source 建立／同步 Draft。

## Acceptance Criteria

### AC1 — 修改

```text
修改 stage-02/lecture.md
→ push main
→ workflow PASS
→ 新 Draft
→ Published 不變
```

### AC2 — 新增 Stage

```text
新增 stage-03/lecture.md
新增 stage-03/assignment.md
→ push main
→ Stage 3 Draft
```

### AC3 — 完整 Stage 重建

只修改：

```text
stage-02/lecture.md
```

Draft 仍必須包含目前完整的：

```text
lecture.md
assignment.md
```

### AC4 — Idempotency

同一 commit workflow retry 不產生無限 duplicate Draft。

### AC5 — Delete

刪除 source：

```text
automatic import
→ Draft / Warning
→ Published untouched
```

### AC6 — Rename

rename 不得無故破壞既有 question_key identity。

### AC7 — Manual rerun

指定 `stage-02` 可重新 Import，不必修改 Markdown。

### AC8 — No stage-specific UI

新增 Stage 不需要：

```text
Stage3Page.tsx
Stage4Page.tsx
```

## Non-goals

不要：

- 自動 Publish
- AI Coach
- AI semantic grading
- 修改教材原意
- 直接寫 Production Published Version
- 建立 Stage 專屬 React page

## Suggested Implementation Order

1. Audit existing importer
2. Add / adapt import job schema
3. Implement manifest parsing
4. Implement affected Stage detection
5. Implement deterministic source hash
6. Implement Draft upsert + idempotency
7. Implement warning / fatal status
8. Connect `.github/workflows/content-sync.yml`
9. Add Admin import history
10. Add tests
11. Run end-to-end verification

## Definition of Done

內容管理者可以：

```text
新增／修改 Markdown
→ push main
```

然後在不修改任何 React Stage page 的情況下，在 Supabase Admin Content 中看到新的 Draft。
