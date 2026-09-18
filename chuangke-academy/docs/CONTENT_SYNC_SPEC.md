# 創客學院｜GitHub → Supabase Draft 自動匯入規格

## 1. 這一版解決什麼問題

原本的架構雖然定義了：

```text
Markdown → Import → Draft → Preview → Validate → Publish
```

但如果沒有 GitHub Actions，日常操作仍然需要人工執行 Import。

本規格把第一段自動化：

```text
你新增／修改 Markdown
        ↓
GitHub push 到 main
        ↓
GitHub Actions 自動偵測變更
        ↓
建立 content change manifest
        ↓
Parser / Importer
        ↓
Supabase Draft
        ↓
Admin Preview / Validate
        ↓
管理者 Publish
```

因此日常內容維護可以縮短成：

> **改 Markdown → commit → push。**

正式上線仍保留 Publish 閘門。

---

## 2. 本 workflow 的責任

`.github/workflows/content-sync.yml` 只負責：

1. 偵測 `content/source/**/*.md` 的新增、修改、刪除、rename/copy。
2. 產生變更 manifest。
3. 呼叫 repository 的通用 Content Importer。
4. 將解析後內容建立／更新為 Supabase Draft。
5. 保存 source hash / commit / import job metadata。
6. 上傳 import report 供除錯。

本 workflow **不得**：

- 直接 Publish
- 修改 Production Published Version
- 把 Draft 直接切成 Published
- 在 GitHub Action 裡重寫教材內容
- 以 AI 自動產生教材答案

---

## 3. 為什麼按 Stage 建立 Draft，而不是按單一 Markdown 檔案建立 Draft

同一個 Stage 通常有：

```text
lecture.md
assignment.md
```

當其中一個檔案修改時，系統應該重新組裝該 Stage 的完整 canonical content，而不是讓 `lecture.md` 和 `assignment.md` 各自變成互相獨立的版本。

例如：

```text
stage-02/lecture.md      修改
stage-02/assignment.md   未修改
         ↓
重新讀取 stage-02 目前兩份 source
         ↓
Stage 2 Draft v-next
```

這可避免 Draft 中只有半套教材。

---

## 4. Change Manifest

Workflow 會建立：

```text
.content-sync/manifest.json
```

格式：

```json
{
  "schemaVersion": 1,
  "mode": "draft",
  "repository": "owner/repo",
  "commitSha": "abc123...",
  "runId": "123456",
  "runNumber": "42",
  "serverUrl": "https://github.com",
  "workflow": "Content Sync - Markdown to Supabase Draft",
  "eventName": "push",
  "manualStage": null,
  "entries": [
    {
      "status": "M",
      "path": "content/source/stage-02/lecture.md"
    }
  ]
}
```

status 支援：

- `A`：新增
- `M`：修改
- `D`：刪除
- `R`：rename
- `C`：copy

Importer 必須能處理刪除與 rename，不可只支援新增。

---

## 5. Repository 暫存目錄

Workflow 產生的：

```text
.content-sync/
```

是 CI 暫存資料，不是課程 Source。實際 application repository 必須把它加入 `.gitignore`。

---

## 6. Importer CLI Contract

Repository 必須提供：

```bash
npm run content:import -- \
  --manifest .content-sync/manifest.json \
  --mode draft \
  --report .content-sync/import-report.json
```

推薦 package.json：

```json
{
  "scripts": {
    "content:import": "tsx scripts/content/import-cli.ts"
  }
}
```

實際入口可不同，但 `npm run content:import` 必須存在。

### CLI 最低責任

Importer 必須：

1. 讀取 manifest。
2. 找出受到影響的 Stage。
3. 重新載入每個受影響 Stage 的完整 source set。
4. Parse Markdown AST。
5. Normalize 成 canonical content JSON。
6. 執行 structural validation。
7. 建立 import job。
8. 產生 source hash。
9. 寫入 Draft。
10. 寫入 warnings / errors。
11. 輸出 machine-readable report。
12. 可重複執行而不製造重複 Draft。

---

## 7. Idempotency

同一 commit 或同一 source hash 重跑時，不應一直產生完全相同的重複版本。

推薦使用：

```text
stage_id
+ source_hash
+ parser_version
```

做為 deduplication / idempotency 識別資訊。

如果同一內容再次 import：

```text
Existing Draft found
→ reuse / update import job
→ 不新增無意義 duplicate version
```

若 source hash 改變：

```text
New source hash
→ create new Draft version
```

---

## 8. Draft 與 Published 必須完全分離

GitHub Actions 的 secret 只允許被內容匯入流程使用。

Importer 必須明確帶：

```text
mode = draft
```

若有人試圖透過 workflow 參數把 mode 改為 `published`：

> 拒絕執行。

Publish 必須由 Admin / 明確發布流程處理。

---

## 9. Supabase 權限

GitHub Actions 使用：

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

其中 secret key 只能出現在 GitHub Actions / server-side importer，不得進入瀏覽器，也不得 commit 到 Git。

Supabase 目前已提供新的 publishable / secret key 模式；既有 `service_role` / `anon` keys 處於遷移期，因此新實作優先採用 `SUPABASE_SECRET_KEY`，並把 legacy key 相容性視為過渡方案。

---

## 10. Import job 建議資料

推薦建立 `content_import_jobs`：

```text
id
repository
commit_sha
workflow_run_id
workflow_run_url
mode
status
manifest_json
started_at
completed_at
error_count
warning_count
created_at
```

status 建議：

```text
running
completed_with_warnings
completed
failed
```

---

## 11. Content Version 建議欄位

每個 Draft Version 至少保存：

```text
content_version_id
stage_id
version_number
status
source_file_set
source_hash
parser_version
content_json
warning_count
created_at
import_job_id
```

Published Version 必須可以追溯到：

```text
Git commit
→ source file set
→ source hash
→ import job
→ draft version
→ publish event
```

---

## 12. Import Warning 與 Fatal Error

### Warning

不一定阻止 Draft 建立，例如：

- 未辨識的輕微格式
- 可保留原文的內容 block
- 可由管理者 Preview 判斷的非致命問題

結果：

```text
Draft created
+ Warning
```

### Fatal Error

例如：

- 無法解析必要 heading
- question_key 重複
- dependency 指向不存在的 question
- navigation target 不存在
- 無法建立合法 canonical schema

結果：

```text
Import job = failed
Draft 不得標示為可發布
GitHub Action = failed
```

不能「先猜一個答案再繼續」。

---

## 13. 刪除檔案的處理

GitHub 刪掉 Markdown 時，不應直接刪除 Published Content。

正確流程：

```text
GitHub source deleted
        ↓
Importer 發現 D
        ↓
建立新的 Draft state / import warning
        ↓
Admin Preview
        ↓
管理者決定是否 Publish
```

因此誤刪 source 不會讓正式網站瞬間消失。

---

## 14. Rename 的處理

若 Git 偵測到 rename：

```text
oldPath → newPath
```

Importer 應以新的 path 為目前 source identity，並保留 old path 作為 import audit metadata。

不要因檔案改名而無故改變 question_key。

---

## 15. Manual Re-import

Workflow 支援 `workflow_dispatch`。

可以指定：

```text
stage-02
```

表示：

> 即使該 Stage 沒有新的 Git diff，也重新從目前 GitHub source 建立／更新 Draft。

這可用於：

- 修復 transient import failure
- Parser 升級後重新匯入
- 資料庫重建後補資料
- 人工要求重新同步

不需要重新修改 Markdown。

---

## 16. 安全原則

禁止：

```text
NEXT_PUBLIC_SUPABASE_SECRET_KEY
```

禁止：

```text
console.log(process.env.SUPABASE_SECRET_KEY)
```

禁止：

- 把 secret key 放在 source code
- 把 secret key 放在 JSON report
- 把 secret key 寫進 import warning
- 讓 frontend 使用 secret key

GitHub workflow 應只需要：

```text
contents: read
```

除非其他獨立需求需要更高權限。

---

## 17. 失敗行為

若 importer 失敗：

```text
GitHub Action = FAILED
Draft publish = 不發生
Import report = 上傳
Admin = 可看到錯誤
```

不要 catch 後 `exit 0`。

不要讓 GitHub 顯示綠燈但 Supabase 沒有成功 import。

---

## 18. 成功條件

這一條自動化鏈路完成後，日常新增 Stage 3 的操作應該只有：

```text
content/source/stage-03/lecture.md
content/source/stage-03/assignment.md
        ↓
git add .
git commit
git push origin main
        ↓
GitHub Action 自動啟動
        ↓
Supabase Draft
        ↓
Admin Preview / Validate
        ↓
Publish
        ↓
Website 讀取 Published Content
```

不應再要求：

```text
修改 React
複製 Stage2Page
建立 Stage3Page
手動執行 parser
直接改 production DB
```
