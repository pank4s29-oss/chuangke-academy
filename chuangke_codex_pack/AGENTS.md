# 創客學院｜Codex 專案開發規範

## 0. 專案身份

你現在正在開發「創客學院」互動式線上課程系統。

這不是單純的 LMS，也不是把 PDF / Markdown 搬進網站。

核心產品是：

> 讓學員沿著老師設計好的思考與實作流程，一步一步完成課程，並把前面產生的答案自動帶入後面的任務，最後形成可直接使用的商業成果。

本系統採用「內容驅動（content-driven）」架構：

> 課程內容是資料；Application 是通用的呈現與執行引擎。

因此新增新階段、新任務、新題目、新教材時，優先透過內容資料／Markdown 匯入處理，而不是修改 React 元件或核心流程。

---

# 1. Source of Truth：課程內容不可被程式碼重新發明

目前官方來源為使用者提供的 Markdown 教材。

目前本專案已收到：

- `content/source/stage-02/06_創客學院_階段二_作業_v2-1.md`
- `content/source/stage-02/07_創客學院_階段二_講義_v2.md`

目前這個專案包沒有虛構階段一內容；未來若收到：

- 階段一講義 Markdown
- 階段一作業 Markdown

請放入：

`content/source/stage-01/`

原始教材規則：

1. 不得擅自改寫教材觀念。
2. 不得刪除原始教學邏輯。
3. 不得用一般知識補寫來源檔案沒有的內容。
4. 可以改變 UI 呈現、操作方式、導覽與互動形式，但不可偷偷改變題目原意。
5. 如果 Markdown 格式不明確，優先保留原文並產生 Draft / Import Warning，不要自行猜測。

---

# 2. 產品核心 UX

所有課程都遵守以下循環：

> 看懂 → 操作 → 自動保存 → 驗收 → 修正 → 通過 → 下一步 → 累積成果

學員不應該被迫管理流程。

系統要負責：

- 顯示目前位置
- 顯示現在要做什麼
- 顯示完成這一步所需的講義內容
- 自動帶入已知答案
- 自動保存
- 執行預先定義的驗收規則
- 根據分支帶往正確下一步
- 保存進度
- 生成成果

學員應該把主要腦力用在「思考自己的商業／課程問題」，而不是找頁數、抄答案、找下一題。

---

# 3. 課程資料模型

Application 必須把課程抽象成：

`Course → Stage → Lesson → Task → Step → Question → Answer`

並另外管理：

- Validation Rules
- Navigation Rules
- Answer Dependencies
- Progress
- Artifacts
- Content Versions

不得將 Stage 1 / Stage 2 的任務寫死在 React page 中。

---

# 4. Content-driven architecture

前端不應該知道：

- Stage 2 一定有 5 個任務
- Stage 3 一定有 4 個任務
- 某一題一定是 textarea
- 某一題一定要回 2.1

前端只知道：

> 這是一個 Task，這是一組 Step，這是一個 Question，這是一條 Rule。

具體內容、順序、題型、驗收規則、引用關係由 Content Definition 提供。

---

# 5. 技術架構

## Frontend / Application

優先採用：

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- `@supabase/ssr`

遵循正確的 Server / Client Component 邊界。

預設使用 Node.js runtime，除非有明確理由採用其他 runtime。

## Database / Backend

使用 Supabase：

- PostgreSQL
- Auth
- RLS
- Storage（必要時）
- Edge Functions（必要時）

## Source Control

使用 GitHub。

GitHub 儲存：

- application code
- migrations
- source Markdown
- content schemas
- parser
- tests
- documentation
- AGENTS.md

## Deployment

使用 Vercel。

Git integration：

- `main` → production
- pull request / non-production branch → preview

---

# 6. GitHub / Supabase / Vercel 的責任邊界

## GitHub

負責「可追蹤的原始資產」：

- 程式碼
- migrations
- 原始課程 Markdown
- parser / schema
- 測試
- 開發文件

## Supabase

負責「執行時資料」：

- 使用者
- profile
- 課程資料
- published content
- student answers
- progress
- artifacts
- content version

## Vercel

負責「網站執行與部署」：

- Next.js runtime
- preview deployments
- production deployment
- environment variables

---

# 7. 課程內容來源與自動更新

未來新增課程的標準流程：

```text
Markdown
  ↓
Content Importer
  ↓
Canonical Course Data
  ↓
Draft
  ↓
Validation
  ↓
Admin Preview
  ↓
Publish
  ↓
Supabase Published Content
  ↓
Next.js Content Engine
  ↓
Website
```

新增課程內容時：

- 若只是新增文字、題目、選項、Task、Step、Stage、驗收規則、依賴關係 → 不修改核心 application code。
- 只有新增「系統尚未支援的題型／流程能力」時，才可修改 Question Engine / Validation Engine 等核心引擎。

---

# 8. 原始 Markdown 與 Published Content 的分離

GitHub 上的 Markdown 是 Source。

Supabase 上的 published content 是 Runtime content。

不得直接讓前台把 GitHub raw Markdown 當成主要 runtime database。

導入後要保留：

- source_file
- source_hash
- parser_version
- content_version
- imported_at
- published_at

如此才能追蹤內容版本。

---

# 9. Content versioning

內容必須支援：

- draft
- published
- archived

不得直接覆蓋已發布版本而失去歷史。

發布新版本時：

1. 驗證內容
2. 驗證 question_key 唯一性
3. 驗證 dependency
4. 驗證 navigation target
5. 驗證 validation rule
6. 建立新 version
7. 標示 published
8. 保留舊版本

---

# 10. Question Engine

建立通用 `QuestionRenderer`。

至少支援：

- single_select
- multi_select
- text
- textarea
- number
- rating
- checkbox
- matrix
- drag_and_drop
- scenario_builder
- sentence_builder

不要為每一道題目建立獨立 React Component。

新增題型時才修改 renderer / schema。

---

# 11. Answer Engine

所有學生答案必須具備：

- user_id
- question_key / question_id
- value
- content_version
- created_at
- updated_at

前端採 Autosave。

Autosave 需要 debounce / 防止過量 request，且不能因重新整理造成資料遺失。

畫面應顯示：

- 已儲存
- 儲存中
- 儲存失敗

儲存失敗不得靜默吞掉。

---

# 12. Answer Dependency Engine

答案可以引用其他題目的答案。

例如：

```text
2.1-A 恐懼
   ↓
2.4-A 結果價值
   ↓
2.5-B 核心承諾
```

引用應採穩定 `question_key`，而不是依賴不可讀的資料庫 UUID。

例如：

`stage2.task2_5.core_promise`

如果題目文字修改但 question_key 沒有改，歷史答案應保持可用。

如果題目語意真正改變，建立新的 question_key，而不要破壞舊答案。

---

# 13. Validation Engine

驗收規則由內容資料定義，不應硬編碼在頁面。

支援：

- required
- min_length
- max_length
- selected_count
- score_threshold
- match
- contains
- not_contains
- dependency_match
- checklist_completion
- navigation rule

重要：

不要使用 AI 判斷學員答案是否「正確」。

本系統第一版只執行課程設計者預先定義的規則。

---

# 14. Navigation / Branching Engine

系統要支援：

- 下一步
- 回某個指定 step
- 條件顯示
- 分支選擇
- 鎖定尚未完成的 step
- 通過後解鎖

規則採 declarative data，例如：

```json
{
  "condition": {
    "question": "stage2.task2_5.time_reason",
    "operator": "equals",
    "value": "external_timeline"
  },
  "action": {
    "type": "show_step",
    "target": "stage2.task2_5.time.external"
  }
}
```

不要把這類規則散落在 JSX `if` 中。

---

# 15. Progress Engine

至少保存：

- course progress
- stage progress
- task progress
- step progress
- last_location
- last_question
- updated_at

重新登入後應可直接：

> 繼續上次進度

而不是重新尋找。

---

# 16. Artifact / 成果系統

課程完成後不是只有：

> Task Completed

而是產生實際成果，例如：

- positioning_blueprint
- customer_profile
- market_gap
- offer
- pricing
- sales_framework

「一頁定位藍圖」應由已保存答案自動生成，不要要求學員重新抄寫。

---

# 17. 前台主要資訊架構

推薦 route：

- `/login`
- `/app`
- `/app/courses/[courseId]`
- `/app/courses/[courseId]/stages/[stageId]`
- `/app/courses/[courseId]/stages/[stageId]/learn`
- `/app/courses/[courseId]/stages/[stageId]/practice`
- `/app/courses/[courseId]/stages/[stageId]/review`
- `/app/courses/[courseId]/stages/[stageId]/result`
- `/app/courses/[courseId]/stages/[stageId]/blueprint`
- `/admin`
- `/admin/content`
- `/admin/import`
- `/admin/publish`

若現有 repository 已有更佳結構，可沿用，但必須維持上述概念與 separation of concerns。

---

# 18. Study / Practice 工作台

桌面優先使用雙欄：

左：

- 學習內容
- 核心概念
- 案例
- 常見錯誤

右：

- 現在要回答的問題
- 輸入區
- 儲存狀態
- 驗收

Mobile：

- 學習 Tab
- 實作 Tab

不要強迫使用者先讀整篇講義，再離開頁面去填作業。

---

# 19. 分支資訊只在需要時顯示

如果某題有 A / B / C 三條路：

不要一次全部展示。

應該：

`回答前置問題 → 根據答案顯示相關分支`

這是降低認知負擔的重要規則。

---

# 20. Admin Content Manager

管理者需要能：

- 建立 Course
- 建立 Stage
- 編輯 metadata
- Import Markdown
- 預覽 draft
- 發布 content version
- 封存舊版本
- 查看 import warnings
- 查看 content dependencies

內容發布流程：

`Draft → Preview → Validate → Publish`

不要直接把未驗證內容發布到 production。

---

# 21. Markdown Importer

建立獨立：

`lib/content/parser`

Parser 不可綁定 React component。

Importer 應保存：

- 原始 Markdown
- 解析後 AST / canonical JSON
- parser version
- warning
- source hash

第一版需要完整支援目前階段二教材的結構，包括：

- heading
- paragraph
- quote
- table
- checklist
- examples
- task code
- step code
- completion criteria
- branching instructions

如果遇到無法可靠解析的結構：

> 保留原文 + Draft Warning

禁止默默猜測。

---

# 22. 課程檔案命名規範

推薦：

```text
content/
  source/
    stage-01/
      lecture.md
      assignment.md
    stage-02/
      lecture.md
      assignment.md
    stage-03/
      lecture.md
      assignment.md
```

如果需要保留原始檔名，可額外保存 metadata，但 runtime 不應依賴超長檔名。

---

# 23. 未來新增階段的固定操作

當使用者提供新的：

- `lecture.md`
- `assignment.md`

執行：

```text
1. 放入 content/source/stage-XX/
2. 解析
3. 建立 draft
4. 內容完整性檢查
5. Admin Preview
6. 驗證 dependency / validation / navigation
7. Publish
8. Website 自動讀取 published content
```

除非有新題型或新流程能力，否則不得修改核心 application。

---

# 24. Supabase Security

所有 exposed schema tables 必須啟用 RLS。

Student 只能取得自己的：

- answers
- progress
- profile

Admin 必須透過真正的 authorization data 判斷，不得使用使用者可任意修改的 metadata 作為 admin 權限依據。

禁止：

- 把 `service_role` key 放到 client
- 用 client-side env 讀取 server secret
- 用 `user_metadata` 作為 authorization decision
- 為了解 permission error 而使用 `SECURITY DEFINER`
- 忽略 UPDATE 的 SELECT / WITH CHECK RLS 要求

若新增 view，確認其 RLS 行為。

任何 Supabase schema 變更必須：

1. 透過 migration 可重建
2. 檢查 RLS
3. 執行驗證查詢
4. 記錄結果

---

# 25. Environment Variables

建立 `.env.example`。

至少包含：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

規則：

- `SUPABASE_SECRET_KEY` 只能 server-side / GitHub Actions 使用
- 所有 secret 不得 commit
- 不得在 log 印 secret
- 若現有專案仍使用 legacy `service_role`，可做相容層，但新流程以 `SUPABASE_SECRET_KEY` 為 canonical server-side environment variable

---

# 26. Git Workflow

推薦：

- `main`：production
- feature branch：功能開發
- PR：preview deployment

Commit 必須小而可追蹤。

不要把未驗證的大量變更一次塞進單一 commit。

---

# 27. 測試

至少建立：

## Unit

- parser
- content normalization
- validation engine
- dependency engine
- progress engine

## Integration

- Supabase read/write
- autosave
- dependency loading
- publish workflow

## E2E

完整測試：

```text
Login
→ Course
→ Stage
→ Task
→ Answer
→ Autosave
→ Reload
→ Answer retained
→ Branch
→ Validation fail
→ Correction
→ Validation pass
→ Next step
→ Stage completion
→ Blueprint
```

---

# 28. UI Quality

品牌：創客學院。

方向：

- 專業
- 清楚
- 現代
- 高可讀性
- 工作台感
- 少裝飾

不要做成：

- 遊戲
- 過度科技風
- AI 聊天工具
- 補習班模板網站

核心感受：

> 「我正在完成一件重要的商業工作。」

---

# 29. AI 功能限制

目前產品明確排除 AI 教練。

不要加入：

- AI 教練
- AI 聊天
- AI 自動回答題目
- AI 自動生成學員答案
- AI 自動改寫答案
- AI 自動評分語意

之後若使用者要求新增 AI 功能，先視為新的產品需求，不得自行加入。

---

# 30. 第一個 MVP 範圍

MVP 必須先完成：

1. Authentication
2. Course list
3. Stage map
4. Stage 1 / Stage 2 content-ready architecture
5. Stage 2 complete interactive flow
6. Autosave
7. Dependency
8. Validation
9. Progress
10. Artifacts
11. Blueprint
12. Admin
13. Markdown importer
14. Content versioning
15. Publish
16. Supabase
17. GitHub
18. Vercel deployment

暫不做：

- AI coach
- community
- leaderboard
- gamification
- complex CRM
- payment system
- notifications center

---

# 31. Codex 執行規則

每次收到新的開發任務：

### Step 1
先閱讀本 `AGENTS.md`。

### Step 2
檢查 repository 現況。

### Step 3
若任務涉及 Supabase，先確認目前專案的 Supabase / schema / auth / RLS 狀況。

### Step 4
若任務涉及新課程內容，先解析來源，不要先改 UI。

### Step 5
先做最小變更。

### Step 6
執行：

- lint
- typecheck
- unit tests
- integration tests（適用時）
- production build

### Step 7
若涉及 UI，做瀏覽器驗證。

### Step 8
如果失敗，不要重複做同一種修法超過 2-3 次；重新檢查假設、錯誤訊息與架構。

---

# 32. 回報格式

完成工作後，一律回報：

```md
## Implementation Summary

### Changed
- ...

### Database
- ...

### Content
- ...

### Routes
- ...

### Tests
- lint: PASS/FAIL
- typecheck: PASS/FAIL
- unit: PASS/FAIL
- build: PASS/FAIL

### Verification
- ...

### Known Issues
- ...

### Next Step
- ...
```

---

# 33. 成功標準

當以下情境成立，才算 MVP 的核心路徑完成：

```text
學員登入
→ 看到課程
→ 進入階段
→ 看到任務
→ 閱讀當前所需內容
→ 完成題目
→ 自動保存
→ 重新整理答案仍存在
→ 依規則進入下一題
→ 跨題引用資料自動帶入
→ 驗收失敗可明確回到指定位置
→ 修正後通過
→ 完成整個階段
→ 系統自動生成成果
→ 重新登入後可以繼續
```

---

# 34. 長期設計目標

創客學院最終應該成為：

> **一個可持續增加課程內容，而不需要持續重寫網站程式的內容驅動型教育實作平台。**

新增課程內容的成本應該逐步從：

> 「開發一個新頁面」

下降到：

> 「新增 Markdown → Import → Preview → Publish」。

這是本專案最重要的架構目標之一。

---

# 35. GitHub Content Sync

本專案已包含：

`.github/workflows/content-sync.yml`

用途：

```text
content/source/**/*.md
        ↓
push main
        ↓
GitHub Actions
        ↓
manifest
        ↓
npm run content:import -- --mode draft
        ↓
Supabase Draft
```

規則：

1. 只對 `main` 分支的 content source push 自動執行。
2. 支援新增、修改、刪除、rename/copy。
3. 受影響 Stage 必須重新組裝完整 source set。
4. Import 必須具備 idempotency。
5. workflow 只能建立／更新 Draft。
6. Publish 必須由 Admin 明確執行。
7. Import failure 必須讓 workflow fail。
8. Import report 必須保留。
9. 支援 `workflow_dispatch` 指定 Stage 重跑。

詳細規格：

- `docs/CONTENT_SYNC_SPEC.md`
- `docs/CODEX_CONTENT_SYNC_PROMPT.md`
- `docs/CONTENT_SYNC_SETUP.md`

---

# 36. 日常內容維護標準

內容管理者最終工作流應為：

```text
新增／修改 Markdown
→ commit
→ push
→ GitHub Actions
→ Supabase Draft
→ Admin Preview / Validate
→ Publish
```

如果新增內容仍要求建立新的 React page，優先視為架構問題，而不是正常內容更新流程。
