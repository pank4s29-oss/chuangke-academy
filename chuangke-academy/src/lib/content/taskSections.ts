import fs from "node:fs";
import path from "node:path";

export type TaskSection = { key: string; title: string; lecture: string; assignment: string };
export type AssignmentOption = { key: string; label: string };
export type AssignmentField = {
  key: string;
  prompt: string;
  type: "text" | "textarea" | "checkboxes";
  options?: AssignmentOption[];
  multiple?: boolean;
};

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
  const assignmentSections = sections(assignment, /^#\s+(任務\s*\d+(?:\.\d+)?)\s*[:：]?\s*(.+)$/gm);
  return assignmentSections.map((task) => {
    const number = task.key;
    const lectureNumber = stageKey === "stage-01" ? `1.${number}` : number;
    const lectureMatch = lectureSections.find((item) => item.key === lectureNumber);
    return { key: `${stageKey}-${number.replace(/\./g, "-")}`, title: `任務 ${number}：${task.title}`, lecture: lectureMatch?.body ?? "此任務的講義內容正在整理中。請先閱讀作業說明。", assignment: task.body };
  });
}

function cleanPrompt(line: string) {
  return line.replace(/^\s*[-*]?\s*/, "").replace(/☐\s*/, "").replace(/＿＿+|_{4,}/g, "＿＿＿＿").replace(/\s+/g, " ").trim();
}

export function getAssignmentFields(assignment: string, taskKey: string): AssignmentField[] {
  const lines = assignment.split(/\r?\n/);
  const fields: AssignmentField[] = [];
  let index = 0;
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    if (/^\s*(?:[-*]\s*)?☐\s+/.test(line)) {
      const options: AssignmentOption[] = [];
      const start = cursor;
      while (cursor < lines.length && /^\s*(?:[-*]\s*)?☐\s+/.test(lines[cursor])) {
        const label = lines[cursor].replace(/^\s*(?:[-*]\s*)?☐\s+/, "").trim();
        options.push({ key: `${taskKey}-option-${index}-${options.length}`, label });
        cursor += 1;
      }
      cursor -= 1;
      const context = lines.slice(Math.max(0, start - 3), start).reverse().find((item) => item.trim() && !item.trim().startsWith(">")) ?? "請選擇符合你的項目";
      fields.push({ key: `${taskKey}-checkbox-${index}`, prompt: cleanPrompt(context), type: "checkboxes", options, multiple: !/只能勾一個|勾一個/.test(lines.slice(Math.max(0, start - 4), start + 1).join(" ")) });
      index += 1;
      continue;
    }
    if (/＿＿+|_{4,}/.test(line)) {
      fields.push({ key: `${taskKey}-answer-${index}`, prompt: cleanPrompt(line), type: line.length > 95 || line.includes("| ") ? "textarea" : "text" });
      index += 1;
    }
  }
  return fields;
}

export function readStageTasks(stageKey: string) {
  return readTaskSections(stageKey).map((task) => ({ ...task, fields: getAssignmentFields(task.assignment, task.key) }));
}

export type TaskWithFields = TaskSection & { fields: AssignmentField[] };

type TaskWithFieldsResult = TaskWithFields[];
export function readTaskSectionsWithFields(stageKey: string): TaskWithFieldsResult {
  return readStageTasks(stageKey);
}
