# 如何為新 Stage 寫 flow.yaml

1. 在 `content/source/stage-0N/` 放講義與作業 Markdown（**不要改字**）。
2. 在同資料夾新增 `flow.yaml`，結構與 `stage-01/flow.yaml` 相同：`tasks`、`questions`、`tables`、`derived`、`pages`、`flows`、`blueprint`、`dropped`。
3. 題目 key 命名：`stage{N}.{task}.{section}.{field}`，全小寫。舊欄位用 `legacyKeys` 指回舊解析器的位置式 key（先跑 `npx tsx scripts/flow/dump-baseline.ts` 取得清單）。
4. 每個舊欄位都要出現在某題的 `legacyKeys`（或 `legacyOtherKey`），或列進 `dropped`（附理由）。
5. 給學員看的文字必須複製自原文；不是原文的標 `origin: authored`。
6. 沒有 `flow.yaml` 的 Stage 會自動回到舊 `/learn`（TaskFlow）。
7. 驗證：`npx vitest run src/lib/flow`（validator、覆蓋率、文字保真都會檢查）。
8. **新增 stage 不需要新增任何 React 檔案**，除非出現新的題型／block（R-3）。
