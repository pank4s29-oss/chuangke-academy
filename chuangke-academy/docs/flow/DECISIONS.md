# Flow 模式決策紀錄

> 依 `chuangke_flow_migration_plan.md` 第 6 章建立。未收到額外拍板前，先採用建議預設；「使用者確認」欄標記為「否」。

| ID | 採用值 | 理由 | 日期 | 使用者確認 |
|---|---|---|---|---|
| D-01 | `self_study` 正式版順序 + `consult_session` Artifact 順序 | 同一組語意 key 共用兩種 flow，不改教材原意 | 2026-09-29 | 否（預設） |
| D-02 | 獨立 `flow.yaml` sidecar | 不修改 Markdown Source of Truth | 2026-09-29 | 否（預設） |
| D-03 | 舊 `TaskFlow` 保留至 Phase 8 驗收後 | 提供 fallback 與回滾路徑 | 2026-09-29 | 否（預設） |
| D-04 | Flow 區域採 Artifact 視覺；其他頁面不動 | 紙色底、螢光筆黃、襯線標題更適合引導式作答 | 2026-09-29 | 否（預設） |
| D-05 | `submissions.answer_json`，修正為只存該 task 的 key | 沿用現有 workspace 契約，避免擴大 migration 範圍 | 2026-09-29 | 否（預設） |
| D-06 | 新增 `yaml` 套件（待 H2 同意） | 中文長文本 sidecar 可維護；本 repo 目前沒有直接依賴 | 2026-09-29 | 否（Hard Stop H2） |
| D-07 | 字數以完整唸出句子（去空白）計算 | 符合教材「整句話」意圖 | 2026-09-29 | 否（預設） |
| D-08 | 「我不收」使用原選項字串 | 教材要求「不用修飾」 | 2026-09-29 | 否（預設） |
| D-09 | 勾選順序自動帶入三格，三格仍可編輯，保留其他 | 兼顧 Artifact 與正式教材 | 2026-09-29 | 否（預設） |
| D-10 | 只阻擋「學會」；「學到／學習」中性提醒 | 忠於正式教材 | 2026-09-29 | 否（預設） |
| D-11 | 採用破口詮釋規則，但可手動覆寫 | 正式教材有依據但 UI 明示為依勾選判斷 | 2026-09-29 | 否（預設） |
| D-12 | 回家作業 1.2 完整互動 | 是階段二輸入，且為正式版最重要內容 | 2026-09-29 | 否（預設） |
| D-13 | Recall 僅舊模式；Flow 使用宣告式 `prefill` | 降低一次改動面 | 2026-09-29 | 否（預設） |
| D-14 | 不新增 E2E 框架 | 先用 Vitest、元件測試與手動 QA | 2026-09-29 | 否（預設） |

## Phase 0 事實與落差

- Git clone 後實際結構為外層 Git repository `/home/ubuntu/chuangke-academy`，應用程式檔案位於內層 `/home/ubuntu/chuangke-academy/chuangke-academy/`。
- 企畫書預期的 nested clone 結構與實況相符；但內層 `README.md` 的 Vercel 說明宣稱 repository root 直接包含 `package.json`，與外層 Git root 不符。依 H4/R-10 如實記錄，Phase 0 未修改 `vercel.json` 或部署設定。
- 實際 source 檔名是帶中文的長檔名，不是文件中的 `lecture.md` / `assignment.md`；解析器以檔名含「講義／作業」辨識。
- repo 內沒有 `.github/workflows/` 目錄；本次不擅自新增 workflow。
- migration 最終契約：`submissions` 以 workspace 或 legacy unique index 分流；`answer_json` 為 task 級 JSON；`answers` 保留 `content_version_id` nullable 與 `(user_id, stage_key, question_key)` unique index；workspace、submissions、answers、content versions、import jobs 等均有 RLS，但 migration 未提供 Flow 專用欄位，預計不需新 migration。
- Artifact 參考連結目前在 Sandbox Browser 轉到 Claude 登入頁，無法讀取使用者提供的 artifact 內容；企畫書內已提供足夠的行為與視覺規格，後續以企畫書為主並在回報註明。
