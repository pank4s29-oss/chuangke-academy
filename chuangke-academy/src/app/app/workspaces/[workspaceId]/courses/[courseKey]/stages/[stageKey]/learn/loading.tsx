export default function Loading() {
  return <div className="min-h-screen bg-[#f5f7f4] text-slate-900">
    <header className="border-b border-slate-200/80 bg-white/95"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-5 lg:px-8"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-sm font-bold text-white">創</span><span className="font-semibold">創客學院</span></div><div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" /></div></header>
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:gap-8 lg:px-8">
      <aside className="space-y-4"><div className="h-3 w-24 animate-pulse rounded bg-teal-100" /><div className="h-8 w-48 animate-pulse rounded bg-slate-200" /><div className="h-20 animate-pulse rounded-2xl bg-slate-200/70" /><div className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70" /></aside>
      <section className="min-w-0 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-8 lg:p-10"><div className="h-4 w-24 animate-pulse rounded bg-teal-100" /><div className="mt-4 h-10 max-w-xl animate-pulse rounded bg-slate-200" /><div className="mt-3 h-5 max-w-2xl animate-pulse rounded bg-slate-100" /><div className="mt-8 h-12 animate-pulse rounded-2xl bg-slate-100" /><div className="mt-6 space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /></div></section>
    </main>
  </div>;
}
