# Flow 匯入相容性（第一版）

- `flow.yaml` 與同 Stage 的 Markdown 一起視為 source set；修改 sidecar 必須讓 source hash 改變。
- 缺少 `flow.yaml` 的 Stage 不報錯，前台走既有 `TaskFlow`。
- 第一版不對正式 Supabase 執行 migration；沿用 `submissions.answer_json` 與既有 Draft／Published migration 契約。
- `legacyKeyMap` 提供舊位置 key 到語意 key 的遷移表。新 UI 讀取時應先找語意 key，再從 legacy key 回填；舊模式回滾策略仍保留。
- 目前 `scripts/content/import-cli.mjs` 尚未把非 Markdown sidecar 加入 hash，列入後續 Phase 7；本版不宣稱已完成發布管線整合。
