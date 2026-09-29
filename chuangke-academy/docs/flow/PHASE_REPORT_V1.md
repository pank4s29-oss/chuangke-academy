# Flow 模式第一版 Phase 回報

## Phase：0｜基線與快照

**分支／Commit：** `feat/flow-mode`；基線 `3c3e387fa44f4552e6caf20880ceee38d143c247`

**變更檔案：** `docs/flow/DECISIONS.md`、`docs/flow/baseline/*`、`scripts/flow/capture-baseline.ts`

**驗收結果：** 通過。已完成 nested repo、source 檔名、migration 契約、硬編碼位置 key 與正式作業欄位快照盤點。Artifact 連結在 Sandbox Browser 要求 Claude 登入，未能直接讀取；本版依企畫書已整理的行為與視覺規格實作。

## Phase：1–3｜Schema、Derive、Flow UI

**變更檔案：** `src/lib/flow/*`、`src/components/flow/FlowRunner.tsx`、`src/app/flow.css`、`src/app/layout.tsx`、`content/source/stage-01/flow.yaml`、`package.json`、`pnpm-lock.yaml`

**驗收結果：** 通過。階段一 sidecar 可解析；自學版 6 頁、諮詢版 5 頁、17 個語意題目；validator issues 為空。已提供通用 choice、text、textarea、sentence、check、callout、blueprint block；鍵盤左右導覽、分段進度、localStorage 續填、複製答案、手機版 tokens 與 Artifact 紙色／螢光筆視覺已接上。舊 `TaskFlow` 沒有刪除。

**採用的預設決策：** D-01、D-02、D-03、D-04、D-07、D-08、D-09、D-10、D-11、D-12、D-13、D-14；D-06 已取得使用者 H2 同意並新增 `yaml@^2.9.1`。

## Phase：4／6–8｜本次第一版處置

本次保留既有 TaskFlow 與資料表契約，Flow 第一版目前以 workspace-scoped localStorage 續填為主；尚未把 Flow state 接回 Supabase `submissions.answer_json` 的 debounce 雙寫，也尚未完成完整 legacy alias 載入／舊模式回寫、Blueprint 教師端整合與列印專用頁。這些保留在下一版，避免在未完成資料安全測試前切換既有儲存路徑。

## Phase：7｜匯入／發布管線

本版已加入 `docs/flow/IMPORT_COMPATIBILITY.md` 說明 fallback 與 Draft／Published 邊界，但 `scripts/content/import-cli.mjs` 尚未把 `flow.yaml` 納入 source hash 與 Draft content JSON；目前不宣稱已完成此 Phase。沒有執行任何正式 Supabase migration，也沒有新增 `.github/workflows/`。

## 測試結果

| 指令 | 結果 |
|---|---|
| `pnpm typecheck` | 通過 |
| `pnpm lint` | 通過 |
| `pnpm test` | 通過，12 個檔案／58 個測試 |
| `pnpm build` | 通過，Next.js production build |
| Flow validator | 通過，self-study 6 頁、consult 5 頁、17 題、0 issues |

## 下一步

下一版應優先完成：Flow 的 Supabase autosave／retry 與 alias 雙寫；階段一正式作業 2-A～2-E、4-A～4-D、5-A～5-D、附錄完整覆蓋；教師端與藍圖／列印；最後才進行 content importer hash、Draft Preview 與單一測試 workspace 的 feature flag 觀察。
