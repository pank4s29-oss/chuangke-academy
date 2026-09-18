import Link from "next/link";

export default function Home() {
  return <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16"><p className="text-sm font-semibold tracking-[.2em] text-teal-700">創客學院 · COURSE ENGINE MVP</p><h1 className="max-w-3xl text-5xl font-bold tracking-tight">把課程內容變成可完成的商業成果。</h1><p className="max-w-2xl text-lg leading-8 text-zinc-600">通用引擎依內容資料呈現階段、任務、步驟與題目；新階段不需要新頁面。</p><div className="flex gap-3"><Link className="rounded-lg bg-teal-700 px-5 py-3 font-medium text-white" href="/app">進入課程</Link><Link className="rounded-lg border px-5 py-3 font-medium" href="/admin/content">內容管理</Link></div></main>;
}
