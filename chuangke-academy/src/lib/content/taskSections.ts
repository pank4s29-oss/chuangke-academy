import fs from "node:fs";
import path from "node:path";

export type TaskSection = { key: string; title: string; lecture: string; assignment: string };
export type AssignmentOption = { key: string; label: string; otherInputKey?: string };
export type AssignmentField = {
  key: string;
  prompt: string;
  /** Short, optional helper text shown under the prompt — e.g. the original
   *  fill-in-the-blank sentence template ("我服務的是____的____。") so the
   *  student knows exactly what shape of answer is expected without the
   *  prompt itself having to spell that out and become unwieldy. */
  description?: string;
  type: "text" | "textarea" | "checkboxes";
  options?: AssignmentOption[];
  multiple?: boolean;
  group?: string;
  layout?: "table";
  tableRow?: string;
  tableColumn?: string;
  hiddenInGroup?: boolean;
  otherFor?: string;
  dependsOn?: { fieldKey: string; optionKey: string; optionLabel: string };
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
    if (isBareNumberedBlankLine(value)) continue;
    // A line that itself contains a blank marker (e.g. "今天是：____") is
    // another field's own question, not a description of *this* one — using
    // it as context previously meant a date field like "往後數 30 天，我的第
    // 一版上線日是" showed the *previous* field's text ("今天是：____") as its
    // prompt instead of its own, with the real question relegated to a
    // parenthetical description underneath. Skip past it just like a
    // checkbox option line, rather than borrowing a sibling question's text.
    if (BLANK_RE.test(value)) continue;
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
  if (headingFallback) return cleanText(headingFallback) || "請完成這一題";
  if (aside) return cleanText(aside) || "請完成這一題";
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
/** A line that is *only* a numbered marker plus a blank, e.g. "1. ____" or
 *  "1. 「____」" (the blank optionally wrapped in a single pair of quote/
 *  bracket marks, as used for "寫三句他會說的話" style questions). Several of
 *  these are typically stacked together (one field each); like a checkbox
 *  option line, one must never be picked up as the "context" label for one
 *  of its own siblings. */
function isBareNumberedBlankLine(line: string) {
  return /^\s*\d+[.、)]\s*[「『【"'(（]?(?:＿{2,}|_{4,})[」』】"'）)]?\s*$/.test(line);
}
function isHeadingLine(line: string) {
  return /^#{1,6}\s/.test(line.trim());
}
function isRuleLine(line: string) {
  return /^[-*_]{3,}\s*$/.test(line.trim());
}
/** Pick the cell that best describes a table row, for use as that row's
 *  field prompt. A leading "#" row-counter column (containing just a bare
 *  row number like "1", "2"...) is never descriptive enough to stand alone
 *  as a prompt, so it's skipped in favour of a column explicitly headed
 *  "題目"/"敘述"/etc., or otherwise the first cell that has real content and
 *  isn't itself a bare checkbox answer cell. */
/** rawHeaders are the header cells *before* cleanText — a bare "#" column
 *  header is indistinguishable from a level-1 Markdown heading marker to
 *  cleanText (both are just "#"), so it gets stripped down to "" there. The
 *  raw text is needed here to still recognise it as the row-counter column. */
function pickRowLabel(headers: string[], cells: string[], rawHeaders: string[]) {
  const namedIndex = headers.findIndex((header) => /^(題目|敘述|項目|內容|說明|問題)$/.test(header));
  const named = namedIndex >= 0 ? cleanText(cells[namedIndex] ?? "") : "";
  if (named) return named;
  for (let i = 0; i < cells.length; i += 1) {
    const rawHeader = (rawHeaders[i] ?? "").trim();
    const raw = (cells[i] ?? "").trim();
    if (rawHeader === "#" || /^\d+$/.test(cleanText(raw))) continue;
    if (raw === "☐" || raw === "☑") continue;
    if (!raw || BLANK_RE.test(raw)) continue;
    const value = cleanText(raw);
    if (value) return value;
  }
  // Nothing descriptive was found anywhere in the row (e.g. a table that is
  // just "# | (blank) | (blank)" for the student to fill in from scratch) —
  // the row counter is at least a stable, human-readable identifier, unlike
  // a made-up "第 N 列" based on the source file's line number.
  const counterIndex = rawHeaders.findIndex((header) => header.trim() === "#");
  const detectedIndex = counterIndex >= 0 ? counterIndex : cells.findIndex((cell) => /^\d+$/.test(cleanText(cell)));
  const counter = detectedIndex >= 0 ? cleanText(cells[detectedIndex] ?? "") : "";
  if (counter && detectedIndex === 0 && headers[0] && headers[0] !== "#") return `${headers[0]} ${counter}`;
  return counter;
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
/**
 * Build the prompt (and, where useful, a short description) for a line that
 * contains one or more fill-in-the-blank markers.
 *
 * A sentence like "我服務的是【____】的【____】。" or "年齡大約：__ 到 __ 歲" is one
 * question with one answer — the "who" and the "what kind of" (or the "from"
 * and "to") only make sense together as a single completed sentence. This
 * used to hand back one prompt per blank, which created two separate fields
 * that read like unrelated questions (a bare "我服務的是" next to a near-
 * duplicate "我服務的是____的____。（第 2 格）"), even though a teacher only
 * ever needs one line to review. Multiple blanks on one line are now always
 * kept together as a single field.
 */
function buildBlankField(line: string, fallbackContext: string): { prompt: string; description?: string; multiline: boolean } {
  // Strip markdown emphasis / blockquote markers on the *whole* line first,
  // so a "**...____...____...**" bold span spanning several blanks doesn't
  // get split apart with a stray "**" left on one side.
  const processed = stripEmphasis(line)
    .replace(/^\s*>+\s*/, "")
    .replace(/^\s*[-*]?\s*/, "")
    .replace(CHECKBOX_PREFIX_RE, "");
  const matches = [...processed.matchAll(BLANK_RE_G)];
  const template = processed.replace(BLANK_RE_G, "＿＿＿＿").replace(/\s+/g, " ").trim();
  const templateHasContent = hasRealContent(template);
  const multiline = line.length > 95;

  if (matches.length <= 1) {
    // A single blank: the sentence itself (e.g. "我的恐懼句是____。") is
    // almost always specific enough to stand alone as the prompt.
    return { prompt: templateHasContent ? template : fallbackContext, multiline };
  }

  // Two or more blanks: prefer a real question/heading above the line as the
  // short prompt, and show the fill-in-the-blank sentence itself as a
  // description underneath — a teacher then sees *both* "what is this
  // asking" and "exactly what shape the answer takes" without the two
  // collapsing into confusingly similar standalone questions.
  const contextIsUseful = fallbackContext !== "請完成這一題" && fallbackContext !== template;
  if (contextIsUseful) {
    return { prompt: fallbackContext, description: templateHasContent ? template : undefined, multiline };
  }
  return { prompt: templateHasContent ? template : fallbackContext, multiline };
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
  let activeBranch: { fieldKey: string; optionKey: string; optionLabel: string } | undefined;
  const add = (field: Omit<AssignmentField, "key">) => {
    fields.push({ ...field, key: `${taskKey}-answer-${index}`, ...(activeBranch ? { dependsOn: activeBranch } : {}) });
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

    if (isHeadingLine(line)) {
      const branch = line.match(/如果你選\s*([A-Z])(?:（([^）]+)）|\(([^)]+)\))/);
      if (branch) {
        const letter = branch[1];
        const label = cleanText(branch[2] ?? branch[3] ?? letter);
        const sourceField = [...fields].reverse().find((field) => field.type === "checkboxes" && (field.options ?? []).some((option) => new RegExp(`^${letter}(?:[.、：:]|\\s|$)`, "i").test(option.label)));
        const option = sourceField?.options?.find((candidate) => new RegExp(`^${letter}(?:[.、：:]|\\s|$)`, "i").test(candidate.label));
        activeBranch = sourceField && option ? { fieldKey: sourceField.key, optionKey: option.key, optionLabel: label } : undefined;
      } else {
        activeBranch = undefined;
      }
    }

    // ---- Tables --------------------------------------------------------
    if (isTableRow(line) && cursor + 1 < lines.length && isSeparatorRow(lines[cursor + 1])) {
      const rawHeaders = tableCells(line);
      const headers = rawHeaders.map((cell) => cleanText(cell));
      cursor += 2;
      while (cursor < lines.length && isTableRow(lines[cursor])) {
        const cells = tableCells(lines[cursor]);
        const rowLabel = pickRowLabel(headers, cells, rawHeaders) || `第 ${cursor} 列`;
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
      // A short inline label like "主要在" or "二選一" reads fine sitting right
      // above its own options, but on its own in a teacher's answer summary
      // (where the options aren't necessarily shown alongside it) it doesn't
      // say enough — so it's paired with the nearest real question/heading
      // above it rather than shown bare. Longer inline labels (e.g. "性別偏
      // 向") already carry enough meaning by themselves and are left as-is.
      const surrounding = !before || before.length < 4 ? meaningfulContext(lines, cursor).replace(BLANK_RE_G, "＿＿＿＿").replace(/\s+/g, " ").trim() : "";
      // In stage 2 task 2, the preceding "人選 2（抄 1.2-E 的 D 項）"
      // line is only setup. The actual input is the independent binary choice;
      // do not repeat the setup text in the question label.
      const contextLabel = taskKey === "stage-02-2-2" && before.includes("二選一")
        ? before
        : before && surrounding ? `${surrounding}｜${before}` : before || surrounding;
      const singleSelect = detectSingleSelect(lines, cursor, cursor);
      addCheckboxGroup(inlineOptions, contextLabel, singleSelect);
      continue;
    }

    // ---- Fill-in-the-blank line(s) --------------------------------------
    if (BLANK_RE.test(line)) {
      const contextLabel = meaningfulContext(lines, cursor);
      // A line that is *only* a numbered list marker plus a blank (e.g. the
      // "1. ____" / "2. ____" / "3. ____" pattern used for "把勾到的三題抄一次
      // 這裡") has no real text of its own to build a prompt/description from.
      // Falling through to the generic logic below previously treated the
      // bare digit "1" as if it were meaningful content and used "1. " itself
      // as the prompt, instead of the actual question above it (e.g. "我要問
      // 的三題是："). Detect this pattern up front and number the fallback
      // context explicitly instead.
      const bareNumberedBlank = isBareNumberedBlankLine(line) ? line.match(/^\s*(\d+)[.、)]/) : null;
      if (bareNumberedBlank) {
        add({ prompt: `${contextLabel}（第 ${bareNumberedBlank[1]} 題）`, type: "text", group: contextLabel });
      } else {
        const { prompt, description, multiline } = buildBlankField(line, contextLabel);
        add({ prompt, description, type: multiline ? "textarea" : "text", group: contextLabel });
      }
    }
  }
  // When two or more fields in the same task ended up with the exact same
  // fallback prompt (typically because they all fell back to the same
  // enclosing section heading, e.g. two date blanks both under "## 5-A　先
  // 訂上線日"), number them so they no longer read as duplicates of each
  // other — the same way multiple blanks on one line already get "（第 N
  // 次）" appended below.
  const promptCounts = new Map<string, number>();
  fields.forEach((field) => promptCounts.set(field.prompt, (promptCounts.get(field.prompt) ?? 0) + 1));
  const promptSeen = new Map<string, number>();
  fields.forEach((field) => {
    if ((promptCounts.get(field.prompt) ?? 0) <= 1) return;
    const seen = (promptSeen.get(field.prompt) ?? 0) + 1;
    promptSeen.set(field.prompt, seen);
    field.prompt = `${field.prompt}（第 ${seen} 小題）`;
  });
  return fields;
}

export function readStageTasks(stageKey: string) {
  return readTaskSections(stageKey).map((task) => ({ ...task, fields: getAssignmentFields(task.assignment, task.key) }));
}

export type TaskWithFields = TaskSection & { fields: AssignmentField[] };
export function readTaskSectionsWithFields(stageKey: string): TaskWithFields[] {
  return readStageTasks(stageKey);
}

// NOTE: teacher-file import lives in "./importAnswers" (extractImportedAnswers).
// An older, unused copy used to be duplicated here — it was never imported by
// the app or its tests (both use "./importAnswers"), so it was removed rather
// than fixed twice; keeping two copies in sync was itself a bug risk.
