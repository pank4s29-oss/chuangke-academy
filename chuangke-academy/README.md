# 創客學院 Course Engine

這是一套以 **Markdown 作為課程內容來源、Next.js 作為學員介面、Supabase 作為資料層、GitHub Actions 作為內容同步入口** 的課程系統。現階段已完成學生端 MVP：學員可以從課程總覽進入階段、先閱讀學習重點，再直接填寫作業，答案會自動保存到瀏覽器。

## 本次完成內容

- 建立 `/app` 課程總覽與階段卡片。
- 建立通用階段工作區：先理解／開始作業雙模式、任務切換、完成度進度條、必填與最小字數驗證。
- 使用 `localStorage` 做離線優先的答案自動保存，避免尚未設定登入時遺失內容。
- 保留 Supabase migration 的課程版本、作答與進度資料表，並補上安全的 `.env.example`。
- 調整首頁、metadata、繁體中文語系與行動裝置版面。

## 本機開發

```bash
pnpm install
pnpm dev
```

驗證指令：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Supabase 設定

1. 在 Supabase 建立專案。
2. 到 SQL Editor 執行 `supabase/migrations/202609180001_initial_course_engine.sql`。
3. 在 Vercel 的 **Production、Preview、Development** 環境設定 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
4. `SUPABASE_SERVICE_ROLE_KEY` 只能放在 GitHub Actions 或 server-side environment，不能放在 `NEXT_PUBLIC_*`、前端程式或 Git repository。
5. 目前 MVP 先將答案保存在瀏覽器；跨裝置同步前仍需要接上 Supabase Auth，並在 server action / route handler 中使用使用者 session 寫入 `answers` 與 `progress`。這一步不能用 service role key 直接取代登入，否則會繞過 RLS。

## Vercel 設定

在 Vercel 匯入 `pank4s29-oss/chuangke-academy`，Root Directory 保持 repository 根目錄，Framework 選 Next.js，Install Command 使用 `pnpm install --frozen-lockfile`，Build Command 使用 `pnpm build`。每次 push 到 `main` 會產生 production deployment；pull request 會產生 preview deployment。

若 Vercel build 顯示 lockfile 不同步，請確認 `pnpm-lock.yaml` 與 `package.json` 是同一次提交產生，並在本機執行 `pnpm install` 後一併提交 lockfile。

## 內容維護原則

`content/source/` 是教材來源；新增或修改 Markdown 不應直接在 React page 硬編碼。下一階段應完成 Markdown parser、draft import、admin preview 與 publish workflow，讓內容變更先進 Supabase draft，人工確認後才發布。

## 目前尚未完成的高優先工作

- Supabase Auth 與跨裝置答案／進度同步。
- 將 Stage 1、Stage 2 Markdown 完整解析成 canonical content JSON，而不是只使用目前的 MVP sample mapping。
- GitHub Actions 的 content sync workflow 與 Supabase draft upsert。
- Admin 權限、draft preview、validation report 與 publish 操作。
- 以 Vitest 補 parser、validation、answer persistence 與完整學員流程測試。
