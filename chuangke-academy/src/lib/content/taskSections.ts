import fs from "node:fs";
import path from "node:path";

export type TaskSection = { key: string; title: string; lecture: string; assignment: string };
export type AssignmentOption = { key: string; label: string; otherInputKey?: string };
export type AssignmentField = {
  key: string;
  prompt: string;
  type: "text" | "textarea" | "checkboxes";
  options?: AssignmentOption[];
  multiple?: boolean;
  group?: string;
  layout?: "table";
  tableRow?: string;
  tableColumn?: string;
  hiddenInGroup?: boolean;
  otherFor?: string;
};

function readFirst(stageKey: string, matcher: (file: string) => boolean) {
  const directory = path.join(process.cwd(), "content", "source", stageKey);
  const file = fs.readdirSync(directory).find((name) => name.endsWith(".md") && matcher(name));
  return file ? fs.readFileSync(path.join(directory, file), "utf8") : "";
}

function sections(source: string, pattern: RegExp) {
  const matches = [...source.matchAll(pattern)];
  return matches.map((match, index) => ({
    key: match[1].match(/\d+(?:\.\d+)*/)?.[0] ?? match[1].trim(),
    title: match[2].trim(),
    body: source.slice(match.index ?? 0, matches[index + 1]?.index ?? source.length).trim(),
  }));
}

export function readTaskSections(stageKey: string): TaskSection[] {
  const lecture = readFirst(stageKey, (file) => file.includes("講義"));
  const assignment = readFirst(stageKey, (file) => file.includes("作業"));
  const lectureSections = sections(lecture, /^#\s+((?:\d+\.\d+)|(?:任務\s*\d+(?:\.\d+)?))\s*[:：]?\s*(.+)$/gm);
  // 附錄 (appendix) sections were previously dropped entirely because the old
  // pattern only matched "任務 N" headings. They now parse like any other task.
  const assignmentSections = sections(assignment, /^#\s+((?:任務\s*\d+(?:\.\d+)?)|附錄)\s*[:：]?\s*(.+)$/gm);
  return assignmentSections.map((task) => {
    const number = task.key;
    const isNumbered = /^\d/.test(number);
    const lectureNumber = isNumbered ? (stageKey === "stage-01" ? `1.${number}` : number) : null;
    const lectureMatch = lectureNumber ? lectureSections.find((item) => item.key === lectureNumber) : undefined;
    const label = isNumbered ? `任務 ${number}` : number;
    return {
      key: `${stageKey}-${number.replace(/\./g, "-")}`,
      title: `${label}：${task.title}`,
      lecture: lectureMatch?.body ?? "此任務的講義內容正在整理中。請先閱讀作業說明。",
      assignment: task.body,
    };
  });
}

// ---------------------------------------------------------------------------
// Assignment field extraction
// ---------------------------------------------------------------------------

const BLANK_RE = /(＿{2,}|_{4,})/;
const BLANK_RE_G = /(＿{2,}|_{4,})/g;
const CHECKBOX_PREFIX_RE = /^\s*(?:[-*]\s*)?☐\s*/;
const CONNECTOR_WORDS = new Set(["的", "和", "與", "及", "跟", "或", "到", "是", "了", "就", "才", "還", "也", "又", "即"]);

function stripEmphasis(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

const WRAP_PAIRS: [string, string][] = [
  ["【", "】"],
  ["「", "」"],
  ["『", "』"],
  ["(", ")"],
  ["（", "）"],
];

/** Clean a fragment of text for display as a prompt/group label: strips markdown
 *  emphasis, leading heading/list/checkbox markers, blockquote markers and
 *  outer punctuation. Brackets are only removed when they wrap the *entire*
 *  string (so a lone leftover "（" from a trailing "）" that got cut off by
 *  string slicing is never shown dangling on its own). */
function cleanText(raw: string) {
  let text = stripEmphasis(raw);
  text = text.replace(/^#{1,6}\s*/, "");
  text = text.replace(/^\s*[-*]\s*/, "");
  text = text.replace(CHECKBOX_PREFIX_RE, "");
  text = text.replace(/^\s*>+\s*/, "");
  text = text.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of WRAP_PAIRS) {
      if (text.length > open.length + close.length && text.startsWith(open) && text.endsWith(close)) {
        text = text.slice(open.length, text.length - close.length).trim();
        changed = true;
      }
    }
  }
  // 【】 only ever wrap fill-in-the-blank slots in this content, never real
  // words, so any leftover (unbalanced, mid-string) bracket is just noise.
  text = text.replace(/[【】]/g, "");
  text = text.replace(/^[:：，,。.、]+/, "").replace(/[:：，,。.、]+$/, "");
  return text.replace(/\s+/g, " ").trim();
}

/** Whether a cleaned line still carries any real content once blanks and
 *  purely decorative punctuation/quote marks are ignored. Used to avoid
 *  using something like "「____」" as a prompt when a proper nearby label
 *  (e.g. "你的答案：") is available instead. */
function hasRealContent(text: string) {
  return text.replace(/＿＿＿＿/g, "").replace(/[「」『』【】"'（）()：:，,。.！!？?、]/g, "").trim().length > 0;
}

function isParentheticalAside(value: string) {
  return /^[（(].*[）)]$/.test(value);
}

/** Generic "type your answer here" labels (e.g. "**你的答案：**") tell a
 *  student/teacher nothing about what the question actually is — they only
 *  mark where the input goes. They must never be used as a field's prompt;
 *  the scan has to look past them for the real question. */
function isAnswerPlaceholderLabel(value: string) {
  return /^(你的答案|答案|回答|作答)$/.test(cleanText(value));
}

/** A "**句型：**" (sentence template) or "**參考：**" (reference examples) line
 *  spells out exactly what shape the answer should take, which is far more
 *  useful to a teacher filling in a blank than the nearest line by distance
 *  (often just a worked example, or the "你的答案" label itself). When one is
 *  present in the same block, prefer it over anything else. */
function isTemplateOrReferenceLine(value: string) {
  return /^\*\*(句型|參考)[:：]/.test(value);
}

/** Find the best line above `index` to describe what a field is asking for,
 *  scanning up to the enclosing block's boundary (a heading or a "---" rule)
 *  rather than a fixed number of lines, since a block's template/example
 *  usually sits further back than the "你的答案" label right above the blank.
 *  Blockquotes and tables are skipped outright; a parenthetical aside (e.g.
 *  "（保證進步幾分、保證幾個月回本…）") and a bare "你的答案"-style label are kept
 *  only as fallbacks so a real question or template line wins when one
 *  exists. If nothing better turns up, the enclosing heading itself (e.g.
 *  "步驟 3：寫出被服務的身分") is used before giving up entirely. */
function meaningfulContext(lines: string[], index: number) {
  const collected: string[] = [];
  let headingFallback: string | null = null;
  for (let i = index - 1; i >= 0 && index - i <= 40; i -= 1) {
    const value = lines[i].trim();
    if (!value) continue;
    // A heading is a real section boundary — stop there, and keep it as a
    // fallback label. A "---" rule is only ever used as a *visual* divider
    // between sub-parts of the same task in this content, never a section
    // break, so (like blockquotes/tables) it's skipped rather than treated
    // as a stopping point.
    if (isHeadingLine(value)) {
      headingFallback = value;
      break;
    }
    if (isRuleLine(value)) continue;
    collected.push(value);
  }

  const templateLine = collected.find(isTemplateOrReferenceLine);
  if (templateLine) return cleanText(templateLine) || "請完成這一題";

  let aside: string | null = null;
  let answerLabel: string | null = null;
  for (const value of collected) {
    if (value.startsWith(">") || value.startsWith("|")) continue;
    // a checkbox option line was already consumed as part of its own group;
    // it should never double as the "context" for a different field below it.
    if (isCheckboxLine(value)) continue;
    if (isAnswerPlaceholderLabel(value)) {
      if (answerLabel === null) answerLabel = value;
      continue;
    }
    if (isParentheticalAside(value)) {
      if (aside === null) aside = value;
      continue;
    }
    return cleanText(value) || "請完成這一題";
  }
  if (aside) return cleanText(aside) || "請完成這一題";
  if (headingFallback) return cleanText(headingFallback) || "請完成這一題";
  if (answerLabel) return cleanText(answerLabel) || "請完成這一題";
  return "請完成這一題";
}

function isTableRow(line: string) {
  return /^\s*\|.*\|\s*$/.test(line);
}
function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}
function isSeparatorRow(line: string) {
  return isTableRow(line) && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}
function cellHasBlankMarker(cell: string) {
  return BLANK_RE.test(cell);
}
function isCheckboxLine(line: string) {
  return CHECKBOX_PREFIX_RE.test(line);
}
function isHeadingLine(line: string) {
  return /^#{1,6}\s/.test(line.trim());
}
function isRuleLine(line: string) {
  return /^[-*_]{3,}\s*$/.test(line.trim());
}
function tableSectionLabel(lines: string[], cursor: number) {
  for (let index = cursor - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (/^#{2,4}\s/.test(line)) return cleanText(line);
    if (/^#\s/.test(line)) break;
  }
  return "表格作答";
}
function isBlockquoteLine(line: string) {
  return /^\s*>/.test(line);
}
/** A line made up entirely of a bold span (e.g. "**② 投入了多少？（勾一個）**")
 *  reads as a fresh question header, not a continuation of the previous
 *  checkbox option's description, so it should end a checkbox block. */
function isFullyBoldLine(line: string) {
  // Description lines under a checkbox option are conventionally indented
  // (usually with a full-width space) even when the whole sentence is bolded
  // for emphasis — that indentation is what tells them apart from a real,
  // column-zero bold question header that starts a new group.
  if (/^\s/.test(line)) return false;
  const trimmed = line.trim();
  return /^\*\*.+\*\*$/.test(trimmed) && !trimmed.includes("☐");
}
function isStructuralBoundary(line: string) {
  return isHeadingLine(line) || isRuleLine(line) || isBlockquoteLine(line) || isTableRow(line) || isFullyBoldLine(line);
}
function isInformativeLabel(label: string) {
  if (label.length >= 2) return true;
  if (label.length === 1) return !CONNECTOR_WORDS.has(label);
  return false;
}

/**
 * Split a line into one prompt per blank marker it contains. A single blank
 * keeps the previous "whole line as prompt" behaviour. Multiple blanks (e.g.
 * "我服務的是【____】的【____】。" or "年齡大約：__ 到 __ 歲") each get their own
 * field instead of being silently collapsed into one, which was the main
 * cause of assignments losing fill-in blanks.
 */
function blankFieldPrompts(line: string, fallbackContext: string): string[] {
  // Strip markdown emphasis / blockquote markers on the *whole* line first.
  // Slicing the raw line per-blank and cleaning each fragment independently
  // would split a "**...____...____...**" bold span apart, leaving a stray
  // "**" stuck to whichever fragment lost its matching partner.
  const processed = stripEmphasis(line)
    .replace(/^\s*>+\s*/, "")
    .replace(/^\s*[-*]?\s*/, "")
    .replace(CHECKBOX_PREFIX_RE, "");
  const matches = [...processed.matchAll(BLANK_RE_G)];
  if (matches.length === 0) return [];
  const overallRaw = processed.replace(BLANK_RE_G, "＿＿＿＿").replace(/\s+/g, " ").trim();
  const overall = hasRealContent(overallRaw) ? overallRaw : fallbackContext;

  if (matches.length === 1) return [overall];

  const prompts: string[] = [];
  let prevEnd = 0;
  matches.forEach((match, i) => {
    const start = match.index ?? 0;
    const preceding = cleanText(processed.slice(prevEnd, start));
    prevEnd = start + match[0].length;
    prompts.push(isInformativeLabel(preceding) ? preceding : `${overall}（第 ${i + 1} 格）`);
  });
  // de-duplicate identical prompts (e.g. two blanks that both fell back to "overall")
  const seen = new Map<string, number>();
  return prompts.map((prompt) => {
    const count = (seen.get(prompt) ?? 0) + 1;
    seen.set(prompt, count);
    return count > 1 ? `${prompt}（第 ${count} 次）` : prompt;
  });
}

/** Collect a run of "☐ label" lines starting at `start`, tolerating blank
 *  lines and short description lines in between (see isStructuralBoundary
 *  for what ends a block). Labels are returned raw (not cleaned) so that a
 *  trailing blank marker such as "☐ 其他：____" can still be detected by the
 *  caller. This fixes groups that used to be split into several one-option
 *  fields whenever an option had an explanatory line under it. */
function collectCheckboxOptions(lines: string[], start: number) {
  const options: string[] = [];
  let cursor = start;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (isCheckboxLine(line)) {
      options.push(line.replace(CHECKBOX_PREFIX_RE, "").trim());
      cursor += 1;
      continue;
    }
    if (!line.trim()) {
      let peek = cursor + 1;
      while (peek < lines.length && !lines[peek].trim()) peek += 1;
      if (peek < lines.length && isCheckboxLine(lines[peek])) {
        cursor = peek;
        continue;
      }
      break;
    }
    if (isStructuralBoundary(line)) break;
    // a plain continuation/description line under the previous option; the
    // option label itself was already captured, so just skip past it.
    cursor += 1;
  }
  return { options, end: cursor };
}

function detectSingleSelect(lines: string[], start: number, end: number) {
  const windowText = lines.slice(Math.max(0, start - 6), Math.min(lines.length, end + 1)).join(" ");
  if (/可複選/.test(windowText)) return false;
  return /只能勾一個|只能選一個|單選|勾一個/.test(windowText);
}

export function getAssignmentFields(assignment: string, taskKey: string): AssignmentField[] {
  const lines = assignment.split(/\r?\n/);
  const fields: AssignmentField[] = [];
  let index = 0;
  const add = (field: Omit<AssignmentField, "key">) => {
    fields.push({ ...field, key: `${taskKey}-answer-${index}` });
    index += 1;
  };

  // Turns a run of raw (uncleaned) option labels into a checkboxes field.
  // Any option whose label still contains a blank marker (e.g. "其他：____")
  // is trimmed down to a clean option label AND spawns a companion free-text
  // field, so "其他" style options are no longer silently dropped.
  const addCheckboxGroup = (rawOptions: string[], contextLabel: string, singleSelect: boolean, tableMeta?: { row: string; column: string; group?: string }) => {
    const fieldIndex = index;
    const cleanOptions: AssignmentOption[] = [];
    const companions: string[] = [];
    rawOptions.forEach((rawLabel) => {
      const hasBlankMarker = BLANK_RE.test(rawLabel);
      const withoutBlank = hasBlankMarker ? rawLabel.replace(BLANK_RE_G, "") : rawLabel;
      const label = cleanText(withoutBlank) || (hasBlankMarker ? "其他" : "");
      if (!label) return;
      cleanOptions.push({ key: `${taskKey}-option-${fieldIndex}-${cleanOptions.length}`, label, otherInputKey: hasBlankMarker ? `${taskKey}-answer-${fieldIndex + 1 + companions.length}` : undefined });
      if (hasBlankMarker) companions.push(label);
    });
    if (cleanOptions.length === 0) return;
    add({ prompt: contextLabel || "請完成這一題", type: "checkboxes", options: cleanOptions, multiple: !singleSelect, group: tableMeta?.group ?? contextLabel, layout: tableMeta ? "table" : undefined, tableRow: tableMeta?.row, tableColumn: tableMeta?.column });
    companions.forEach((label, companionIndex) => add({ prompt: `${contextLabel ? `${contextLabel}｜` : ""}${label}（請補充說明）`, type: "text", group: tableMeta?.group ?? contextLabel, hiddenInGroup: true, otherFor: `${taskKey}-answer-${fieldIndex}`, layout: tableMeta ? "table" : undefined, tableRow: tableMeta?.row, tableColumn: tableMeta?.column }));
  };

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;

    // ---- Tables --------------------------------------------------------
    if (isTableRow(line) && cursor + 1 < lines.length && isSeparatorRow(lines[cursor + 1])) {
      const headers = tableCells(line).map((cell) => cleanText(cell));
      cursor += 2;
      while (cursor < lines.length && isTableRow(lines[cursor])) {
        const cells = tableCells(lines[cursor]);
        const rowLabel = cleanText(cells[0]) || cleanText(cells[1] ?? "") || `第 ${cursor} 列`;
        const groupLabel = `${tableSectionLabel(lines, cursor - 2)}｜${headers.slice(1).join("／") || "表格作答"}`;

        // A row like "| 題目 | ☐ | ☐ |" under headers "是"/"否" is a
        // single-select choice between the bare-checkbox columns. These used
        // to be silently skipped because an empty-looking "☐" cell doesn't
        // contain a blank marker.
        const bareCheckboxCols = cells
          .map((cell, i) => ({ cell: cell.trim(), i }))
          .filter(({ cell, i }) => i > 0 && cell === "☐");
        if (bareCheckboxCols.length >= 2) {
          const options: AssignmentOption[] = bareCheckboxCols.map(({ i }) => ({
            key: `${taskKey}-option-${index}-${i}`,
            label: headers[i] || `選項 ${i}`,
          }));
            add({ prompt: rowLabel, type: "checkboxes", options, multiple: false, group: groupLabel, layout: "table", tableRow: rowLabel, tableColumn: "選擇" });
          cursor += 1;
          continue;
        }

        cells.forEach((cell, cellIndex) => {
          if (cellIndex === 0) return;
          const trimmed = cell.trim();
          const header = headers[cellIndex] || "答案";
          if (!trimmed) {
            add({ prompt: `${rowLabel}｜${header}`, type: "text", group: groupLabel, layout: "table", tableRow: rowLabel, tableColumn: header });
            return;
          }
          if (trimmed.includes("☐")) {
            // Multiple options packed into one cell, e.g.
            // "☐ 有　☐ 不到 10 句　☐ 有，但我改寫過" — previously dropped entirely.
            const opts = [...trimmed.matchAll(/☐\s*([^☐]+)/g)].map((m) => m[1].trim()).filter(Boolean);
            if (opts.length) addCheckboxGroup(opts, `${rowLabel}｜${header}`, true, { row: rowLabel, column: header, group: groupLabel });
            return;
          }
          if (cellHasBlankMarker(trimmed)) {
            add({ prompt: `${rowLabel}｜${header}`, type: trimmed.length > 28 || header.includes("原話") || header.includes("內容") ? "textarea" : "text", group: groupLabel, layout: "table", tableRow: rowLabel, tableColumn: header });
          }
        });
        cursor += 1;
      }
      cursor -= 1;
      continue;
    }

    // A line can start with "☐" yet still pack several options on the same
    // line (e.g. "☐ 常常　☐ 偶爾　☐ 幾乎沒有"). Only treat a leading "☐" as the
    // start of a multi-line block when it is the *only* checkbox on the line;
    // otherwise it falls through to the inline-options handling below.
    const checkboxesOnLine = (line.match(/☐/g) ?? []).length;

    // ---- Checkbox block (line starts with a lone ☐) ---------------------
    if (isCheckboxLine(line) && checkboxesOnLine === 1) {
      const start = cursor;
      const { options, end } = collectCheckboxOptions(lines, start);
      cursor = end - 1;
      const contextLabel = meaningfulContext(lines, start);
      const singleSelect = detectSingleSelect(lines, start, end);
      addCheckboxGroup(options, contextLabel, singleSelect);
      continue;
    }

    // ---- Inline checkboxes on one line ("... ☐ A ☐ B ☐ C") -------------
    const inlineOptions = [...line.matchAll(/☐\s*([^☐]+)/g)].map((match) => match[1].trim()).filter(Boolean);
    if (inlineOptions.length >= 2) {
      const before = cleanText(line.replace(/☐\s*[^☐]+/g, ""));
      const contextLabel = before || meaningfulContext(lines, cursor);
      const singleSelect = detectSingleSelect(lines, cursor, cursor);
      addCheckboxGroup(inlineOptions, contextLabel, singleSelect);
      continue;
    }

    // ---- Fill-in-the-blank line(s) --------------------------------------
    if (BLANK_RE.test(line)) {
      const contextLabel = meaningfulContext(lines, cursor);
      const prompts = blankFieldPrompts(line, contextLabel);
      const type: AssignmentField["type"] = line.length > 95 ? "textarea" : "text";
      prompts.forEach((prompt) => add({ prompt, type, group: contextLabel }));
    }
  }
  return fields;
}

export function readStageTasks(stageKey: string) {
  return readTaskSections(stageKey).map((task) => ({ ...task, fields: getAssignmentFields(task.assignment, task.key) }));
}

export type TaskWithFields = TaskSection & { fields: AssignmentField[] };
export function readTaskSectionsWithFields(stageKey: string): TaskWithFields[] {
  return readStageTasks(stageKey);
}

/** Convert a teacher-provided, human-filled Markdown/TXT file into the same
 * answer shape used by the student form. This intentionally stays conservative:
 * only checked options and non-empty table/text cells are imported. */
export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  const checked = (line: string) => /(?:☑|☒|\[[xX]\])/.test(line);
  const optionLabel = (label: string) => label.replace(/\s+/g, " ").replace(/^\s*[A-D][.、]\s*/, "").replace(/\s*[☐☑☒].*$/, "").trim();
  for (const field of fields) {
    if (field.hiddenInGroup) continue;
    if (field.type === "checkboxes") {
      const selected = (field.options ?? []).filter((option) => lines.some((line) => checked(line) && line.includes(optionLabel(option.label)))).map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      continue;
    }
    if (field.layout === "table" && field.tableRow) {
      const tableLine = lines.find((line) => isTableRow(line) && tableCells(line).some((cell) => cleanText(cell) === cleanText(field.tableRow!)));
      if (tableLine) {
        const cells = tableCells(tableLine);
        const headerLines = lines.slice(0, lines.indexOf(tableLine)).filter((line) => isTableRow(line));
        const headers = headerLines.length ? tableCells(headerLines[headerLines.length - 1]) : [];
        const columnIndex = Math.max(0, headers.findIndex((header) => cleanText(header) === cleanText(field.tableColumn ?? "答案")));
        const value = cells[columnIndex] ?? "";
        if (value && !/^(＿＿+|_{4,})$/.test(value)) answers[field.key] = value.replace(/☐|☑|☒|\[[xX ]\]/g, "").trim();
      }
      continue;
    }
    const prompt = field.prompt.split("＿＿＿＿")[0].replace(/[：:]\s*$/, "").trim();
    const lineIndex = lines.findIndex((line) => prompt && line.includes(prompt));
    if (lineIndex >= 0) {
      const sameLine = lines[lineIndex].split(/[：:＝=]/).slice(1).join("：").replace(/＿＿+|_{4,}/g, "").trim();
      const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim() && !isHeadingLine(line) && !isStructuralBoundary(line));
      const value = sameLine || (nextLine ?? "").trim();
      if (value && !/^(請填寫|你的答案|答案)$/.test(value)) answers[field.key] = value;
    }
  }
  return answers;
}
