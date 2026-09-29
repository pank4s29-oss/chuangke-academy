# Flow 模式第二階段回報：Supabase 整合與 Debounce Autosave

## 變更內容

`FlowRunner` 現在會在進入 workspace 時取得目前登入者，讀取該 workspace／stage 的所有 `submissions`，合併成 Flow 語意 key；若雲端仍是舊位置式 key，會依 `legacyKeyMap` 回填語意 key，同時保留原 key。未登入或雲端載入失敗時，仍可使用 localStorage 草稿與離線編輯。

答案變更後會先立即寫入 localStorage，再以 **600ms debounce** 將目前頁面所屬 task 的答案寫入 `submissions.answer_json`。資料依頁面分流至 `stage-01-1`、`stage-01-3`、`stage-01-open` 或 `stage-01-appendix`，不把整個 stage 重複寫進每一個 task。`_flow` 僅保存頁碼、模式與 edited metadata，並不進入答案欄位。

同步失敗會顯示「尚未同步」，採指數退避重試，延遲上限 8 秒；使用者也可以按「立即保存」觸發相同保存佇列。切換自學版／諮詢版、鍵盤換頁與重新整理後，頁面狀態都會寫進保留 metadata。

## 相容性

- 沿用既有 `submissions` workspace unique index：`workspace_id,stage_key,task_key`。
- 未新增 Supabase migration，也未對任何正式資料庫執行操作。
- 舊 `TaskFlow` 不變，仍可作為 fallback。
- Supabase connector 在本次 Sandbox session 未啟用，因此未執行真實帳號的線上 round-trip；本次驗收涵蓋 client payload 結構、alias／task 分流純函式與 production build。

## 測試結果

| 指令 | 結果 |
|---|---|
| `pnpm typecheck` | 通過 |
| `pnpm lint` | 通過 |
| `pnpm test` | 通過，13 個檔案／63 個測試 |
| `pnpm build` | 通過 |

## 下一步

下一階段可加入保存狀態的更細緻錯誤分類、跨頁 edited flag、完整雙寫 legacy key、教師端 Flow label 映射，以及使用測試 workspace 進行實際 Supabase RLS round-trip QA。
