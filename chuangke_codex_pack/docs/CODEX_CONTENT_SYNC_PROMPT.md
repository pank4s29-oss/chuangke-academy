# Codex Prompt｜實作 GitHub Markdown → Supabase Draft 自動匯入

請先閱讀：

- `AGENTS.md`
- `docs/TASKS.md`
- `docs/COURSE_CONTENT_IMPORT_GUIDE.md`
- `docs/CONTENT_SYNC_SPEC.md`
- `.github/workflows/content-sync.yml`

不要修改教材內容本身。

---

# 目標

把原本架構上的：

```text
Markdown → Import → Draft → Preview → Validate → Publish
```

真正實作成日常可用的：

```text
GitHub 新增／修改 Markdown
        ↓
GitHub Actions
        ↓
自動解析與 Import
        ↓
Supabase Draft
        ↓
Admin Preview / Validate
        ↓
人工 Publish
```

完成後，內容管理者的日常操作應該是：

> 新增／修改 `content/source/stage-XX/*.md` → commit → push 到 `main`。

不得需要建立新的 React Stage page。

---

# 一、先做 Repository Audit

先檢查：

1. package manager
2. Next.js / React / TypeScript 版本
3. 現有 Supabase client / schema / migrations
4. 現有 content parser / importer
5. 現有 content version schema
6. 現有 admin UI
7. 現有 publish flow
8. 現有 tests
9. 現有 environment variables
10. 現有 GitHub Actions

如果現有實作已經存在，優先擴充，而不是重複建立第二套 importer。

---

# 二、實作 Content Import CLI

Repository 必須提供：

```bash
npm run content:import -- \
  --manifest .content-sync/manifest.json \
  --mode draft \
  --report .content-sync/import-report.json
```

入口可為：

```text
scripts/content/import-cli.ts
```

也可以採用你認為更好的目錄，但 package.json 必須提供：

```json
{
  "scripts": {
    "content:import": "..."
  }
}
```

CLI 要支援：

```text
--manifest
--mode draft
--report
```

若 `--mode` 不是 `draft`，在 GitHub content sync context 中直接拒絕。

---

# 三、Importer 必須按 Stage 完整重建 Draft

不要只把被改動的單一 Markdown 檔案寫進 database。

例如：

```text
content/source/stage-02/lecture.md   ← 修改
```

Importer 應辨識：

```text
affected stage = stage-02
```

然後重新讀取：

```text
content/source/stage-02/lecture.md
content/source/stage-02/assignment.md
```

重建完整 canonical stage content。

目的：避免 Draft 只有 lecture 沒有 assignment，或反過來。

---

# 四、實作 Change Manifest

Workflow 會傳入：

```text
.content-sync/manifest.json
```

Importer 必須讀取：

- `commitSha`
- `runId`
- `eventName`
- `entries[]`
- status：A/M/D/R/C

至少能正確辨識受到影響的 `stage-XX`。

刪除或 rename 時不得因為 source 不存在而直接 crash；應進入明確的 Draft / Warning / failed 流程。

---

# 五、Supabase Schema

如果專案尚未具備完整的 import audit schema，請建立必要 migrations。

至少需要能追蹤：

```text
content_import_jobs
content_versions / published versions
source_file metadata
source_hash
parser_version
warnings / errors
```

Import Job 至少保存：

```text
repository
commit_sha
workflow_run_id
workflow_run_url
mode
status
manifest
started_at
completed_at
warning_count
error_count
```

Content Version 至少保存：

```text
stage_id
version
status
source_file_set
source_hash
parser_version
content_json
import_job_id
created_at
```

請依現有 schema 調整命名；不要為了這個需求平行建立互相重複的 content version system。

---

# 六、CI 暫存資料夾

Workflow 會產生：

```text
.content-sync/
```

請加入 `.gitignore`，不得把 manifest / report 當成課程 source commit 回 repository。

---

# 七、Idempotency

同一份 source 不應因 workflow retry 產生無限多個重複 Draft。

建立可靠的 deduplication identity，例如：

```text
stage_id + source_hash + parser_version
```

同一組 identity 重跑時：

```text
reuse / update existing draft
```

而不是：

```text
create draft v101
create draft v102
create draft v103
```

---

# 八、Source Hash

對每個 Stage 的完整 source set 建立 deterministic hash。

至少涵蓋：

```text
lecture.md
assignment.md
以及該 Stage 被 importer 定義為 source 的其他 Markdown
```

檔案順序必須 deterministic。

推薦：

```text
sorted file paths
→ normalized content bytes
→ SHA-256
```

不要只 hash GitHub commit SHA；因為同一個 commit 可能包含其他與內容無關的程式碼變更。

---

# 九、Parser / Normalizer

沿用既有 content parser architecture。

如果沒有，建立：

```text
lib/content/parser
lib/content/normalizer
lib/content/importer
```

Parser 不可綁 React。

Import 流程：

```text
Markdown
→ AST
→ Canonical JSON
→ Structural Validation
→ Draft Persistence
```

禁止：

```text
Markdown
→ AI猜測
→ 修改教材
```

---

# 十、Validation

Importer 至少執行：

### 結構驗證

- stage identity
- lesson order
- task order
- step identity
- question_key uniqueness

### 關聯驗證

- dependency target exists
- navigation target exists
- validation rule target exists
- artifact mapping target exists

### 來源完整性

- lecture exists when required
- assignment exists when required
- source file hash exists
- parser version exists

### Fatal vs Warning

Fatal：不能可靠執行的結構問題。

Warning：可以保存 Draft、但需要人工 Preview 確認的問題。

不要自行猜測。

---

# 十一、Draft Publish Boundary

這個 workflow 永遠只能建立：

```text
status = draft
```

不要在 `content:import` 裡自動呼叫：

```text
publish
activate
set_current_version
```

除非系統已有完全獨立、經過授權的 publish service，而且本 workflow 明確被設計成只呼叫 draft import。

本需求的預設行為：

> Import 自動化；Publish 人工確認。

---

# 十二、環境變數

建立或更新 `.env.example`：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

規則：

```text
NEXT_PUBLIC_* → browser-safe only
SUPABASE_SECRET_KEY → server / GitHub Actions only
```

不得把 secret key 暴露到 client bundle。

不要把 secret 寫入 log / report / database plaintext metadata。

---

# 十三、GitHub Actions

保留並完成：

```text
.github/workflows/content-sync.yml
```

Workflow 必須：

1. 只監聽 `main` 的 `content/source/**/*.md` push。
2. 支援 `workflow_dispatch`。
3. 可指定單一 stage 重跑。
4. 建立 change manifest。
5. 執行 `npm ci`。
6. 執行 `npm run content:import`。
7. 缺少 Supabase secrets 時直接失敗。
8. importer 失敗時 workflow 必須 failed。
9. 永不 publish。
10. 上傳 import report。
11. 使用最小 GitHub permission：`contents: read`。
12. 不在 workflow log 印 secret。

不要把 token 寫死在 yaml。

---

# 十四、GitHub Secrets

部署前需要設定：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

優先使用目前 Supabase 的 secret key 命名與能力；若現有專案仍使用 legacy `service_role`，可以做相容層，但新流程請統一以：

```text
SUPABASE_SECRET_KEY
```

為 canonical environment variable。

---

# 十五、刪除與 Rename

### Delete

GitHub source 被刪除：

```text
source deleted
→ Draft state / warning
→ no automatic publish
```

Published content 不得被 workflow 直接刪除。

### Rename

保留：

```text
oldPath
newPath
```

作為 audit metadata。

不要因為檔名改變而擅自產生全新的 question_key。

---

# 十六、Admin UI

確認 Admin 能看到：

```text
Import Jobs
Draft Versions
Warnings
Source Commit
Source Hash
Parser Version
```

至少能從：

```text
/admin/content
```

看到：

```text
Stage 2
Draft
Imported from commit abc123
Warning: 2
```

並進入 Preview。

---

# 十七、測試

至少建立：

## Unit

- changed file → affected stage detection
- manifest parsing
- source hash deterministic
- idempotency
- warning / fatal classification
- delete handling
- rename handling

## Integration

測試：

```text
Markdown
→ importer
→ Supabase Draft
```

確認：

- Draft created
- Published untouched
- import job recorded
- source hash recorded
- warnings recorded

## E2E

模擬：

```text
修改 stage-02/lecture.md
→ push
→ workflow
→ import
→ Draft visible in Admin
→ Published version unchanged
```

再測：

```text
修改 stage-02/assignment.md
→ 同一 Stage 重新組裝
```

再測：

```text
Delete source file
→ Draft / warning
→ Published untouched
```

---

# 十八、不要做的事

不要：

- 新增 Stage3Page.tsx
- 新增 Stage4Page.tsx
- 把 Stage ID 寫死在 workflow
- 把課程題目 hardcode 在 importer
- 修改使用者提供的教材文字
- 自動 Publish
- 加入 AI Coach
- 使用 AI 生成學生答案
- 用 AI 語意判分
- 把 secret key 放 frontend

---

# 十九、完成後回報

使用：

```md
## Implementation Summary

### Changed
- ...

### Database
- ...

### Content Sync
- ...

### GitHub Actions
- ...

### Admin
- ...

### Tests
- lint: PASS/FAIL
- typecheck: PASS/FAIL
- unit: PASS/FAIL
- integration: PASS/FAIL
- e2e: PASS/FAIL
- build: PASS/FAIL

### Verification
- ...

### Known Issues
- ...

### Next Step
- ...
```

最重要的驗收問題：

> **現在我只要把新的 `lecture.md` + `assignment.md` 放進 `content/source/stage-XX/`、push 到 main，是否真的可以自動在 Supabase 建立 Draft，而不需要新增任何 React page？**

只有當答案為「是」，這個 task 才算完成。
