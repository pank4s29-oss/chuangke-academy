"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMessage(error.message); return; }
    window.location.href = "/app";
  }

  async function signUp() {
    setLoading(true); setMessage(null);
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` } });
    setLoading(false); setMessage(error ? error.message : "註冊成功，請檢查信箱完成驗證。");
  }

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f4] px-5"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70"><Link href="/" className="text-sm font-semibold text-teal-700">← 返回創客學院</Link><h1 className="mt-8 text-3xl font-bold">登入學習工作區</h1><p className="mt-3 text-sm leading-6 text-slate-500">登入後，作答會同步到 Supabase，可在不同裝置繼續學習。</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block text-sm font-semibold">Email<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm font-semibold">密碼<input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button disabled={loading} className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "處理中…" : "登入"}</button></form><button disabled={loading || !email || password.length < 6} onClick={signUp} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">使用這組 Email 註冊</button>{message && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{message}</p>}</div></main>;
}
