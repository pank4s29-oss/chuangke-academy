# 創客學院｜課程內容新增、Draft Import 與自動更新規格

## 目的

這份文件定義：未來如何把新的「講義 Markdown + 作業 Markdown」加入創客學院，而不需要重新開發網站頁面，並讓 GitHub push 自動完成 Draft Import。

## 目前資料夾

```text
content/source/
├── stage-01/
│   ├── lecture.md
│   └── assignment.md
└── stage-02/
    ├── lecture.md
    └── assignment.md
```

目前已提供的階段二原始檔應保留在 Stage 2 source folder。

## 新增 Stage 3 的方式

建立：

```text
content/source/stage-03/
├── lecture.md
└── assignment.md
```

然後只需要：

```bash
git add content/source/stage-03
git commit -m "content: add stage 03"
git push origin main
```

GitHub Actions 會自動：

```text
Detect change
→ Find affected Stage
→ Read complete Stage source set
→ Parse
→ Normalize
→ Validate
→ Create / update Supabase Draft
```

接著管理者在 Admin：

```text
Draft → Preview → Validate → Publish
```

## 自動化 workflow

入口：

`.github/workflows/content-sync.yml`

完整規格：

`docs/CONTENT_SYNC_SPEC.md`

Codex 實作指令：

`docs/CODEX_CONTENT_SYNC_PROMPT.md`

第一次啟用：

`docs/CONTENT_SYNC_SETUP.md`

## 重要：完整 Stage 重建

如果只修改：

```text
stage-02/lecture.md
```

Importer 不應只寫入 lecture。

應重新讀取：

```text
stage-02/lecture.md
stage-02/assignment.md
```

並建立該 Stage 的完整 Draft。

## 不應該做的事情

不要：

- 新增 `Stage3Page.tsx`
- 新增 `Stage3Task21.tsx`
- 在 `CoursePage` 中寫 `if(stage === 3)`
- 在 React page 中硬編碼課程題目
- 複製 Stage 2 的 UI 再改文字
- 因為 GitHub push 而直接 Publish

## 允許修改程式碼的情況

只有以下狀況可以修改核心 code：

> 新課程引入「以前沒有的題型」或「以前沒有的流程能力」。

例如：

- 新的題型
- 新的分支規則
- 新的驗收規則
- 新的內容 block type

這種情況應該擴充通用 engine，而不是建立該階段專屬 page。

## Published content 來源

網站前台使用 Supabase 的 published content。

GitHub Markdown 是 Source of Truth。

因此完整鏈路是：

```text
GitHub Markdown
   ↓
GitHub Actions
   ↓
Content Importer
   ↓
Supabase Draft
   ↓
Admin Preview
   ↓
Validation
   ↓
Publish
   ↓
Supabase Published Version
   ↓
Website
```

## 版本規則

如果修改已發布教材：

不要直接覆寫 published version。

建立新版本：

`v1 → v2`

保留舊版本。

## Question Key 規則

每一道有持續生命週期的題目都應有穩定 key，例如：

```text
stage2.task2_3.positioning.core_claim
```

不要使用 UI 頁碼作為永久 identity。

如果題目文字只是修正敘述但語意沒變，可以保持 key。

如果題目本身的語意／資料結構變了，建立新的 key。

## 匯入警告

解析失敗不能「猜」。

例如：

- 表格格式不完整
- 題型無法辨識
- 分支條件語意不完整
- 來源題目引用不存在

應保留原文並標記：

`Import Warning`

讓管理者在 Preview 時處理。

## 未來的標準操作

未來提供：

```text
新階段講義.md
新階段作業.md
```

放進：

```text
content/source/stage-XX/
```

Push 後系統應能把它們轉成：

```text
Stage
→ Lessons
→ Tasks
→ Steps
→ Questions
→ Rules
→ Dependencies
→ Artifacts
```

然後建立 Draft。

網站本身不需要重新開發。
