import "server-only";
// Server-only loader: reads flow.yaml + lecture Markdown from content/source (has node:fs — never import from a client component, R-8).
import fs from "node:fs";
import path from "node:path";
import { extractSection, loadFlowSpec } from "./parse";
import { validateFlow } from "./validate";
import type { FlowSpec } from "./schema";

export type LoadedFlow = { spec: FlowSpec; lectures: Record<string, string>; warnings: string[] };

function read(stageKey: string, match: (n: string) => boolean) {
  const dir = path.join(process.cwd(), "content", "source", stageKey);
  if (!fs.existsSync(dir)) return "";
  const f = fs.readdirSync(dir).find((n) => n.endsWith(".md") && match(n));
  return f ? fs.readFileSync(path.join(dir, f), "utf8") : "";
}

/** Returns null when the stage has no flow.yaml (→ caller falls back to the old TaskFlow, D-03). Throws on an invalid file. */
export function loadStageFlow(stageKey: string): LoadedFlow | null {
  const file = path.join(process.cwd(), "content", "source", stageKey, "flow.yaml");
  if (!fs.existsSync(file)) return null;
  const lecture = read(stageKey, (n) => n.includes("講義"));
  const assignment = read(stageKey, (n) => n.includes("作業"));
  const spec = loadFlowSpec(fs.readFileSync(file, "utf8"), lecture);
  const report = validateFlow(spec, { 作業: assignment, 講義: lecture });
  if (report.errors.length) throw new Error(`flow.yaml 驗證失敗：\n${report.errors.join("\n")}`);
  // Lecture text is resolved per page here, so the client never needs the whole lecture file (plan Phase 8: load lectures by page).
  const lectures: Record<string, string> = {};
  for (const [pid, page] of Object.entries(spec.pages)) {
    page.blocks.forEach((b, i) => {
      if (b.type === "lecture") lectures[`${pid}#${i}`] = extractSection(lecture, b.sourceRef) || "這一段講義尚未整理，請先閱讀作業說明。";
    });
  }
  return { spec, lectures, warnings: report.warnings };
}
