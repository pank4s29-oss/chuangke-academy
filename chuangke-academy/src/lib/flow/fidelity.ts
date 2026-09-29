// Text-fidelity helpers (R-6): every learner-facing string must appear in the source Markdown or be flagged origin: authored.
import type { BlockT, FlowSpec } from "./schema";

const strip = (s: string) => s.replace(/[\s\u3000*_`>#|\-－—:：]/g, "").replace(/[（(][^）)]*[）)]/g, (m) => m);

export type FidelityItem = { where: string; text: string };

function blockTexts(b: BlockT, where: string, out: FidelityItem[]) {
  if ("origin" in b && b.origin === "authored" && "text" in b) return;
  if (b.type === "prose" || b.type === "callout" || b.type === "quote") out.push({ where, text: b.text });
  if (b.type === "details") out.push({ where, text: b.text }, { where, text: b.summary });
  if (b.type === "group") b.blocks.forEach((x, i) => blockTexts(x, `${where}>group[${i}]`, out));
}

export function collectLearnerText(spec: FlowSpec): FidelityItem[] {
  const out: FidelityItem[] = [];
  for (const [pid, page] of Object.entries(spec.pages)) {
    if (page.lectureChapter) continue;
    page.blocks.forEach((b, i) => blockTexts(b as BlockT, `${pid}[${i}]`, out));
  }
  for (const [k, q] of Object.entries(spec.questions)) {
    if (/\.r\d+\./.test(k)) continue; // table cells: labels are composed from column/row headings
    if (q.origin !== "authored") {
      out.push({ where: `${k}.label`, text: q.label });
      if (q.hint) out.push({ where: `${k}.hint`, text: q.hint });
    }
    for (const o of q.options ?? []) { out.push({ where: `${k}.option.${o.id}`, text: o.label }); if (o.hint) out.push({ where: `${k}.option.${o.id}.hint`, text: o.hint }); }
  }
  for (const [k, d] of Object.entries(spec.derived)) {
    if (d.origin === "authored") continue;
    if (d.op === "switch") for (const [c, t] of Object.entries(d.cases)) out.push({ where: `${k}.case.${c}`, text: t });
    if (d.op === "cases") d.cases.forEach((c, i) => out.push({ where: `${k}.case[${i}]`, text: c.template }));
    if (d.op === "band") d.bands.forEach((b, i) => out.push({ where: `${k}.band[${i}]`, text: `${b.label}，${b.detail}` }));
  }
  return out;
}

/** Items whose text (after stripping markup, whitespace, and template placeholders) is NOT found in the source. */
export function findUnmatched(items: FidelityItem[], sources: string[]): FidelityItem[] {
  const hay = strip(sources.join("\n"));
  return items.filter((it) => {
    const pieces = it.text.split(/\{\{[^}]*\}\}|\\n|\n/).map(strip).filter((p) => p.length >= 4);
    return pieces.some((p) => !hay.includes(p));
  });
}
