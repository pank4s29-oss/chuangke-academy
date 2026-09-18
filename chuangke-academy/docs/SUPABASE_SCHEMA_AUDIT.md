# Supabase 資料表契約檢查

## 檢查結論

目前學生端任務流程使用四類資料：Supabase 管理的 `auth.users`、應用層 `public.profiles`、階段進度 `public.progress`，以及作業提交 `public.submissions`。原本的 `public.answers` 仍保留，供逐題作答與內容版本同步使用；新的任務完成狀態不再誤寫入 `answers`。

本次檢查是依 repository 中的 migration、前端 Supabase query 與教材任務編號完成。當前 session 沒有可讀取你遠端 Supabase 專案的連線憑證，因此無法宣稱已直接查詢線上資料庫；請在 Supabase SQL Editor 依序執行 migration 後，再使用下方查詢驗證實際 schema。

## 資料表責任

| 資料表 | 來源 | 用途 | 前端目前使用方式 |
|---|---|---|---|
| `auth.users` | Supabase Auth 內建 | 登入身份 | `supabase.auth.getUser()` 取得 `user.id` |
| `public.profiles` | `202609180003` | 顯示名稱等應用層資料 | 已建立 RLS，之後可接個人資料頁 |
| `public.courses` | 初始 migration | 課程主檔 | 內容發布流程使用 |
| `public.stages` | 初始 migration | 已發布階段與 UUID | `progress.stage_id` 的正式來源 |
| `public.content_versions` | 初始 migration | Draft／Published 內容版本 | 後續將連接 Markdown importer |
| `public.answers` | 初始 migration | 逐題答案 | 逐題題目引擎使用 `stage_key`、`question_key`、`value` |
| `public.progress` | `202609180003` 擴充 | 階段最後位置與完成進度 | 目前保留契約，任務完成狀態由 `submissions` 管理 |
| `public.submissions` | `202609180003` | 一個任務的一次完成提交 | TaskFlow 使用 `(user_id, stage_key, task_key)` upsert |

## 目前修正的欄位對應

原本前端把「任務完成」寫進 `answers`，但 `answers` 是逐題資料，且要求 `content_version_id`。這會造成任務完成狀態與題目答案混在一起，也容易因為 nullable version id 產生重複資料。

現在改成：

```text
TaskFlow
  → public.submissions
  → user_id + stage_key + task_key
  → status = draft | completed
  → answer_json = 任務級資料
```

逐題答案仍使用：

```text
StageWorkspace
  → public.answers
  → user_id + stage_key + question_key
  → value = jsonb
```

`progress.stage_id` 原本是必填 UUID，但目前 Markdown 任務流程使用穩定的 `stage_key`。因此 migration 將 `stage_id` 改為可空，新增 `course_key` 與 `stage_key`，等正式 Published stage 建立後再填入 `stage_id`。

## 執行 migration

請在 Supabase SQL Editor 依序執行：

```text
supabase/migrations/202609180001_initial_course_engine.sql
supabase/migrations/202609180002_auth_answer_sync.sql
supabase/migrations/202609180003_task_submissions_contract.sql
```

若使用 Supabase CLI，請執行：

```bash
supabase db push
```

完成後若 API 暫時看不到新欄位，請在 Supabase Dashboard 的 API 設定執行 schema reload，或等待 PostgREST 自動重新載入。

## 線上驗證查詢

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('auth', 'public')
  and table_name in ('users', 'profiles', 'courses', 'stages', 'content_versions', 'answers', 'progress', 'submissions')
order by table_schema, table_name;
```

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'answers', 'progress', 'submissions')
order by table_name, ordinal_position;
```

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'answers', 'progress', 'submissions')
order by tablename, policyname;
```

預期結果是：`auth.users` 存在但不由 application migration 建立；`profiles`、`progress`、`submissions` 都有 authenticated 使用者自己的 RLS policy；`submissions` 有唯一索引 `(user_id, stage_key, task_key)`；`answers` 有新的 `(user_id, stage_key, question_key)` 唯一索引。

## 安全檢查

前端只使用 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。所有新增資料都帶入目前 Supabase session 的 `user.id`，而資料庫 policy 再以 `auth.uid()` 做第二層限制。`SUPABASE_SERVICE_ROLE_KEY` 不應出現在前端、`NEXT_PUBLIC_*` 或 Git repository。
