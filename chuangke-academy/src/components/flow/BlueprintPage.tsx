"use client";
import { useState } from "react";
import { cellKey, tableRowCount } from "@/lib/flow/schema";
import type { Ctx } from "./blocks";

export function blueprintText(c: Ctx, name: string) {
  const lines: string[] = [];
  for (const s of c.spec.blueprint.sections) {
    lines.push(`■ ${s.title}`);
    for (const it of s.items) {
      if (it.table) {
        const t = c.spec.tables[it.table];
        lines.push(`${it.label}：`);
        for (let r = 1; r <= tableRowCount(t); r++) { const cells = t.columns.map((col) => String(c.eng.value(cellKey(it.table!, r, col.id)) || "")).filter(Boolean); if (cells.length) lines.push(`  ${r}. ${cells.join("｜")}`); }
      } else {
        const v = c.eng.labels(it.value!).join("、") || String(c.eng.value(it.value!) || "");
        lines.push(`${it.label}：${v.trim() || it.fallback}`);
      }
    }
    lines.push("");
  }
  return `${name ? `${name} 的階段一系統藍圖\n\n` : ""}${lines.join("\n")}`.trim();
}

export default function BlueprintPage({ c }: { c: Ctx }) {
  const [copied, setCopied] = useState<"" | "ok" | "manual">("");
  const name = c.spec.blueprint.nameKey ? String(c.eng.value(c.spec.blueprint.nameKey) || "") : "";
  const text = blueprintText(c, name);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied("ok"); } catch { setCopied("manual"); }
  }
  return (
    <div className="flow-bp">
      <div className="flow-bp-sheet" id="flow-blueprint">
        {name && <div className="flow-bp-name">{name}</div>}
        {c.spec.blueprint.sections.filter((s) => !s.copyOnly).map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            {s.items.map((it) => it.table
              ? <div key={it.label} className="flow-bp-item"><div className="flow-bp-label">{it.label}</div><ol>{Array.from({ length: tableRowCount(c.spec.tables[it.table]) }, (_x, i) => { const cells = c.spec.tables[it.table!].columns.map((col) => String(c.eng.value(cellKey(it.table!, i + 1, col.id)) || "")).filter(Boolean); return cells.length ? <li key={i}>{cells.join("｜")}</li> : null; })}</ol></div>
              : <div key={it.label} className="flow-bp-item"><div className="flow-bp-label">{it.label}</div><div className="flow-bp-value">{(c.eng.labels(it.value!).join("、") || String(c.eng.value(it.value!) || "")).trim() || <span className="flow-bp-tbd">{it.fallback}</span>}</div></div>)}
          </section>
        ))}
      </div>
      <div className="flow-bp-actions">
        <button type="button" className="flow-btn" onClick={copy}>複製全部答案</button>
        <button type="button" className="flow-btn flow-btn-ghost" onClick={() => window.print()}>列印這一頁</button>
      </div>
      {copied === "ok" && <div className="flow-tone flow-tone-good" role="status">已複製，可以直接貼到 LINE 或 Google 文件。</div>}
      {copied === "manual" && <div><div className="flow-hint">這個瀏覽器不允許自動複製，請手動全選複製：</div><textarea className="flow-input" rows={10} readOnly value={text} onFocus={(e) => e.currentTarget.select()} /></div>}
    </div>
  );
}
