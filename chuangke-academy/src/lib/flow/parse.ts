// YAML text -> validated FlowSpec. Pure (uses only the `yaml` parser), so tests and the server loader share it.
import { parse as parseYaml } from "yaml";
import { FlowFile, expandTables } from "./schema";
import type { FlowSpec, Page, SourceRef } from "./schema";

const norm = (s: string) => s.replace(/[\s\u3000*_`>#|]/g, "");

export function parseFlowText(text: string): FlowSpec {
  const raw = parseYaml(text);
  const result = FlowFile.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}：${i.message}`).join("\n");
    throw new Error(`flow 檔案格式錯誤：\n${msg}`);
  }
  return expandTables(result.data);
}

type Heading = { level: number; text: string; line: number };
function headings(md: string): { list: Heading[]; lines: string[] } {
  const lines = md.split(/\r?\n/);
  const list: Heading[] = [];
  lines.forEach((l, i) => { const m = /^(#{1,6})\s+(.*)$/.exec(l); if (m) list.push({ level: m[1].length, text: m[2].trim(), line: i }); });
  return { list, lines };
}

/** Markdown of a lecture/assignment section: `heading` (any level) and optionally a `step` sub-heading inside it. */
export function extractSection(md: string, ref: Pick<SourceRef, "heading" | "step">): string {
  const { list, lines } = headings(md);
  const idx = list.findIndex((h) => norm(h.text).includes(norm(ref.heading)));
  if (idx < 0) return "";
  const end = (from: number, level: number) => { const n = list.slice(from + 1).find((h) => h.level <= level); return n ? n.line : lines.length; };
  let start = list[idx].line + 1;
  let stop = end(idx, list[idx].level);
  if (ref.step) {
    const sub = list.findIndex((h, i) => i > idx && h.line < stop && norm(h.text).includes(norm(ref.step!)));
    if (sub < 0) return "";
    start = list[sub].line + 1;
    stop = end(sub, list[sub].level);
  }
  return lines.slice(start, stop).join("\n").replace(/^\s*---\s*$/gm, "").trim();
}

/** Titles of the "##" sections inside a lecture chapter (used to expand `lectureChapter` pages). */
export function chapterSections(md: string, chapter: string): string[] {
  const { list } = headings(md);
  const idx = list.findIndex((h) => h.level === 1 && norm(h.text).includes(norm(chapter)));
  if (idx < 0) return [];
  const out: string[] = [];
  for (const h of list.slice(idx + 1)) { if (h.level === 1) break; if (h.level === 2) out.push(h.text); }
  return out;
}

/** Replace each `lectureChapter` page by one page per "##" section (ids `${id}.${n}`), keeping flow order. */
export function expandLecturePages(spec: FlowSpec, lectureMd: string): FlowSpec {
  const pages: Record<string, Page> = {};
  const expanded = new Map<string, string[]>();
  for (const [id, page] of Object.entries(spec.pages)) {
    if (!page.lectureChapter) { pages[id] = page; continue; }
    const secs = chapterSections(lectureMd, page.lectureChapter);
    if (!secs.length) { pages[id] = { ...page, blocks: [{ type: "lecture", sourceRef: { file: "講義", heading: page.lectureChapter } }] }; continue; }
    const ids: string[] = [];
    secs.forEach((title, i) => {
      const pid = `${id}.${i + 1}`;
      ids.push(pid);
      pages[pid] = { ...page, lectureChapter: undefined, title: `${page.title}｜${title.replace(/[※]/g, "").trim()}`, blocks: [{ type: "lecture", sourceRef: { file: "講義", heading: page.lectureChapter!, step: title } }] };
    });
    expanded.set(id, ids);
  }
  const flows = Object.fromEntries(Object.entries(spec.flows).map(([k, f]) => [k, { ...f, parts: f.parts.map((part) => ({ ...part, pages: part.pages.flatMap((p) => expanded.get(p) ?? [p]) })) }]));
  return { ...spec, pages, flows };
}

export function loadFlowSpec(yamlText: string, lectureMd = ""): FlowSpec {
  const spec = parseFlowText(yamlText);
  return lectureMd ? expandLecturePages(spec, lectureMd) : spec;
}
