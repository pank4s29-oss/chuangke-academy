# Flow 模式規格（第一版）

Flow 是由 `content/source/stage-XX/flow.yaml` 驅動的通用頁面流程。Markdown 仍是教材原文 Source of Truth；sidecar 只描述互動、題目 key、衍生規則與來源引用。

## 核心結構

- `flows.self_study`：正式教材順序。
- `flows.consult_session`：諮詢版順序，可共用同一批 page。
- `questions`：穩定語意 key；每題保留 `legacyKeys`。
- `derived`：不可 `eval` 的宣告式運算，來源需標示 `origin` 與 `sourceRef`。
- `blueprint`：最後一頁的結構化輸出設定。

## 第一版 block

`heading`、`prose`、`lecture`、`choice`、`text`、`textarea`、`sentence`、`check`、`callout`、`blueprint`、`matrix`、`matrixDynamic`、`likert`、`score`、`date`、`schedule`、`checklist`、`tip`。表格欄位以 `rows`／`columns` 宣告，輸入 key 由 block key、row id、column id 穩定組合，不在 React 中寫死教材欄位。

## 儲存契約

答案以語意 key 存在 `submissions.answer_json`，未登入使用 localStorage；`_flow` 保存 mode、page 與 edited 狀態，匯出與藍圖時過濾。缺少 `flow.yaml` 的 Stage 永遠回到舊 `TaskFlow`。
