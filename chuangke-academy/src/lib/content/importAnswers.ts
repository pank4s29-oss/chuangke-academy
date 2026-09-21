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

export function extractImportedAnswers(source: string, fields: AssignmentField[]) {
  const lines = source.split(/\r?\n/);
  const answers: Record<string, string | string[]> = {};
  const checked = (line: string) => /(?:☑|☒|\[[xX]\])/.test(line);
  const active = (field: AssignmentField) => {
    if (!field.dependsOn) return true;
    const value = answers[field.dependsOn.fieldKey];
    return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
  };
  for (const field of fields) {
    if (field.hiddenInGroup || !active(field)) continue;
    if (field.type === "checkboxes") {
      const selectedOptions = (field.options ?? []).filter((option) => lines.some((line) => optionMatches(line, option.label) && (checked(line) || normalizedLine(line).includes(normalizedLine(field.prompt)))));
      const selected = selectedOptions.map((option) => option.key);
      if (selected.length) answers[field.key] = field.multiple ? selected : [selected[0]];
      selectedOptions.forEach((option) => {
        if (!option.otherInputKey) return;
        const line = lines.find((item) => optionMatches(item, option.label) && (checked(item) || normalizedLine(item).includes(normalizedLine(field.prompt))));
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
    const prompt = field.prompt.split("＿＿＿＿")[0].replace(/[：:]\s*$/, "").trim();
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
