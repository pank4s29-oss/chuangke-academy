import fs from "node:fs";
import path from "node:path";

export type TaskSection = { key: string; title: string; lecture: string; assignment: string };

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
  const tasks = assignmentSections;
  return tasks.map((task) => {
    const number = task.key;
    const lectureNumber = stageKey === "stage-01" ? `1.${number}` : number;
    const lectureMatch = lectureSections.find((item) => item.key === lectureNumber);
    return { key: `${stageKey}-${number.replace(/\./g, "-")}`, title: `任務 ${number}：${task.title}`, lecture: lectureMatch?.body ?? "此任務的講義內容正在整理中。請先閱讀作業說明。", assignment: task.body };
  });
}
