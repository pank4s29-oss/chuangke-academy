# 階段二 Flow 第一版遷移紀錄

日期：2026-09-29

## 已完成

- 新增 `content/source/stage-02/flow.yaml`，以階段二正式作業的既有欄位基線生成 155 個 Flow questions、30 個 guided pages。
- 保留 155 個既有位置式 `legacyKeys`，因此舊 `TaskFlow` 與新 `/learn/flow` 都能讀取相同答案；沒有修改 `content/source/stage-02/*.md`。
- 依照正式作業順序切成 2.1～2.5 與附錄，任務前加入講義章節頁，使用既有 `.flow-root` Artifact 風格與通用 blocks。
- 新增 `src/lib/flow/stage2.test.ts`：驗證 YAML、來源引用、題目數與 legacy key 覆蓋。
- 新增 `src/components/flow/FlowAssignment.tsx`：修復舊 `TaskFlow.tsx` 對遺失元件的 import，並提供一頁一題、上一題／下一題、進度與 Recall 面板。
- 新增 `scripts/flow/generate-stage2-flow.mjs`：只供重新生成 sidecar 使用，不會修改正式 Markdown；若基線欄位更新，可重新執行 `node scripts/flow/generate-stage2-flow.mjs`。

## 啟用方式

- 正式 Flow 路由：`NEXT_PUBLIC_FLOW_MODE=1` 後使用 `/app/workspaces/{workspaceId}/courses/{courseKey}/stages/stage-02/learn/flow`。
- 原本 `/learn` 與完整表單仍保留，沒有刪除或取代；沒有 `flow.yaml` 的 stage 仍會 fallback 到舊流程。
- `TaskFlow` 內的「切換成引導模式」也會使用相容元件，不會再造成 production build 的 module-not-found。

## 第一版刻意保留的限制

- 本版先完成「全欄位可走、舊答案可讀、講義順序與一頁式互動」；2.1-C 空白地帶、2.3 定位句、2.4 四槓桿、2.5 三疑慮的自動算分與自動組句尚未全部抽成 `derived` 黃金規則。
- 基線中標記為「任務」的完成標準頁先以通用欄位呈現，下一輪可改為 checklist／score／readout，仍不需要新增 stage 專屬 React 元件。
- `origin: authored` 的「一頁完成一個小步驟」是 UI 導引文案，不修改教材原文；正式教材文字仍從 Markdown／lecture page 讀取。

## 下一輪建議順序

1. 把 2.1-C 的 ①～④判定、2.3-C 三測試、2.4 四格分數、2.5 三疑慮強度加入通用 `derived` ops 與黃金測試。
2. 把 2.1-B、2.2-A、2.5-C 等多欄表格由逐欄輸入提升為 `table`／`tableDynamic` block，保留原 legacy row-major mapping。
3. 補上階段二附錄的跨階段 prefill（階段一答案 → 階段二空白欄位），並以 `sourceRef` 與測試保護不覆寫學員已編輯內容。
4. 進行 375px／1280px 真實瀏覽器 QA，再逐步提高 workspace 層級的 Flow feature flag。
