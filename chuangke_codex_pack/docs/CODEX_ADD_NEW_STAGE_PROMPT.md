# Codex Prompt｜新增課程階段

請先讀取 `AGENTS.md` 與 `docs/COURSE_CONTENT_IMPORT_GUIDE.md`。

我現在要新增一個創客學院課程階段。

我會提供：

- 一份講義 Markdown
- 一份作業 Markdown

請依照現有 Content Engine 執行：

```text
Source Markdown
→ Parse
→ Normalize
→ Draft
→ Content Integrity Check
→ Admin Preview
→ Validation
→ Publish
→ Supabase Published Content
→ Website
```

要求：

1. 不修改課程原意。
2. 不擅自補寫原始文件不存在的內容。
3. 將內容放入 `content/source/stage-XX/` 後，以 GitHub push 觸發自動 Draft Import；不要要求人工執行 parser。
4. 保留原始 Markdown。
5. 產生 content version。
6. 建立穩定的 stage / lesson / task / step / question identity。
7. 驗證 question_key 唯一性。
8. 驗證所有 answer dependency。
9. 驗證所有 navigation target。
10. 驗證 validation rules。
11. 所有不確定的解析結果標為 Import Warning。
12. 不直接 publish，先建立 Draft 並提供 Preview 結果。
13. 不為新 Stage 建立專屬 React page。
14. 不新增 AI Coach。
15. 除非真的新增了系統尚未支援的題型／流程能力，否則不要修改核心 application code。

最後回報：

```text
Stage
Source Files
Parsed Lessons
Parsed Tasks
Parsed Steps
Parsed Questions
Dependencies
Validation Rules
Import Warnings
Required Code Changes
Publish Readiness
```
