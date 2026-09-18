# Changelog

## Starter Pack v2 — 2026-09-18

新增 GitHub → Supabase Draft 自動內容同步規格與 workflow：

- `.github/workflows/content-sync.yml`
- `docs/CONTENT_SYNC_SPEC.md`
- `docs/CODEX_CONTENT_SYNC_PROMPT.md`
- `docs/CONTENT_SYNC_SETUP.md`

並同步更新：

- `AGENTS.md`
- `docs/CODEX_FIRST_PROMPT.md`
- `docs/COURSE_CONTENT_IMPORT_GUIDE.md`
- `docs/TASKS.md`
- `content/README.md`
- `README.md`

核心變化：

```text
GitHub Markdown
→ GitHub Actions
→ Change Manifest
→ Content Importer
→ Supabase Draft
```

正式 Publish 仍與自動 Import 分離。

## 注意

Starter Pack v2 的 workflow 是實作規格與 automation entrypoint；實際 application repository 仍需要由 Codex 完成 `content:import` CLI、Supabase schema / migration、Draft persistence、Admin Preview / Publish 與測試。
