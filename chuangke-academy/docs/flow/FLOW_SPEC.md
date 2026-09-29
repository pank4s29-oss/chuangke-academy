# Flow 內容模型規格（v1）

程式：`src/lib/flow/schema.ts`（zod，單一事實來源）。以下為摘要。

- **頂層**：`schemaVersion, stage, title, tasks, flows, pages, questions, tables, derived, blueprint, dropped`
- **flows**：`{label, parts:[{label, pages:[pageId]}]}`。多個 flow 共用同一批 pages／questions。
- **page**：`title, sourceRef?, blocks[] 或 lectureChapter, showWhen?`。`lectureChapter` 會依講義的 `##` 自動展開成多頁。預設不擋下一頁。
- **block 類型**：`prose callout quote details lecture choice pickerGroup text textarea number date sentence readout check tip likert table tableDynamic score schedule checklist blueprint group`
- **question**：`kind(single|multi|text|textarea|number|date|json), label, options[{id,label,hint,other}], max, optional, derived, readonly, legacyKeys, legacyOtherKey, legacyReadKey, legacyParse, dualWrite, origin, sourceRef`
- **derived op**：`template format switch cases joinNonEmpty countEquals band whereAny charCount regexAbsent orderedList mapJoin firstNonEmpty dateAdd dateFormat weekSplit`（宣告式，不可執行任意程式；輸出為結構化片段，不是 HTML）
- **origin**：`source | source-derived | artifact-only | authored`
- **儲存**：新 key 存在 `answer_json`；`_flow` 保留鍵存頁面／模式／已編輯旗標；同時回寫舊位置 key（雙寫）。`stripFlowMeta()` 用於匯出與統計。
- **衍生句子**：未編輯 → 每次重算、不存；學員編輯 → 存並鎖定；「照選項重新組合」解鎖。
