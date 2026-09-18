# 創客學院｜Content Sync 實際啟用步驟

## 啟用後的日常操作

日常不需要手動執行 Import。

你只需要：

```text
1. 修改／新增 Markdown
2. git add
3. git commit
4. git push origin main
```

接著：

```text
GitHub Actions
   ↓
Content Sync
   ↓
Supabase Draft
   ↓
Admin Preview
   ↓
Validate
   ↓
Publish
```

---

# 一、第一次建置：讓 Codex 完成實作

先讓 Codex 讀：

```text
AGENTS.md
docs/CONTENT_SYNC_SPEC.md
docs/CODEX_CONTENT_SYNC_PROMPT.md
.github/workflows/content-sync.yml
```

然後使用：

```text
docs/CODEX_CONTENT_SYNC_PROMPT.md
```

要求 Codex 完成：

- importer CLI
- Supabase schema / migration
- idempotency
- source hash
- import jobs
- Draft version
- Admin import history
- tests

---

# 二、GitHub Secrets

在 GitHub repository：

```text
Settings
→ Secrets and variables
→ Actions
```

建立：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

這兩個值不可以放進：

- Git
- `.env` committed file
- frontend code
- workflow yaml 明文

---

# 三、Supabase

確認專案已經有：

- content tables
- content versions
- import jobs
- source hash metadata
- RLS / authorization

GitHub Actions 使用 server-side secret key 執行 Draft import。

Published content 的公開／學員讀取流程仍使用正常 frontend-safe Supabase key。

---

# 四、第一次測試

先不要直接用 Stage 3。

推薦先修改一個小範圍的 Stage 2 source，例如：

```text
content/source/stage-02/lecture.md
```

只改一個不影響教材意義的格式或標點測試。

Push 後檢查：

```text
GitHub Actions = PASS
Supabase = 新 Draft
Admin = 看得到 Draft
Published Version = 沒被改掉
```

確認後再開始正式內容維護。

---

# 五、測試手動重新 Import

到 GitHub：

```text
Actions
→ Content Sync - Markdown to Supabase Draft
→ Run workflow
```

可以：

```text
stage = stage-02
```

這會重新從目前 GitHub source 建立／同步 Stage 2 Draft。

用途包括：

- Parser 更新
- 資料修復
- workflow 重跑
- migration 後補資料

---

# 六、未來新增 Stage 3

建立：

```text
content/source/stage-03/lecture.md
content/source/stage-03/assignment.md
```

Push：

```text
git add content/source/stage-03
git commit -m "content: add stage 03"
git push origin main
```

系統應自動：

```text
detect stage-03
→ parse
→ validate
→ create draft
```

不需要：

```text
Stage3Page.tsx
Stage3TaskPage.tsx
CoursePage if(stage === 3)
```

---

# 七、正式發布

自動 Import **不是** 自動 Publish。

正確流程是：

```text
GitHub
  ↓
Draft
  ↓
Admin Preview
  ↓
Warnings / Validation
  ↓
人工確認
  ↓
Publish
```

原因很單純：

> Markdown push 是內容修改動作；Publish 是正式產品發布動作。

兩者應該分開。

---

# 八、日常真正的使用體驗

完成整套系統後，你的工作方式會從：

```text
改教材
→ 找工程師
→ 改 React
→ 改題目
→ 改資料庫
→ 測頁面
→ 部署
```

變成：

```text
改 Markdown
→ Push
→ 自動 Draft
→ Preview
→ Publish
```

而新增 Stage 的成本應逐步接近「新增兩個 Markdown 檔案」。

---

# 九、推薦實作 Issue

若用 GitHub Issue 驅動 Codex：

```text
docs/GITHUB_ISSUE_002.md
```

這個 Issue 專門負責把 Starter Pack v2 的 workflow 與規格，接到實際 application 的 Importer / Supabase / Admin。
