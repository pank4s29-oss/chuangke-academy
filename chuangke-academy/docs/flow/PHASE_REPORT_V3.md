# Flow 模式第三階段進度回報

## 本次已完成

第三階段先完成內容模型與第一批正式教材映射，不把教材內容寫進 React。Flow schema 現在支援 `matrix`、`matrixDynamic`、`likert`、`score`、`date`、`schedule`、`checklist`、`tip`；FlowRunner 已有對應的通用渲染路徑，矩陣欄位使用 `${block}.${row}.${column}` 穩定 key。

階段一 sidecar 已新增任務二「市場查證」的 2-A～2-E 五頁：10 句客人原話、競爭者觀察表、解法破口表、查證 checklist／完成度、回頭修正任務一。任務二會保存到 `stage-01-2`，不需要 Supabase migration。

同時新增 `PHASE3_ARCHITECTURE.md`，定義 Content／Flow runtime／Persistence 三層架構與任務一至附錄的 page／task 分流；新增 schema、derive 測試。

## 目前驗收

| 項目 | 結果 |
|---|---|
| Flow validator | 通過；自學版 11 頁、任務二 5 頁、23 個題目、5 個 derived、0 issues |
| `pnpm typecheck` | 通過 |
| `pnpm lint` | 通過 |
| `pnpm test` | 通過，14 個檔案／65 個測試 |

## 接下來的執行順序

1. 補齊任務四 CAS 地圖的 C／A／S 與串接句型，採 matrix、choice、textarea。
2. 補齊任務五 30 天上線計畫，採 date、schedule、checklist、number／score。
3. 將附錄藍圖改成明確 sections 與可複製／列印的輸出資料，不再只列所有 derived。
4. 補齊任務三的來源引用與語意 alias，並建立教材 heading 覆蓋率檢查。
5. 更新 importer，將 `flow.yaml` hash 納入 Draft／Published content version；目前仍不新增 SQL。
6. 進行 production build 與測試 workspace RLS round-trip QA，再建立下一個 GitHub checkpoint。

## Supabase SQL

本次沒有新增 SQL 檔案。第三階段沿用既有 `submissions` 表、workspace unique index 與 RLS；只有當 importer／正式 Draft schema 驗證後發現現有欄位不足，才會另行提供 migration。
