import type { AssignmentField } from "./taskSections";

function isTableRow(line: string) { return /^\s*\|.*\|\s*$/.test(line); }
function tableCells(line: string) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }
function cleanText(value: string) { return value.replace(/\*\*(.+?)\*\*/g, "$1").replace(/＿＿+|_{4,}/g, "").replace(/\s+/g, " ").trim(); }
function isHeadingLine(line: string) { return /^#{1,6}\s/.test(line.trim()); }
function isStructuralBoundary(line: string) { return isHeadingLine(line) || /^[-*_]{3,}\s*$/.test(line.trim()) || /^\s*>/.test(line); }
function normalizedLine(line: string) { return line.replace(/\*\*/g, "").replace(/__/g, ""); }
function stripQuoteMarker(line: string) { return line.replace(/^\s*>+\s*/, ""); }
function isCheckboxLine(line: string) { return /^\s*(?:[-*]\s*)?[☐☑☒]\s*/.test(line); }
/** A "**檢查點：…**" / "**提醒：…**" style aside is the template's own guidance
 *  text, not an answer to anything — it must never be picked up by the
 *  generic "nearest following line" fallback below. */
function isAsideLine(line: string) { return /^\**(檢查點|提醒|範例|參考|小提醒|備註)[:：]/.test(normalizedLine(line).trim()); }
/** A line that itself starts with a bold "**label**" span is, in this
 *  content, always a *new* question's own prompt line (e.g. "**往後數 30
 *  天…是：** ____"), never a continuation of the answer above it — so the
 *  "look a few lines ahead" fallback below must stop there rather than
 *  scooping up a completely different field's line as this field's value. */
function isBoldLabelLine(line: string) { return /^\s*\*\*[^*]+\*\*/.test(line); }
function optionMatches(line: string, label: string) {
  const normalized = normalizedLine(line);
  const cleanLabel = optionLabelText(label);
  const shortLabel = cleanLabel.split(/[：:]/)[0].trim();
  return normalized.includes(cleanLabel) || (shortLabel.length >= 2 && normalized.includes(shortLabel));
}
function optionLabelText(label: string) { return label.replace(/\s+/g, " ").replace(/^\s*[A-D][.、]\s*/, "").trim(); }

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Build a matcher from a field's `description` — the literal fill-in-the-
 *  blank sentence with its blanks normalized to "＿＿＿＿" (e.g. "我服務的是
 *  【＿＿＿＿】的【＿＿＿＿】。"). The literal text around each blank (brackets,
 *  punctuation) is escaped and kept as an anchor; each blank becomes a non-
 *  greedy wildcard. A teacher's filled-in copy keeps that same literal
 *  structure around whatever they typed, so this matches the *whole*
 *  completed sentence in one go — which is what these merged multi-blank
 *  fields need, since prompt-based matching (built for a short label, not a
 *  full sentence with brackets in it) never matches this content at all. */
function descriptionMatcher(description: string) {
  const parts = description.split(/(＿{2,}|_{4,})/).filter((part) => part.length > 0);
  if (parts.every((part) => /^(＿{2,}|_{4,})$/.test(part))) return null; // no literal anchor text at all
  // The *last* blank, when nothing follows it in the template (e.g. "從____，
  // 變成____" with no trailing punctuation), has no anchor to stop it — a
  // lazy "as few characters as possible" wildcard there matches almost
  // nothing (often just the opening bracket of the answer) instead of the
  // rest of the line. Only blanks that are followed by real literal text
  // need to stay lazy so they stop at that text; a trailing blank should
  // instead consume the rest of the line.
  const lastBlankIndex = parts.reduce((acc, part, i) => (/^(＿{2,}|_{4,})$/.test(part) ? i : acc), -1);
  const pattern = parts
    .map((part, i) => {
      if (!/^(＿{2,}|_{4,})$/.test(part)) return escapeRegExp(part);
      return i === lastBlankIndex && i === parts.length - 1 ? "[\\s\\S]+" : "[\\s\\S]+?";
    })
    .join("");
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}
function findByDescription(lines: string[], description: string) {
  const matcher = descriptionMatcher(description);
  if (!matcher) return "";
  // Try each line alone first, then a 2- and 3-line join (quote markers
  // stripped from each line before joining) — a long completed sentence is
  // sometimes wrapped across two Markdown lines inside the same blockquote
  // (e.g. "我以前也【…】，\n後來我【…】。"), which a single-line match can
  // never find since neither line alone contains the whole template.
  for (let windowSize = 1; windowSize <= 3; windowSize += 1) {
    for (let start = 0; start + windowSize <= lines.length; start += 1) {
      const windowLines = lines.slice(start, start + windowSize).map((line) => stripQuoteMarker(normalizedLine(line)).trim());
      if (windowLines.some((line) => !line)) continue; // a blank line breaks a wrapped sentence
      const joined = windowLines.join("");
      const match = matcher.exec(joined);
      if (!match) continue;
      const filled = match[0].trim();
      // Reject a match that's just the untouched template (a blank marker is
      // still literally present in what we captured) — keep scanning for a
      // later occurrence where the student actually filled it in, rather than
      // reporting the blank template line itself as "the answer".
      if (filled && !/(＿{2,}|_{4,})/.test(filled)) return filled;
    }
  }
  return "";
}
function findTableCell(lines: string[], field: AssignmentField) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableRow(lines[index]) || !isTableRow(lines[index + 1]) || !/^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) continue;
    const headers = tableCells(lines[index]);
    let cursor = index + 2;
    while (cursor < lines.length && isTableRow(lines[cursor])) {
      const cells = tableCells(lines[cursor]);
      if (cleanText(cells[0] ?? "") === cleanText(field.tableRow ?? "")) {
        const columnIndex = headers.findIndex((header) => cleanText(header) === cleanText(field.tableColumn ?? "答案"));
        if (columnIndex >= 0) return cells[columnIndex] ?? "";
        const fallbackIndex = Math.max(0, headers.findIndex((header) => cleanText(header) === "答案"));
        if (field.tableColumn === "選擇" && fallbackIndex >= 0) return cells[fallbackIndex] ?? "";
      }
      cursor += 1;
    }
    index = cursor - 1;
  }
  return "";
}

/** A task's own ordinal ("任務 1", "任務 2.3", "附錄") extracted from its title
 *  or from a heading line in an uploaded document. Matching on this instead
 *  of the full title text survives a teacher/student's minor wording change
 *  to a heading (e.g. a typo turning "填出你的 CAS 地圖" into "填出我的 CAS
 *  地圖" in one real sample file) while still reliably telling two tasks
 *  apart, since the numbering itself is very unlikely to be altered. */
function taskOrdinal(titleOrHeading: string) {
  const match = titleOrHeading.match(/任務\s*[\d.]+|附錄/);
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
}

/**
 * Split an uploaded whole-stage answer document into one text segment per
 * task, by locating each task's own top-level heading. Without this, every
 * field from every task is matched against the *entire* document starting
 * from line 0 — so a field in a later task whose prompt text happens to look
 * like an earlier task's line (a very common case for this content, since
 * the appendix intentionally repeats earlier tasks' prompts verbatim, e.g.
 * "我服務的是") would silently latch onto the wrong task's line, or a short
 * generic option label like "其他" would grab whichever task's "其他" line
 * happens to come first in the file. Scoping each task's fields to its own
 * slice of the document eliminates that class of cross-task mismatch.
 * Falls back to the whole document for any task whose heading can't be
 * found (e.g. the student deleted or heavily reworded it), so nothing is
 * silently dropped.
 */
export function splitSourceByTask(source: string, taskTitles: { key: string; title: string }[]) {
  const lines = source.split(/\r?\n/);
  const boundaries: { key: string; index: number }[] = [];
  taskTitles.forEach(({ key, title }) => {
    const ordinal = taskOrdinal(title);
    if (!ordinal) return;
    const found = lines.findIndex((line) => isHeadingLine(line) && taskOrdinal(normalizedLine(line)) === ordinal);
    if (found >= 0) boundaries.push({ key, index: found });
  });
  boundaries.sort((a, b) => a.index - b.index);
  const segments = new Map<string, string>();
  boundaries.forEach((boundary, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : lines.length;
    segments.set(boundary.key, lines.slice(boundary.index, end).join("\n"));
  });
  return segments;
}

/**
 * Import a whole stage's worth of fields at once, the way the teacher
 * import flow actually uses `extractImportedAnswers` — but scoped per task
 * (see `splitSourceByTask`) so fields don't cross-match into a different
 * task's lookalike line. Any field that still comes back empty from its own
 * task's slice is retried once against the *whole* document as a fallback,
 * so a task whose heading couldn't be located (and therefore has no slice
 * to search) still gets a chance at a correct match instead of silently
 * losing all of its answers.
 */
export function extractImportedAnswersForStage(source: string, tasks: { key: string; title: string; fields: AssignmentField[] }[]) {
  const segments = splitSourceByTask(source, tasks);
  const answers: Record<string, string | string[]> = {};
  tasks.forEach((task) => {
    const segment = segments.get(task.key);
    // Only when this task's own heading couldn't be located at all (so
    // there is no scoped slice to search) is the whole document tried as a
    // fallback. A field a teacher genuinely left blank inside a
    // successfully-scoped task must stay blank here rather than being
    // "found" by a wider search matching some other task's similar-looking
    // line — that wider search is exactly the cross-task mismatch scoping
    // exists to prevent, so it's a last resort for a missing *section*, not
    // a per-field retry for an answered-elsewhere-looking blank.
    const scoped = extractImportedAnswers(segment ?? source, task.fields);
    Object.assign(answers, scoped);
  });
  return answers;
}

export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  const checked = (line: string) => /(?:☑|☒|\[[xX]\])/.test(line);
  const active = (field: AssignmentField) => {
    if (!field.dependsOn) return true;
    const value = answers[field.dependsOn.fieldKey];
    return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
  };
  // Pre-locate each checkboxes field's own anchor line — the first line
  // matching one of its *distinctive* (non-"其他") option labels — using
  // document order so two adjacent groups just a few lines apart (a common
  // layout in this content) bound each other tightly instead of one group's
  // search window swallowing the next group's "其他" line. "其他" itself is
  // excluded from anchor search since several unrelated groups in the same
  // task can each have one.
  const checkboxAnchors = fields.map((field) => {
    if (field.type !== "checkboxes") return -1;
    const distinctiveOptions = (field.options ?? []).filter((option) => optionLabelText(option.label).length >= 3 && optionLabelText(option.label) !== "其他");
    return distinctiveOptions.length ? lines.findIndex((line) => distinctiveOptions.some((option) => optionMatches(line, option.label))) : -1;
  });
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    const field = fields[fieldIndex];
    if (field.hiddenInGroup || !active(field)) continue;
    if (field.type === "checkboxes") {
      const anchor = checkboxAnchors[fieldIndex];
      const nextAnchor = checkboxAnchors.slice(fieldIndex + 1).find((value) => value >= 0);
      // No anchor for this field's own options at all (e.g. a student
      // rewrote this section as free text instead of keeping the ☐ list) —
      // rather than falling back to searching the whole segment, which
      // reliably grabs *the nearest other group's* line, confine the search
      // to the gap between the nearest anchored neighbours so it can only
      // ever find something that actually sits near where this field
      // belongs in the document.
      let windowLines: string[];
      if (anchor >= 0) {
        const windowEnd = nextAnchor !== undefined && nextAnchor > anchor ? nextAnchor : anchor + 12;
        windowLines = lines.slice(Math.max(0, anchor - 3), windowEnd);
      } else {
        const prevAnchor = checkboxAnchors.slice(0, fieldIndex).reverse().find((value) => value >= 0);
        const gapStart = prevAnchor !== undefined ? prevAnchor + 1 : 0;
        const gapEnd = nextAnchor !== undefined ? nextAnchor : lines.length;
        windowLines = lines.slice(gapStart, gapEnd);
      }
      const selectedOptions = (field.options ?? []).filter((option) => windowLines.some((line) => optionMatches(line, option.label) && (checked(line) || normalizedLine(line).includes(normalizedLine(field.prompt)))));
      const selected = selectedOptions.map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      selectedOptions.forEach((option) => {
        if (!option.otherInputKey) return;
        const line = windowLines.find((item) => optionMatches(item, option.label) && (checked(item) || normalizedLine(item).includes(normalizedLine(field.prompt))));
        const detail = line?.split(/[：:＝=]/).slice(1).join(":").trim();
        if (detail) answers[option.otherInputKey] = detail;
      });
      continue;
    }
    if (field.layout === "table" && field.tableRow) {
      const value = findTableCell(lines, field).replace(/☐|☑|☒|\[[xX ]\]/g, "").trim();
      if (value && !/^(＿＿+|_{4,})$/.test(value)) answers[field.key] = value;
      continue;
    }
    // A merged multi-blank field (e.g. "我服務的是【____】的【____】。") carries
    // the literal sentence template in `description`; matching against that
    // finds the *whole* filled sentence directly and far more reliably than
    // the prompt-based search below, whose prompt text (e.g. "句型：我服務的
    // 是...") is a human-readable label that never appears verbatim in a
    // filled-in document at all.
    if (field.description) {
      const value = findByDescription(lines, field.description);
      if (value) { answers[field.key] = value; continue; }
    }
    const promptBase = field.prompt.split("＿＿＿＿")[0].replace(/[：:]\s*$/, "").trim();
    // Trailing parenthetical instructions — "（抄任務 1-A）", "（只能勾一個）",
    // "（第 2 格）" — are guidance for the student, not text a filled-in answer
    // is expected to repeat verbatim. Searching for the prompt *including*
    // one of these (as written) never matches a real answer file, which is
    // why appendix/"抄前面任務答案" style fields — whose whole prompt is
    // something like "我服務的是（抄任務 1-A）" — used to come back empty even
    // when the earlier task's answer was clearly filled in.
    const prompt = promptBase.replace(/[（(][^（）()]{0,24}[）)]\s*$/, "").trim() || promptBase;
    if (!prompt) continue;
    const blankMarker = /＿＿+|_{4,}/;
    // Match against the quote-stripped, emphasis-stripped line so a filled
    // answer written as "> 我服務的是【…】的【…】。" is found the same way a
    // plain line would be — blockquotes are how this content's sample/teacher
    // answers are conventionally written, not a reason to skip the line. A
    // prompt can legitimately appear more than once (once in an untouched
    // template line that a teacher left blank, once where they actually
    // wrote the answer), so every occurrence is tried in order rather than
    // stopping at the first — otherwise a still-blank template line shadows
    // the real answer that comes later.
    let value = "";
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineNoQuote = stripQuoteMarker(normalizedLine(lines[lineIndex]));
      const promptPos = lineNoQuote.indexOf(prompt);
      if (promptPos < 0) continue;

      // Prefer whatever follows the prompt on its *own* line first — this is
      // the common case for this content ("我服務的是【填好的內容】的【…】。"),
      // where the answer sits right after the prompt with no "：" separator
      // at all. Only fall back to a colon-style split when the trailing text
      // *starts* with one (e.g. "身分：填好的內容").
      const afterRaw = lineNoQuote.slice(promptPos + prompt.length).replace(/^\s*[：:＝=]\s*/, "");
      if (afterRaw.trim() && !blankMarker.test(afterRaw)) {
        value = afterRaw.trim();
        break;
      }
      // What follows the prompt on this line is either empty, or still the
      // raw "____" template placeholder (never filled in). Either way, look
      // a few lines ahead within the same block for the real answer before
      // giving up on this occurrence and trying a later one. stop at a
      // heading/rule, and never cross into a ☐/☑ checklist or a "檢查點"-style
      // aside, both of which belong to a *different* question and were
      // previously picked up as a false-positive "answer" by mistake.
      let candidateValue = "";
      for (let i = lineIndex + 1; i < lines.length && i <= lineIndex + 4; i += 1) {
        const candidate = lines[i];
        if (!candidate.trim()) continue;
        if (isStructuralBoundary(candidate) && !/^\s*>/.test(candidate)) break;
        if (isCheckboxLine(candidate) || isAsideLine(candidate) || isBoldLabelLine(candidate)) break;
        const cleaned = stripQuoteMarker(normalizedLine(candidate)).trim();
        if (cleaned && !blankMarker.test(cleaned)) candidateValue = cleaned;
        break;
      }
      if (candidateValue) {
        value = candidateValue;
        break;
      }
      // Neither the same line nor the next line had a real answer for this
      // occurrence of the prompt (it's an untouched template blank) — keep
      // scanning for a later occurrence instead of stopping here.
    }
    if (value && !/^(請填寫|你的答案|答案)$/.test(value) && !isAsideLine(value)) answers[field.key] = value;
  }
  return answers;
}
