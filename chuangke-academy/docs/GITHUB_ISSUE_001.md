# GitHub Issue #001｜建立創客學院 Content-Driven Course Engine MVP

## Objective

建立創客學院第一版可擴充課程系統，讓「階段一、階段二，以及未來新增階段」都可以透過 Markdown 課程內容匯入，不需要為每個階段重寫前端。

## Context

目前課程素材採 Markdown：

- `content/source/stage-01/`：預留給階段一講義與作業
- `content/source/stage-02/`：目前已有階段二講義與作業

目前已收到：

- `06_創客學院_階段二_作業_v2-1.md`
- `07_創客學院_階段二_講義_v2.md`

## Product Requirement

核心流程：

`學習 → 實作 → Autosave → 驗收 → 修正 → 通過 → 下一步 → 成果`

核心架構：

`Course → Stage → Lesson → Task → Step → Question → Answer`

搭配：

- Dependency Engine
- Validation Engine
- Navigation Engine
- Progress Engine
- Artifact / Blueprint Engine
- Content Versioning

## Acceptance Criteria

### A. Repository

- [ ] 建立 `AGENTS.md`
- [ ] 建立 content source directories
- [ ] 建立 docs / architecture documentation
- [ ] 保留原始 Markdown

### B. Database

- [ ] Supabase schema 可支援 Course / Stage / Lesson / Task / Step / Question
- [ ] 支援 student answers
- [ ] 支援 progress
- [ ] 支援 artifacts
- [ ] 支援 content versions
- [ ] 所有 exposed tables 啟用 RLS
- [ ] migration 可重建 schema

### C. Content Engine

- [ ] Parser 可解析 Markdown
- [ ] 支援 heading / paragraph / quote / table / checklist / examples
- [ ] 支援 task / step / question metadata
- [ ] 匯入失敗不可靜默猜測
- [ ] import warnings 可被管理者看到
- [ ] source hash 可追蹤

### D. Question Engine

- [ ] 建立通用 QuestionRenderer
- [ ] 支援 single select
- [ ] 支援 multi select
- [ ] 支援 text / textarea / number
- [ ] 支援 checkbox
- [ ] 可擴充拖曳、情境組裝、句型組裝

### E. Student Experience

- [ ] 課程首頁
- [ ] 六階段課程地圖能力
- [ ] 階段首頁
- [ ] Learning / Practice 工作台
- [ ] Autosave
- [ ] Resume last position
- [ ] Mobile responsive

### F. Dependency / Validation

- [ ] Question key 穩定
- [ ] 一題可引用另一題答案
- [ ] 支援條件顯示
- [ ] 支援指定回退 step
- [ ] 支援完成條件
- [ ] 驗收不可使用 AI 語意判斷

### G. Stage 2

- [ ] 導入階段二講義
- [ ] 導入階段二作業
- [ ] 2.1 可互動完成
- [ ] 2.2 可互動完成
- [ ] 2.3 可互動完成
- [ ] 2.4 可互動完成
- [ ] 2.5 可互動完成
- [ ] 定位藍圖自動生成

### H. GitHub Content Sync

- [ ] Push to `main` for `content/source/**/*.md` triggers the content sync workflow
- [ ] Workflow creates a change manifest
- [ ] Changed files are grouped by affected Stage
- [ ] Importer rebuilds the full Stage source set
- [ ] Draft is written to Supabase without auto-publish
- [ ] Same source hash is idempotent
- [ ] Import warnings / fatal errors are visible and reflected in workflow status
- [ ] Workflow supports manual Stage re-import
- [ ] Import report is retained as a workflow artifact

### I. Future Stage Addition

- [ ] 新增 Stage 不需修改核心 page
- [ ] 新增 Task 不需新增 React component
- [ ] 新增題目由 content definition 驅動
- [ ] 內容可 Draft / Preview / Publish
- [ ] Published content 自動反映到網站

### J. Deployment

- [ ] GitHub repository connected
- [ ] Vercel preview deployment 可用
- [ ] Production build 通過
- [ ] Environment variables 正確設定
- [ ] Secrets 不進 client bundle

## Non-Goals

第一版不要做：

- AI Coach
- AI Chatbot
- AI answer generation
- AI semantic grading
- Community
- Gamification
- Leaderboard
- Payment
- Complex CRM

## Implementation Order

1. Repository audit
2. Architecture docs
3. Supabase schema + migrations
4. Content model
5. Parser / importer
6. Question engine
7. Validation engine
8. Dependency engine
9. Progress engine
10. Course / Stage UI
11. Stage 2 import
12. Stage 2 interactive implementation
13. Blueprint
14. Admin preview / publish
15. GitHub Content Sync
16. Tests
17. Vercel preview
18. Production verification

## Definition of Done

新學員可以登入，完成階段二；中途重新整理或重新登入後，答案與進度仍存在；階段二完成後，系統自動生成定位藍圖；管理者能匯入新 Markdown 並發布，而不需修改核心 React 頁面。
