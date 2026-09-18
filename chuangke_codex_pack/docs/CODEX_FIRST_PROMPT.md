# Codex First Prompt

請先閱讀 repository root 的 `AGENTS.md`。

接著閱讀：

- `docs/GITHUB_ISSUE_001.md`
- `docs/TASKS.md`
- `docs/COURSE_CONTENT_IMPORT_GUIDE.md`
- `content/README.md`

目前原始課程素材位於：

`content/source/stage-02/`

請先以 Ask / Planning Mode 完成：

1. Repository audit
2. Architecture plan
3. Supabase schema plan
4. Content model plan
5. Markdown parser plan
6. Question Engine plan
7. Validation / Navigation plan
8. Answer Dependency plan
9. Progress plan
10. Admin / Import / Publish plan
11. Testing plan
12. Vercel deployment plan

確認架構可以支援未來：

`Stage 3 / Stage 4 / Stage 5 / Stage 6`

而無須為每個階段建立新的 React page。

尤其請驗證：

> 新增 `lecture.md` + `assignment.md` → Import → Draft → Preview → Validate → Publish → Website 自動顯示。

不要加入 AI Coach，也不要修改教材內容。

完成規劃後先不要實作，回報 plan 與 risk list。

---

## Starter Pack v2：請額外驗證自動 Content Sync

另外閱讀：

- `docs/CONTENT_SYNC_SPEC.md`
- `docs/CODEX_CONTENT_SYNC_PROMPT.md`
- `docs/CONTENT_SYNC_SETUP.md`
- `.github/workflows/content-sync.yml`

在 architecture plan 中新增：

13. GitHub Content Sync architecture
14. Change Manifest contract
15. `content:import` CLI contract
16. Supabase Draft idempotency
17. Draft-only security boundary
18. Import job / report model
19. GitHub Secrets / permissions
20. Delete / rename handling

尤其請驗證：

```text
修改 content/source/stage-02/lecture.md
→ git push origin main
→ GitHub Actions
→ npm run content:import
→ Supabase Draft
→ Published Version untouched
```

以及：

```text
新增 content/source/stage-03/lecture.md
新增 content/source/stage-03/assignment.md
→ git push origin main
→ 自動建立 Stage 3 Draft
```

不要把 GitHub Action 實作成直接 Publish。

不要使用 AI 解析或修改教材內容。

完成規劃後，若 repository 尚未具備 `content:import`、Supabase import schema、Admin Draft Preview，請把它們列為實作 Task，而不是聲稱已經具備。
