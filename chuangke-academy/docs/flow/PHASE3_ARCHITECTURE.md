# 第三階段架構：完整教材 Flow 化

## 目標

第三階段不把教材文字搬進 React。Markdown 仍是教材原文，`flow.yaml` 是同一個 Stage 的互動 sidecar；React 只負責渲染通用 block、保存答案與呈現衍生結果。這樣後續階段二、階段三可以共用同一套 renderer，而不會再增加任務專屬頁面元件。

## 三層結構

### 1. Content layer

`content/source/stage-01/*.md` 保留正式教材、步驟說明與原始選項。`flow.yaml` 以 `sourceRef` 指回檔案與 heading，並提供語意題目 key、可互動的 options、matrix rows／columns 及 blueprint sections。

### 2. Flow runtime layer

`src/lib/flow/schema.ts` 驗證 sidecar；`derive.ts` 執行不含 `eval` 的宣告式衍生規則；`FlowRunner.tsx` 渲染通用 block。第三階段新增的 block 包括 `matrix`、`matrixDynamic`、`likert`、`score`、`date`、`schedule`、`checklist`、`tip`。矩陣欄位用穩定的 `${base}.${row}.${column}` key，避免把表格結構塞進 component state。

### 3. Persistence／integration layer

FlowRunner 只送語意答案給 persistence helper；helper 依 page 分流到 task，並透過 `legacyKeyMap` 兼容舊答案。Supabase 的 `submissions.answer_json` 不新增欄位、不新增 migration；後續 importer 會把 sidecar hash 與 Markdown hash 一起放入 Draft／Published content version。

## 第三階段頁面切分

| 教材區段 | Flow part | 儲存 task key | 主要 block |
|---|---|---|---|
| 任務 1 | `three` | `stage-01-1` | choice、sentence、textarea |
| 任務 2：市場查證 | `validation` | `stage-01-2` | textarea、matrix、checklist、score |
| 任務 3：商業模式 | `current` | `stage-01-3` | choice、score、sentence |
| 任務 4：CAS 地圖 | `cas` | `stage-01-4` | choice、textarea、matrix |
| 任務 5：30 天計畫 | `launch` | `stage-01-5` | date、schedule、checklist |
| 附錄 | `blueprint` | `stage-01-appendix` | blueprint、copy、print |

## 執行順序

先擴充 schema 與 renderer，再補 `flow.yaml` 的完整 page／question 定義；接著新增 validator 覆蓋率檢查，確保每一個正式教材 heading 都有 `sourceRef` 或明確 `dropped` 理由；最後才更新 importer、教師端映射與列印輸出。此順序可確保內容資料在 UI 之前有穩定契約，也不需要新的 Supabase SQL。

## 不在本階段做的事

本階段不刪除舊 TaskFlow、不變更現有 migration、不把 Markdown 搬進 TSX，也不在未完成測試 workspace RLS round-trip 前修改正式資料庫 schema。
