"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setEmail(data.user?.email ?? null); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user?.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  if (loading) return <span className="text-sm text-slate-400">登入狀態載入中…</span>;
  if (!email) return <Link href="/auth/login" className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">登入同步進度</Link>;
  return <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{email} · 登出</button>;
}
