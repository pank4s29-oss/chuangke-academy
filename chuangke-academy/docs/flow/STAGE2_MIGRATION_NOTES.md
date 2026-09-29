# 階段二 Flow 第一版遷移紀錄

日期：2026-09-29

## 已完成

- 新增 `content/source/stage-02/flow.yaml`，以階段二正式作業的既有欄位基線生成 155 個 Flow questions、30 個 guided pages。
- 保留 155 個既有位置式 `legacyKeys`，因此舊 `TaskFlow` 與新 `/learn/flow` 都能讀取相同答案；沒有修改 `content/source/stage-02/*.md`。
- 依照正式作業順序切成 2.1～2.5 與附錄，任務前加入講義章節頁，使用既有 `.flow-root` Artifact 風格與通用 blocks。
- 新增 `src/lib/flow/stage2.test.ts`：驗證 YAML、來源引用、題目數與 legacy key 覆蓋。
- 新增 `src/components/flow/FlowAssignment.tsx`：修復舊 `TaskFlow.tsx` 對遺失元件的 import，並提供一頁一題、上一題／下一題、進度與 Recall 面板。
- 新增 `scripts/flow/generate-stage2-flow.mjs`：只供重新生成 sidecar 使用，不會修改正式 Markdown；若基線欄位更新，可重新執行 `node scripts/flow/generate-stage2-flow.mjs`。

## 本輪完整工作單化優化

- 階段一維持 `self_study` 正式教材順序與 `consult_session` Artifact 諮詢順序。
- 階段二新增 `consult_session`，可由「客人畫像 → 市場拆解 → 定位句 → 產品與價格 → 成交方案 → 一頁藍圖」的對談順序完成；兩階段均可在工作單頂端切換流程版本。
- `choice` block 支援 `columns: 2`，桌面版呈現雙欄選項卡片，760px 以下自動退回單欄，符合手機操作與 Artifact 工作單節奏。
- 階段二進入時會從同一 workspace 的階段一瀏覽器草稿帶入 8 個關鍵成果（原話、最高頻抱怨、身分、問題句、定位句、服務句、代價句）；只填入階段二尚未作答的欄位，並顯示「已帶入幾個可修改答案」提示。
- 儲存仍沿用 semantic key + legacy key 雙寫，不改正式資料庫 schema；跨階段帶入為本地草稿輔助，不會覆寫已存在的階段二答案。

## 自動化規則

- 已完成第一輪自動化：2.3 定位句自動組合與 15 字檢查、複述／反對／排除測試提示；2.4 四槓桿的加權分數；2.5 三疑慮的加權強度；附錄也會從前面答案自動帶入定位藍圖。
- 基線中標記為「任務」的完成標準頁先以通用欄位呈現，下一輪可改為 checklist／score／readout，仍不需要新增 stage 專屬 React 元件。
- `origin: authored` 的「一頁完成一個小步驟」是 UI 導引文案，不修改教材原文；正式教材文字仍從 Markdown／lecture page 讀取。

## 啟用方式

- 正式 Flow 路由：`NEXT_PUBLIC_FLOW_MODE=1` 後使用 `/app/workspaces/{workspaceId}/courses/{courseKey}/stages/stage-02/learn/flow`。
- 原本 `/learn` 與完整表單仍保留，沒有刪除或取代；沒有 `flow.yaml` 的 stage 仍會 fallback 到舊流程。
- `TaskFlow` 內的「切換成引導模式」也會使用相容元件，不會再造成 production build 的 module-not-found。

## 驗證結果

- `pnpm typecheck`：通過
- `pnpm lint`：通過
- `pnpm test --run src/lib/flow src/components/flow`：通過，3 個 test files／37 個 tests
- `pnpm build`：通過，Next.js production build 成功，Flow workspace route 正常產出
- YAML flow 引用檢查：stage-01 `self_study` 43 頁、`consult_session` 32 頁；stage-02 兩種模式各 30 頁，無 missing 或 duplicate page

## 下一輪建議順序

1. 把 2.1-C 空白地帶的 ①～④判定與 2.4「最強／最弱槓桿」選擇加入衍生規則。
2. 把 2.1-B、2.2-A、2.5-C 等多欄表格由逐欄輸入提升為 `table`／`tableDynamic` block，保留原 legacy row-major mapping。
3. 進行 375px／1280px 真實瀏覽器 QA，再逐步提高 workspace 層級的 Flow feature flag。
