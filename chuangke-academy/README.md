# 創客學院 Course Engine

這是一套以 **Markdown 作為課程內容來源、Next.js 作為學員介面、Supabase 作為資料層、GitHub Actions 作為內容同步入口** 的課程系統。現階段已完成學生端 MVP：學員可以從課程總覽進入階段、先閱讀學習重點，再直接填寫作業；登入後答案會透過 Supabase RLS 同步到自己的帳號。

## 本次完成內容

- 建立 `/app` 課程總覽與階段卡片。
- 將階段一與階段二的正式教材依任務編號切開：每個任務都有「閱讀講義 → 完成對應作業 → 標記任務完成」的流程，不再把整本講義與作業堆在頁面底部。
- 任務完成狀態寫入 `submissions`，逐題答案仍由 `answers` 保存，兩者責任分離。
- 建立 Supabase SSR Auth：Email 登入／註冊、OAuth callback、middleware session refresh 與登出。
- 作答資料改以 `answers` table + RLS upsert，不再使用 `localStorage`；未登入時只保留當次頁面的 React state。
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

1. 在 Supabase 建立專案，依序執行 `202609180001_initial_course_engine.sql`、`202609180002_auth_answer_sync.sql` 與 `202609180003_task_submissions_contract.sql`。
2. 在 Authentication → URL Configuration 設定 Site URL 為 Vercel production URL，Redirect URLs 加入 `https://你的網域/auth/callback?next=/app` 及本機 `http://localhost:3000/auth/callback?next=/app`。
3. 在 Vercel 的 **Production、Preview、Development** 環境設定 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
4. `SUPABASE_SERVICE_ROLE_KEY` 只能放在 GitHub Actions 或 server-side environment，不能放在 `NEXT_PUBLIC_*`、前端程式或 Git repository。本次學生端作答同步不需要 service role key。
5. `/auth/login` 使用 `signInWithPassword`／`signUp`，`/auth/callback` 交換 code 成 session，`middleware.ts` 負責刷新 cookie；`StageWorkspace` 用目前登入者的 session 查詢與 upsert `answers`。
6. 若 Supabase 尚未設定，公開頁面仍可 build；登入按鈕會在設定正式 URL／key 後啟用。

## Vercel 設定

在 Vercel 匯入 `pank4s29-oss/chuangke-academy`。**Root Directory 必須留白（repository root），不要填 `chuangke-academy`**，因為 GitHub repository 的根目錄就包含 `package.json`、`pnpm-lock.yaml` 與 `next.config.mjs`。Framework 選 Next.js，Install Command 使用 `pnpm install --frozen-lockfile`，Build Command 使用 `pnpm build`。repository 根目錄的 `vercel.json` 也已指定這些設定。

若出現 `No Next.js version detected`，先到 Vercel Settings → General → Root Directory 將值清空並 Save，再重新 Deploy；不要把本機 clone 的資料夾名稱當成 repository 子目錄。若 build 顯示 lockfile 不同步，請確認 `pnpm-lock.yaml` 與 `package.json` 是同一次提交產生，並在本機執行 `pnpm install` 後一併提交 lockfile。

## 內容維護原則

`content/source/` 是教材來源；新增或修改 Markdown 不應直接在 React page 硬編碼。下一階段應完成 Markdown parser、draft import、admin preview 與 publish workflow，讓內容變更先進 Supabase draft，人工確認後才發布。

## 目前尚未完成的高優先工作

- 將 `progress` 也接上跨裝置同步，並在課程版本發布後補上 `content_version_id`。
- 為每個任務補上更細的題目元件，讓正式作業中的每個子題都能直接在線上輸入，而不只是閱讀 Markdown 後標記完成。
- 將 Stage 1、Stage 2 Markdown 完整解析成 canonical content JSON，而不是只使用目前的 MVP sample mapping。
- GitHub Actions 的 content sync workflow 與 Supabase draft upsert。
- Admin 權限、draft preview、validation report 與 publish 操作。
- 以 Vitest 補 parser、validation、answer persistence 與完整學員流程測試。
