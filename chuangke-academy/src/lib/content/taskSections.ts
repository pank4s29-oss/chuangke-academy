import fs from "node:fs";
import path from "node:path";

export type TaskSection = { key: string; title: string; lecture: string; assignment: string };
export type AssignmentOption = { key: string; label: string };
export type AssignmentField = { key: string; prompt: string; type: "text" | "textarea" | "checkboxes"; options?: AssignmentOption[]; multiple?: boolean; group?: string; source?: "structured" | "legacy" | "table" };

function readFirst(stageKey: string, matcher: (file: string) => boolean) {
  const directory = path.join(process.cwd(), "content", "source", stageKey);
  const file = fs.readdirSync(directory).find((name) => name.endsWith(".md") && matcher(name));
  return file ? fs.readFileSync(path.join(directory, file), "utf8") : "";
}
function sections(source: string, pattern: RegExp) {
  const matches = [...source.matchAll(pattern)];
  return matches.map((match, index) => ({ key: match[1].match(/\d+(?:\.\d+)*/)?.[0] ?? match[1].trim(), title: match[2].trim(), body: source.slice(match.index ?? 0, matches[index + 1]?.index ?? source.length).trim() }));
}
export function readTaskSections(stageKey: string): TaskSection[] {
  const lecture = readFirst(stageKey, (file) => file.includes("講義"));
  const assignment = readFirst(stageKey, (file) => file.includes("作業"));
  const lectureSections = sections(lecture, /^#\s+((?:\d+\.\d+)|(?:任務\s*\d+(?:\.\d+)?))\s*[:：]?\s*(.+)$/gm);
  return sections(assignment, /^#\s+(任務\s*\d+(?:\.\d+)?)\s*[:：]?\s*(.+)$/gm).map((task) => {
    const number = task.key;
    const lectureMatch = lectureSections.find((item) => item.key === (stageKey === "stage-01" ? `1.${number}` : number));
    return { key: `${stageKey}-${number.replace(/\./g, "-")}`, title: `任務 ${number}：${task.title}`, lecture: lectureMatch?.body ?? "此任務的講義內容正在整理中。請先閱讀作業說明。", assignment: task.body };
  });
}
function cleanPrompt(line: string) { return line.replace(/^\s*[-*]?\s*/, "").replace(/☐\s*/, "").replace(/\[\s*[xX ]\s*\]\s*/, "").replace(/＿＿+|_{4,}|\{\{blank:[^}]+\}\}/g, "＿＿＿＿").replace(/\s+/g, " ").trim(); }
function meaningfulContext(lines: string[], index: number) { return lines.slice(Math.max(0, index - 5), index).reverse().find((item) => { const value = item.trim(); return value && !value.startsWith(">") && !value.startsWith("|") && !value.startsWith("<!--") && !/^[-*_]{3,}$/.test(value); }) ?? "請完成這一題"; }
function isTableRow(line: string) { return /^\s*\|.*\|\s*$/.test(line); }
function tableCells(line: string) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }
function isSeparatorRow(line: string) { return isTableRow(line) && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell)); }
function hasBlank(cell: string) { return /＿＿+|_{4,}|\{\{blank:[^}]+\}\}/.test(cell) || cell.trim() === ""; }
function questionMetadata(lines: string[], index: number) { const match = lines.slice(Math.max(0, index - 3), index).join(" ").match(/<!--\s*q:(single|multi|text|long)(?:\s+id=([^\s]+))?\s*-->/i); return match ? { type: match[1].toLowerCase(), id: match[2] } : undefined; }

export function getAssignmentFields(assignment: string, taskKey: string): AssignmentField[] {
  const lines = assignment.split(/\r?\n/);
  const fields: AssignmentField[] = [];
  let index = 0;
  const add = (field: Omit<AssignmentField, "key">, stableId?: string) => { fields.push({ ...field, key: stableId ? `${taskKey}-${stableId}` : `${taskKey}-answer-${index}` }); index += 1; };
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim() || line.trim().startsWith("<!--")) continue;
    if (isTableRow(line) && cursor + 1 < lines.length && isSeparatorRow(lines[cursor + 1])) {
      const headers = tableCells(line); cursor += 2;
      while (cursor < lines.length && isTableRow(lines[cursor])) {
        const cells = tableCells(lines[cursor]); const rowLabel = cells[0] || `第 ${cursor} 列`;
        cells.forEach((cell, cellIndex) => { if (cellIndex === 0 || !hasBlank(cell)) return; const header = headers[cellIndex] || "答案"; add({ prompt: `${rowLabel}｜${header}`, type: cell.length > 28 || header.includes("原話") || header.includes("內容") ? "textarea" : "text", group: headers[0] || "表格作答", source: "table" }); }); cursor += 1;
      }
      cursor -= 1; continue;
    }
    const isTaskCheckbox = /^\s*(?:[-*]\s*)?\[[ xX]\]\s+/.test(line);
    const isLegacyCheckbox = /^\s*(?:[-*]\s*)?☐\s+/.test(line);
    if (isTaskCheckbox || isLegacyCheckbox) {
      const options: AssignmentOption[] = []; const start = cursor;
      while (cursor < lines.length && (/^\s*(?:[-*]\s*)?\[[ xX]\]\s+/.test(lines[cursor]) || /^\s*(?:[-*]\s*)?☐\s+/.test(lines[cursor]))) { const label = lines[cursor].replace(/^\s*(?:[-*]\s*)?\[[ xX]\]\s+/, "").replace(/^\s*(?:[-*]\s*)?☐\s+/, "").trim(); options.push({ key: `${taskKey}-option-${index}-${options.length}`, label }); cursor += 1; }
      cursor -= 1; const metadata = questionMetadata(lines, start); const single = metadata?.type === "single" || /只能勾一個|勾一個/.test(lines.slice(Math.max(0, start - 4), start + 1).join(" ")); add({ prompt: cleanPrompt(meaningfulContext(lines, start)), type: "checkboxes", options, multiple: !single, group: cleanPrompt(meaningfulContext(lines, start)), source: metadata ? "structured" : "legacy" }, metadata?.id);
      continue;
    }
    const inlineOptions = [...line.matchAll(/(?:☐|\[\s*[xX ]\s*\])\s*([^☐\[]+)/g)].map((match) => match[1].trim()).filter(Boolean);
    if (inlineOptions.length >= 2) { add({ prompt: cleanPrompt(line.replace(/☐\s*[^☐]+/g, "").replace(/\[[ xX]\]\s*[^\[]+/g, "").replace(/\s+/g, " ")) || cleanPrompt(meaningfulContext(lines, cursor)), type: "checkboxes", options: inlineOptions.map((label, optionIndex) => ({ key: `${taskKey}-option-${index}-${optionIndex}`, label })), multiple: true, group: cleanPrompt(meaningfulContext(lines, cursor)), source: "legacy" }); continue; }
    const blankMatch = line.match(/\{\{blank:([^}]+)\}\}/);
    if (blankMatch || /＿＿+|_{4,}/.test(line)) { const metadata = questionMetadata(lines, cursor); add({ prompt: cleanPrompt(line), type: metadata?.type === "long" || line.length > 95 ? "textarea" : "text", group: cleanPrompt(meaningfulContext(lines, cursor)), source: metadata ? "structured" : "legacy" }, metadata?.id ?? (blankMatch ? blankMatch[1] : undefined)); }
  }
  return fields;
}
export function readStageTasks(stageKey: string) { return readTaskSections(stageKey).map((task) => ({ ...task, fields: getAssignmentFields(task.assignment, task.key) })); }
export type TaskWithFields = TaskSection & { fields: AssignmentField[] };
export function readTaskSectionsWithFields(stageKey: string): TaskWithFields[] { return readStageTasks(stageKey); }
