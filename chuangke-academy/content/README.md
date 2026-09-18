# 創客學院｜Course Content Source

本目錄保存課程的原始 Markdown Source。

## 結構

```text
content/source/
├── stage-01/
│   ├── lecture.md
│   └── assignment.md
├── stage-02/
│   ├── lecture.md
│   └── assignment.md
└── stage-03/
    ├── lecture.md
    └── assignment.md
```

目前未提供的階段一內容不得自行虛構。

## 自動 Import

GitHub `main` 分支的：

```text
content/source/**/*.md
```

新增／修改／刪除／rename 會觸發：

```text
.github/workflows/content-sync.yml
```

流程：

```text
GitHub Source
   ↓
Change Manifest
   ↓
Content Importer
   ↓
Supabase Draft
   ↓
Admin Preview / Validate
   ↓
Publish
```

此 workflow 不負責 Publish。

## 最重要的規則

1. Markdown 是 Source of Truth。
2. 不要在 React page 裡硬編碼課程內容。
3. 不要因新增 Stage 而建立 Stage 專屬 page。
4. 新題型才擴充通用 Question Engine。
5. 不確定的 Markdown 結構產生 Import Warning，不要猜。
6. Published Version 不可被 GitHub Import 直接覆蓋。
7. Source 修改後，Importer 應按 Stage 重新組裝完整 canonical content。
8. 相同 source hash 重跑應具備 idempotency。

詳細規格：

- `docs/CONTENT_SYNC_SPEC.md`
- `docs/CODEX_CONTENT_SYNC_PROMPT.md`
- `docs/CONTENT_SYNC_SETUP.md`
