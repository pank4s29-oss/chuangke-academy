# 創客學院｜Codex Starter Pack v2

這一版在原本的 Content-driven Course Engine 架構上，正式加入：

> **GitHub Markdown → GitHub Actions → Supabase Draft**

讓課程內容維護從「架構上可以做到」進一步變成「日常真的只要丟檔案、Push 就能自動跑」。

## 包含

- `AGENTS.md`：Codex 長期專案規則
- `docs/GITHUB_ISSUE_001.md`：第一個 MVP GitHub Issue
- `docs/GITHUB_ISSUE_002.md`：Content Sync 自動匯入 GitHub Issue
- `docs/TASKS.md`：開發 Task Board
- `docs/COURSE_CONTENT_IMPORT_GUIDE.md`：新增課程內容規格
- `docs/CONTENT_SYNC_SPEC.md`：GitHub → Supabase Draft 技術規格
- `docs/CODEX_CONTENT_SYNC_PROMPT.md`：給 Codex 的自動匯入實作 Prompt
- `docs/CONTENT_SYNC_SETUP.md`：第一次啟用、Secrets 與日常操作
- `docs/CODEX_FIRST_PROMPT.md`：第一輪 repository / architecture planning prompt
- `.github/workflows/content-sync.yml`：GitHub Markdown 自動匯入 Draft 的 workflow
- `CHANGELOG.md`：Starter Pack v2 變更紀錄
- `content/source/stage-02/`：目前已提供的階段二原始教材
- `content/source/stage-01/`：階段一預留目錄

## 這一版的完整流程

> 注意：本 Starter Pack 已把 GitHub Actions entrypoint 做好，但實際 application repository 還需要完成 `content:import` 與 Supabase Draft persistence；完成後才是完整可執行鏈路。

```text
                 ┌───────────────────┐
                 │ GitHub Markdown   │
                 │ lecture/assignment│
                 └─────────┬─────────┘
                           │ push main
                           ▼
                 ┌───────────────────┐
                 │ GitHub Actions     │
                 │ content-sync.yml   │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Change Manifest    │
                 │ A/M/D/R/C          │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Content Importer   │
                 │ Parse/Normalize    │
                 │ Validate/Hash      │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Supabase Draft     │
                 │ Version + Warnings│
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Admin Preview      │
                 │ Validate          │
                 └─────────┬─────────┘
                           │ manual publish
                           ▼
                 ┌───────────────────┐
                 │ Published Content │
                 └─────────┬─────────┘
                           │
                           ▼
                    創客學院前台
```

## 日常操作

未來新增 Stage 3：

```text
content/source/stage-03/lecture.md
content/source/stage-03/assignment.md
```

然後：

```bash
git add content/source/stage-03
git commit -m "content: add stage 03"
git push origin main
```

GitHub Actions 會自動建立 Draft。

你不需要：

- 新增 Stage3Page.tsx
- 修改 CoursePage 的 stage if/else
- 手動執行 parser
- 直接修改 production content

## 重要邊界

這個 Starter Pack **提供的是自動化規格、workflow 與 Codex 實作指令**。真正執行時，仍需要 Codex 在你的實際 application repository 中完成：

- `content:import` CLI
- Supabase schema / migrations
- Content Importer
- Admin Draft Preview
- Publish flow
- Tests

完成以上實作與 GitHub Secrets 設定後，才是真正的：

> **只要丟 Markdown、Push，就會自動進 Supabase Draft。**

## Security

GitHub Actions 使用：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

Secret key 只允許 server-side / GitHub Actions 使用，不得暴露到 frontend。

## 下一份 Prompt

第一次建立專案：

```text
docs/CODEX_FIRST_PROMPT.md
```

要把自動 Content Sync 真正做起來：

```text
docs/CODEX_CONTENT_SYNC_PROMPT.md
```
